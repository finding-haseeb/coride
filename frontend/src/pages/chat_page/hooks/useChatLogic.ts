import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../../../store/useAuthStore";
import { api, avatarFor, CHAT_WORKER_URL, errorMessage, SOCKET_URL } from "../../../lib/api";
import type { Chat, Group, LiveLocation, Message, User as ChatUser } from "../types";

interface RawDirect {
  id?: string;
  senderId: string;
  receiverId: string;
  message: string;
  clientTimestamp?: number | string | null;
  createdAt: string;
  readAt?: string | null;
  flag?: string | null;
}

interface RawGroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  message: string;
  clientTimestamp?: number | string | null;
  createdAt: string;
  sender?: { id: string; name: string; username: string; profile_image?: string | null };
}

interface Friend {
  id: string;
  name: string;
  username: string;
  profile_image?: string | null;
  emailVerified?: boolean;
}

const TYPING_IDLE_MS = 3000;
const TYPING_SHOW_MS = 4000;
const LOCATION_SHARE_MS = 60 * 60 * 1000;

const byTime = (a: Message, b: Message) => a.timestamp.getTime() - b.timestamp.getTime();
const tsOf = (x: { createdAt?: string; clientTimestamp?: number | string | null }) =>
  new Date(x.createdAt ?? (x.clientTimestamp ? Number(x.clientTimestamp) : Date.now()));

/** Adds or replaces a message, matching the optimistic copy by clientTimestamp. */
function upsert(list: Message[] = [], msg: Message): Message[] {
  const rest = list.filter(
    (m) => m.id !== msg.id && !(msg.clientTimestamp && m.clientTimestamp === msg.clientTimestamp && m.senderId === msg.senderId),
  );
  return [...rest, msg].sort(byTime);
}

export function useChatLogic(chatId: string | undefined, groupId: string | null, navigate: (to: string) => void) {
  const { user, token } = useAuthStore();
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [groupMessages, setGroupMessages] = useState<Record<string, Message[]>>({});
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [groupTyping, setGroupTyping] = useState<Record<string, Record<string, boolean>>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [externalUser, setExternalUser] = useState<ChatUser | null>(null);
  const [friendLocations, setFriendLocations] = useState<Record<string, LiveLocation>>({});
  const [sharingWith, setSharingWith] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [icebreakers, setIcebreakers] = useState<Record<string, string[]>>({});

  const activeChat = groupId ? null : chatId || null;
  const activeGroupId = groupId || null;
  const activeKeyRef = useRef<string | null>(null);
  activeKeyRef.current = activeGroupId ? `g:${activeGroupId}` : activeChat;

  const typingTimers = useRef<Record<string, number>>({});
  const lastTypingEmit = useRef(0);
  const stopTypingTimer = useRef<number | undefined>(undefined);
  const watchIds = useRef<Record<string, { watch: number; timer: number }>>({});
  const joinedGroups = useRef<Set<string>>(new Set());

  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !token) return;
    const s = io(SOCKET_URL, { auth: { token }, transports: ["websocket"] });
    setSocket(s);
    joinedGroups.current = new Set();

    s.on("connect", () => {
      s.emit("get_online_users", (users: string[]) => setOnlineUsers(new Set(users)));
      joinedGroups.current = new Set();
      setGroups((g) => [...g]); // re-run the group join effect after a reconnect
    });

    s.on("user_status", ({ userId, status }: { userId: string; status: string }) =>
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (status === "online") next.add(userId);
        else next.delete(userId);
        return next;
      }),
    );

    const toMessage = (d: RawDirect, status: Message["status"]): Message => ({
      id: d.id || `temp-${d.clientTimestamp}`,
      senderId: d.senderId,
      content: d.message,
      timestamp: tsOf(d),
      status,
      type: "text",
      clientTimestamp: d.clientTimestamp ? String(d.clientTimestamp) : undefined,
      flag: d.flag ?? null,
    });

    s.on("receive_message", (d: RawDirect) => {
      setMessages((prev) => ({ ...prev, [d.senderId]: upsert(prev[d.senderId], toMessage(d, "delivered")) }));
      setTyping((t) => ({ ...t, [d.senderId]: false }));
      if (activeKeyRef.current === d.senderId && document.visibilityState === "visible") {
        s.emit("mark_read", { otherUserId: d.senderId });
      } else {
        setUnread((u) => ({ ...u, [d.senderId]: (u[d.senderId] || 0) + 1 }));
      }
    });

    s.on("message_sent", (d: RawDirect) =>
      setMessages((prev) => ({ ...prev, [d.receiverId]: upsert(prev[d.receiverId], toMessage(d, "delivered")) })),
    );

    s.on("message_rejected", (d: { receiverId?: string; groupId?: string; clientTimestamp?: number; reason: string }) => {
      const drop = (list: Message[] = []) => list.filter((m) => m.clientTimestamp !== String(d.clientTimestamp));
      if (d.groupId) setGroupMessages((p) => ({ ...p, [d.groupId!]: drop(p[d.groupId!]) }));
      else if (d.receiverId) setMessages((p) => ({ ...p, [d.receiverId!]: drop(p[d.receiverId!]) }));
      setNotice(d.reason);
    });

    s.on("messages_read", ({ readerId, at }: { readerId: string; at: string }) => {
      const cutoff = new Date(at).getTime();
      setMessages((prev) => ({
        ...prev,
        [readerId]: (prev[readerId] || []).map((m) =>
          m.senderId === user.id && m.timestamp.getTime() <= cutoff ? { ...m, status: "read" } : m,
        ),
      }));
    });

    s.on("typing", ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTyping((t) => ({ ...t, [userId]: isTyping }));
      window.clearTimeout(typingTimers.current[userId]);
      if (isTyping) {
        typingTimers.current[userId] = window.setTimeout(
          () => setTyping((t) => ({ ...t, [userId]: false })),
          TYPING_SHOW_MS,
        );
      }
    });

    s.on("group_typing", ({ groupId: g, userId, isTyping }: { groupId: string; userId: string; isTyping: boolean }) => {
      setGroupTyping((t) => ({ ...t, [g]: { ...t[g], [userId]: isTyping } }));
      const key = `${g}:${userId}`;
      window.clearTimeout(typingTimers.current[key]);
      if (isTyping) {
        typingTimers.current[key] = window.setTimeout(
          () => setGroupTyping((t) => ({ ...t, [g]: { ...t[g], [userId]: false } })),
          TYPING_SHOW_MS,
        );
      }
    });

    s.on("receive_group_message", (d: RawGroupMessage & { senderName?: string }) => {
      const msg: Message = {
        id: d.senderId === user.id ? `temp-${d.clientTimestamp}` : d.id,
        senderId: d.senderId,
        content: d.message,
        timestamp: tsOf(d),
        status: "delivered",
        type: "text",
        clientTimestamp: d.clientTimestamp ? String(d.clientTimestamp) : undefined,
      };
      setGroupMessages((prev) => ({ ...prev, [d.groupId]: upsert(prev[d.groupId], msg) }));
      setGroups((prev) =>
        prev.map((g) =>
          g.id === d.groupId
            ? { ...g, lastMessage: { message: d.message, createdAt: d.createdAt, senderId: d.senderId } }
            : g,
        ),
      );
      if (d.senderId !== user.id && activeKeyRef.current !== `g:${d.groupId}`) {
        setUnread((u) => ({ ...u, [`g:${d.groupId}`]: (u[`g:${d.groupId}`] || 0) + 1 }));
      }
    });

    s.on("location_update", (loc: LiveLocation & { from: string }) =>
      setFriendLocations((prev) => ({ ...prev, [loc.from]: loc })),
    );
    s.on("location_stop", ({ from }: { from: string }) =>
      setFriendLocations((prev) => {
        const next = { ...prev };
        delete next[from];
        return next;
      }),
    );

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user, token]);

  // Join every group room so new messages arrive even when the group is not open.
  useEffect(() => {
    if (!socket?.connected) return;
    for (const g of groups) {
      if (joinedGroups.current.has(g.id)) continue;
      joinedGroups.current.add(g.id);
      socket.emit("join_group", g.id, (res: { ok: boolean }) => {
        if (!res?.ok) joinedGroups.current.delete(g.id);
      });
    }
  }, [socket, groups]);

  // ── Initial data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !token) {
      navigate("/auth");
      return;
    }
    let cancelled = false;

    (async () => {
      const [friendRes, groupRes, unreadRes] = await Promise.allSettled([
        api.get("/friendships/friends"),
        api.get("/groups"),
        axios.get(`${CHAT_WORKER_URL}/chats/unread`, authHeader),
      ]);
      if (cancelled) return;
      const fetchedFriends: Friend[] = friendRes.status === "fulfilled" ? friendRes.value.data.data : [];
      setFriends(fetchedFriends);
      if (groupRes.status === "fulfilled") setGroups(groupRes.value.data.data);
      if (unreadRes.status === "fulfilled") setUnread(unreadRes.value.data.data || {});

      const results = await Promise.allSettled(
        fetchedFriends.map((f) => axios.get(`${CHAT_WORKER_URL}/chats/between/${user.id}/${f.id}`, authHeader)),
      );
      if (cancelled) return;
      const next: Record<string, Message[]> = {};
      results.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const contactId = fetchedFriends[i].id;
        next[contactId] = (r.value.data.data as RawDirect[])
          .map((c) => ({
            id: c.id || `temp-${c.clientTimestamp}`,
            senderId: c.senderId,
            content: c.message,
            timestamp: tsOf(c),
            status: (c.readAt ? "read" : "delivered") as Message["status"],
            type: "text" as const,
            clientTimestamp: c.clientTimestamp ? String(c.clientTimestamp) : undefined,
          }))
          .sort(byTime);
      });
      setMessages(next);
    })().catch((err) => console.error("Failed to load chats", err));

    return () => {
      cancelled = true;
    };
  }, [user, token, navigate, authHeader]);

  // Load a group's history when it is opened.
  useEffect(() => {
    if (!activeGroupId) return;
    api
      .get(`/groups/${activeGroupId}/messages`)
      .then((res) => {
        const list = (res.data.data as RawGroupMessage[]).map<Message>((m) => ({
          id: m.id,
          senderId: m.senderId,
          content: m.message,
          timestamp: tsOf(m),
          status: "delivered",
          type: "text",
          clientTimestamp: m.clientTimestamp ? String(m.clientTimestamp) : undefined,
        }));
        setGroupMessages((prev) => ({ ...prev, [activeGroupId]: list }));
      })
      .catch((err) => {
        setNotice(errorMessage(err, "Could not open this group"));
        navigate("/chat");
      });
    setUnread((u) => ({ ...u, [`g:${activeGroupId}`]: 0 }));
  }, [activeGroupId, navigate]);

  // Opening a chat marks its messages as read.
  useEffect(() => {
    if (!activeChat || !socket) return;
    socket.emit("mark_read", { otherUserId: activeChat });
    setUnread((u) => ({ ...u, [activeChat]: 0 }));
  }, [activeChat, socket, messages[activeChat ?? ""]?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Someone who is not (yet) in the friends list, e.g. opened from a profile.
  useEffect(() => {
    if (!activeChat || friends.some((f) => f.id === activeChat)) {
      setExternalUser(null);
      return;
    }
    api
      .get(`/users/${activeChat}`)
      .then((res) => {
        const u = res.data.data;
        setExternalUser({ id: u.id, name: u.name || u.username, avatar: avatarFor(u), status: "offline", verified: u.emailVerified });
      })
      .catch(() => setExternalUser(null));
  }, [activeChat, friends]);

  // Opening lines for a new conversation (AI, with a rule-based fallback).
  const activeIsEmpty = !!activeChat && (messages[activeChat]?.length ?? 0) === 0;
  useEffect(() => {
    if (!activeChat || !activeIsEmpty || icebreakers[activeChat]) return;
    api
      .get(`/ai/icebreakers/${activeChat}`)
      .then((r) => setIcebreakers((prev) => ({ ...prev, [activeChat]: r.data.data.suggestions })))
      .catch(() => undefined);
  }, [activeChat, activeIsEmpty, icebreakers]);

  // Stop every live-location share when leaving the chat page.
  useEffect(
    () => () => {
      for (const { watch, timer } of Object.values(watchIds.current)) {
        navigator.geolocation?.clearWatch(watch);
        window.clearTimeout(timer);
      }
    },
    [],
  );

  // ── Sidebar list ─────────────────────────────────────────────────────────
  const activeChatsList: Chat[] = useMemo(() => {
    const direct: Chat[] = friends.map((f) => {
      const list = messages[f.id] || [];
      const last = list[list.length - 1];
      return {
        id: f.id,
        user: {
          id: f.id,
          name: f.name || f.username,
          avatar: avatarFor(f),
          status: onlineUsers.has(f.id) ? "online" : "offline",
          verified: f.emailVerified,
        },
        lastMessage: last ? previewOf(last.content, last.senderId === user?.id) : "Say hello!",
        timestamp: last ? last.timestamp : new Date(0),
        unreadCount: unread[f.id] || 0,
        isTyping: !!typing[f.id],
      };
    });
    const groupChats: Chat[] = groups.map((g) => ({
      id: `g:${g.id}`,
      isGroup: true,
      user: {
        id: g.id,
        name: g.name,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(g.name)}&background=4F46E5&color=fff`,
        status: "offline",
      },
      lastMessage: g.lastMessage
        ? `${g.lastMessage.senderId === user?.id ? "You" : memberName(g, g.lastMessage.senderId)}: ${previewOf(g.lastMessage.message, false)}`
        : `${g.members.length} members`,
      timestamp: new Date(g.lastMessage?.createdAt ?? g.createdAt),
      unreadCount: unread[`g:${g.id}`] || 0,
      isTyping: Object.values(groupTyping[g.id] || {}).some(Boolean),
    }));
    return [...direct, ...groupChats].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [friends, groups, messages, onlineUsers, unread, typing, groupTyping, user?.id]);

  const activeGroup = useMemo(() => groups.find((g) => g.id === activeGroupId) ?? null, [groups, activeGroupId]);

  const activeUser: ChatUser | null = useMemo(() => {
    if (activeGroup) {
      return {
        id: activeGroup.id,
        name: activeGroup.name,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(activeGroup.name)}&background=4F46E5&color=fff`,
        status: "offline",
      };
    }
    const found = activeChatsList.find((c) => c.id === activeChat)?.user ?? externalUser;
    return found ? { ...found, status: onlineUsers.has(found.id) ? "online" : "offline" } : null;
  }, [activeGroup, activeChatsList, activeChat, externalUser, onlineUsers]);

  const typingText = useMemo(() => {
    if (activeChat) return typing[activeChat] ? "typing…" : null;
    if (activeGroup) {
      const names = Object.entries(groupTyping[activeGroup.id] || {})
        .filter(([id, on]) => on && id !== user?.id)
        .map(([id]) => memberName(activeGroup, id));
      if (names.length === 0) return null;
      return names.length === 1 ? `${names[0]} is typing…` : `${names.length} people are typing…`;
    }
    return null;
  }, [activeChat, activeGroup, typing, groupTyping, user?.id]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    (content: string) => {
      if (!user || !socket) return;
      const clientTimestamp = Date.now();
      const optimistic: Message = {
        id: `temp-${clientTimestamp}`,
        senderId: user.id,
        content,
        timestamp: new Date(clientTimestamp),
        status: "sent",
        type: "text",
        clientTimestamp: String(clientTimestamp),
      };
      window.clearTimeout(stopTypingTimer.current);
      lastTypingEmit.current = 0;
      if (activeGroupId) {
        setGroupMessages((prev) => ({ ...prev, [activeGroupId]: upsert(prev[activeGroupId], optimistic) }));
        socket.emit("send_group_message", { groupId: activeGroupId, message: content, clientTimestamp });
        socket.emit("typing", { groupId: activeGroupId, isTyping: false });
      } else if (activeChat) {
        setMessages((prev) => ({ ...prev, [activeChat]: upsert(prev[activeChat], optimistic) }));
        socket.emit("send_message", { receiverId: activeChat, message: content, clientTimestamp });
        socket.emit("typing", { receiverId: activeChat, isTyping: false });
      }
    },
    [user, socket, activeChat, activeGroupId],
  );

  /** Called on each keystroke; sends "typing" at most every 2 s and "stopped" after 3 s idle. */
  const handleTyping = useCallback(() => {
    if (!socket || (!activeChat && !activeGroupId)) return;
    const target = activeGroupId ? { groupId: activeGroupId } : { receiverId: activeChat };
    if (Date.now() - lastTypingEmit.current > 2000) {
      socket.emit("typing", { ...target, isTyping: true });
      lastTypingEmit.current = Date.now();
    }
    window.clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = window.setTimeout(() => {
      socket.emit("typing", { ...target, isTyping: false });
      lastTypingEmit.current = 0;
    }, TYPING_IDLE_MS);
  }, [socket, activeChat, activeGroupId]);

  const uploadImage = useCallback(async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/uploads/image", form);
      return res.data.data.url as string;
    } catch (err) {
      setNotice(errorMessage(err, "Image upload failed"));
      return null;
    }
  }, []);

  const stopSharing = useCallback(
    (friendId: string) => {
      const w = watchIds.current[friendId];
      if (w) {
        navigator.geolocation.clearWatch(w.watch);
        window.clearTimeout(w.timer);
        delete watchIds.current[friendId];
      }
      socket?.emit("location_stop", { to: friendId });
      setSharingWith((prev) => {
        const next = new Set(prev);
        next.delete(friendId);
        return next;
      });
    },
    [socket],
  );

  const toggleShareLocation = useCallback(() => {
    if (!activeChat || !socket) return;
    if (sharingWith.has(activeChat)) {
      stopSharing(activeChat);
      return;
    }
    if (!("geolocation" in navigator)) {
      setNotice("This browser can't share location");
      return;
    }
    const to = activeChat;
    const watch = navigator.geolocation.watchPosition(
      (pos) =>
        socket.emit("location_update", {
          to,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        setNotice(err.code === err.PERMISSION_DENIED ? "Location permission was denied" : "Could not get your location");
        stopSharing(to);
      },
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    // Sharing stops by itself after an hour.
    const timer = window.setTimeout(() => stopSharing(to), LOCATION_SHARE_MS);
    watchIds.current[to] = { watch, timer };
    setSharingWith((prev) => new Set(prev).add(to));
  }, [activeChat, socket, sharingWith, stopSharing]);

  const handleClearChat = async () => {
    if (!activeChat || !user) return;
    if (!confirm("Clear this chat for both of you? This can't be undone.")) return;
    try {
      await axios.delete(`${CHAT_WORKER_URL}/chats/between/${user.id}/${activeChat}`, authHeader);
      setMessages((prev) => ({ ...prev, [activeChat]: [] }));
    } catch (err) {
      setNotice(errorMessage(err, "Failed to clear chat"));
    }
  };

  const dropContact = (id: string) => {
    if (sharingWith.has(id)) stopSharing(id);
    setFriends((prev) => prev.filter((f) => f.id !== id));
    setMessages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    navigate("/chat");
  };

  const handleRemoveFriend = async () => {
    if (!activeChat || !user) return;
    if (!confirm("Remove this person as a friend? Your chat with them will also be cleared.")) return;
    try {
      await api.delete(`/friendships/user/${activeChat}`);
      await axios.delete(`${CHAT_WORKER_URL}/chats/between/${user.id}/${activeChat}`, authHeader).catch(() => undefined);
      dropContact(activeChat);
    } catch (err) {
      setNotice(errorMessage(err, "Failed to remove friend"));
    }
  };

  const handleBlock = async () => {
    if (!activeChat) return;
    if (!confirm(`Block ${activeUser?.name ?? "this person"}? You won't see each other in matches or chat. You can unblock from your profile.`)) return;
    try {
      await api.post("/safety/block", { userId: activeChat });
      dropContact(activeChat);
      setNotice("Blocked. They can no longer message you.");
    } catch (err) {
      setNotice(errorMessage(err, "Failed to block"));
    }
  };

  const handleReport = async (reason: string, details: string) => {
    if (!activeChat) return false;
    try {
      await api.post("/safety/report", { userId: activeChat, reason, details });
      setNotice("Report sent. Thank you for keeping CoRide safe.");
      return true;
    } catch (err) {
      setNotice(errorMessage(err, "Report could not be sent"));
      return false;
    }
  };

  const createGroup = async (name: string, memberIds: string[]) => {
    const res = await api.post("/groups", { name, memberIds });
    const group: Group = { ...res.data.data, lastMessage: null };
    setGroups((prev) => [group, ...prev]);
    navigate(`/chat?group=${group.id}`);
  };

  const leaveGroup = async () => {
    if (!activeGroup) return;
    if (!confirm(`Leave “${activeGroup.name}”?`)) return;
    try {
      await api.delete(`/groups/${activeGroup.id}/members/me`);
      socket?.emit("leave_group", activeGroup.id);
      joinedGroups.current.delete(activeGroup.id);
      setGroups((prev) => prev.filter((g) => g.id !== activeGroup.id));
      navigate("/chat");
    } catch (err) {
      setNotice(errorMessage(err, "Could not leave the group"));
    }
  };

  const currentMessages = activeGroupId ? groupMessages[activeGroupId] || [] : activeChat ? messages[activeChat] || [] : [];

  return {
    messages: currentMessages,
    activeChat,
    activeGroup,
    activeChatsList,
    activeUser,
    friends,
    typingText,
    notice,
    clearNotice: () => setNotice(null),
    suggestions: activeChat ? icebreakers[activeChat] ?? [] : [],
    friendLocation: activeChat ? friendLocations[activeChat] ?? null : null,
    isSharingLocation: activeChat ? sharingWith.has(activeChat) : false,
    toggleShareLocation,
    handleSendMessage,
    handleTyping,
    uploadImage,
    handleClearChat,
    handleRemoveFriend,
    handleBlock,
    handleReport,
    createGroup,
    leaveGroup,
  };
}

function memberName(group: Group, userId: string) {
  return group.members.find((m) => m.userId === userId)?.user.name.split(" ")[0] ?? "Someone";
}

function previewOf(content: string, own: boolean) {
  const text = content.startsWith("[Image: ") ? "📷 Photo" : content;
  return own ? `You: ${text}` : text;
}
