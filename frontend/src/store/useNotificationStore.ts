import { create } from "zustand";
import { api } from "../lib/api";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  items: AppNotification[];
  unread: number;
  loaded: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  reset: () => void;
}

const seen = new Set<string>();

/** Shows a system notification for new items while the tab is in the background. */
function announce(items: AppNotification[]) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  for (const n of items) {
    const note = new Notification(n.title, { body: n.body ?? undefined, icon: "/coride-logo.svg", tag: n.id });
    note.onclick = () => {
      window.focus();
      if (n.link?.startsWith("/")) window.location.assign(n.link);
    };
  }
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  items: [],
  unread: 0,
  loaded: false,
  refresh: async () => {
    try {
      const res = await api.get("/notifications");
      const { items, unread } = res.data.data as { items: AppNotification[]; unread: number };
      const fresh = get().loaded ? items.filter((n) => !n.read && !seen.has(n.id)) : [];
      items.forEach((n) => seen.add(n.id));
      announce(fresh);
      set({ items, unread, loaded: true });
    } catch {
      // Offline or logged out: keep what we have.
    }
  },
  markRead: async (id) => {
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unread: Math.max(0, s.unread - (s.items.find((n) => n.id === id && !n.read) ? 1 : 0)),
    }));
    await api.put(`/notifications/${id}/read`).catch(() => undefined);
  },
  markAllRead: async () => {
    set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })), unread: 0 }));
    await api.put("/notifications/read-all").catch(() => undefined);
  },
  reset: () => {
    seen.clear();
    set({ items: [], unread: 0, loaded: false });
  },
}));
