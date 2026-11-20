import { pubClient, streamClient } from '../redis.js';
import { canTalkTo, isGroupMember } from './access.js';
import { screenMessage } from '../moderation.js';

// Flood limits per user (in memory, per gateway process).
const BURST_WINDOW_MS = 10_000;
const BURST_MAX = 15;
const FANOUT_WINDOW_MS = 5 * 60_000;
const FANOUT_MAX = 10;
const activity = new Map(); // userId -> { sends: number[], targets: Map<target, time> }

/**
 * Returns a reason string when the user is sending too fast or messaging
 * too many different people at once (a common pattern of fake accounts).
 */
function floodCheck(userId, target) {
  const now = Date.now();
  const a = activity.get(userId) || { sends: [], targets: new Map() };
  a.sends = a.sends.filter((t) => now - t < BURST_WINDOW_MS);
  for (const [k, t] of a.targets) if (now - t > FANOUT_WINDOW_MS) a.targets.delete(k);
  if (a.sends.length >= BURST_MAX) return 'You are sending messages too fast. Please slow down.';
  if (!a.targets.has(target) && a.targets.size >= FANOUT_MAX) {
    pubClient.sAdd('flagged_users', userId).catch(() => undefined);
    return 'You are messaging many people at once. Please wait a few minutes.';
  }
  a.sends.push(now);
  a.targets.set(target, now);
  activity.set(userId, a);
  return null;
}

/** Runs flood + content checks. Returns { reject, flag }. */
function inspect(socket, target, message) {
  const flood = floodCheck(socket.userId, target);
  if (flood) return { reject: flood };
  const screen = screenMessage(message);
  if (screen.action === 'block') {
    console.warn(`[moderation] blocked message from ${socket.userId}: ${screen.reasons.join(', ')}`);
    return { reject: `Message not sent: it looks like ${screen.reasons[0]}. Please keep CoRide safe and respectful.` };
  }
  return { flag: screen.action === 'warn' ? screen.reasons[0] : null };
}

let messageBatch = [];
let batchTimer = null;
const BATCH_SIZE_LIMIT = 5000;
const BATCH_TIME_LIMIT_MS = 50;
const MAX_MESSAGE_LENGTH = 2000;

const cleanText = (value) =>
  typeof value === 'string' ? value.trim().slice(0, MAX_MESSAGE_LENGTH) : '';

async function flushBatch(io) {
  if (messageBatch.length === 0) return;
  const currentBatch = messageBatch;
  messageBatch = [];
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  try {
    const multi = streamClient.multi();
    for (const item of currentBatch) {
      multi.xAdd('chat_stream', '*', { payload: JSON.stringify(item.streamPayload) });
    }
    // Execute all xAdd commands in a single round trip to Redis
    await multi.exec();

    // Only AFTER a successful Redis write do we ACK and broadcast
    let emitCount = 0;
    for (const item of currentBatch) {
      item.deliver();
      emitCount++;
      if (emitCount % 100 === 0) {
        await new Promise((r) => setImmediate(r));
      }
    }
  } catch (err) {
    console.error('Batch insert failed:', err);
    for (const item of currentBatch) {
      item.socket.emit('error', { message: 'Failed to queue message' });
    }
  }
}

function enqueue(io, item) {
  messageBatch.push(item);
  if (messageBatch.length >= BATCH_SIZE_LIMIT) {
    flushBatch(io);
  } else if (!batchTimer) {
    batchTimer = setTimeout(() => flushBatch(io), BATCH_TIME_LIMIT_MS);
  }
}

export const handleGetOnlineUsers = (pubClient) => async (callback) => {
  try {
    const users = await pubClient.sMembers('online_users');
    if (typeof callback === 'function') callback(users);
  } catch {
    if (typeof callback === 'function') callback([]);
  }
};

// The sender is always the authenticated socket user, never a client field.
export const handleSendMessage = (io, socket) => async (data = {}) => {
  try {
    const senderId = socket.userId;
    const receiverId = String(data.receiverId || '');
    const message = cleanText(data.message);
    const clientTimestamp = data.clientTimestamp;
    if (!receiverId || !message) return;

    if (!(await canTalkTo(socket, receiverId))) {
      socket.emit('message_rejected', { receiverId, clientTimestamp, reason: 'You can only message your CoRide friends' });
      return;
    }
    const { reject, flag } = inspect(socket, receiverId, message);
    if (reject) {
      socket.emit('message_rejected', { receiverId, clientTimestamp, reason: reject });
      return;
    }

    const createdAt = new Date().toISOString();
    const payload = { id: `temp-pub-${clientTimestamp}`, senderId, receiverId, message, clientTimestamp, createdAt, flag };

    enqueue(io, {
      socket,
      streamPayload: { type: 'direct', senderId, receiverId, message, clientTimestamp, timestamp: createdAt },
      deliver: () => {
        io.to(receiverId).emit('receive_message', payload);
        io.to(senderId).emit('message_sent', payload);
        socket.emit('message_sent_ack', { senderId, receiverId, message, clientTimestamp, status: 'queued' });
      },
    });
  } catch (err) {
    console.error('Error queuing message to batch:', err.message);
    socket.emit('error', { message: 'Failed to queue message locally' });
  }
};

// "is typing…" is not stored, only relayed to the other person.
export const handleTyping = (io, socket) => async (data = {}) => {
  const receiverId = String(data.receiverId || '');
  if (data.groupId) {
    if (socket.data.groups?.has(data.groupId)) {
      socket.to(`group:${data.groupId}`).emit('group_typing', {
        groupId: data.groupId, userId: socket.userId, isTyping: !!data.isTyping,
      });
    }
    return;
  }
  if (await canTalkTo(socket, receiverId)) {
    io.to(receiverId).emit('typing', { userId: socket.userId, isTyping: !!data.isTyping });
  }
};

// Read receipts: tell the sender right away, store readAt through the worker.
export const handleMarkRead = (io, socket) => async (data = {}) => {
  const otherUserId = String(data.otherUserId || '');
  if (!(await canTalkTo(socket, otherUserId))) return;
  const at = new Date().toISOString();
  try {
    await streamClient.xAdd('chat_stream', '*', {
      payload: JSON.stringify({ type: 'read', readerId: socket.userId, otherUserId, timestamp: at }),
    });
    io.to(otherUserId).emit('messages_read', { readerId: socket.userId, at });
  } catch (err) {
    console.error('Failed to queue read receipt:', err.message);
  }
};

// Live location: relayed to one friend at a time and never stored.
export const handleLocationUpdate = (io, socket) => async (data = {}) => {
  const to = String(data.to || '');
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  if (!(await canTalkTo(socket, to))) return;
  io.to(to).emit('location_update', {
    from: socket.userId,
    lat,
    lng,
    accuracy: Number.isFinite(Number(data.accuracy)) ? Number(data.accuracy) : null,
    at: new Date().toISOString(),
  });
};

export const handleLocationStop = (io, socket) => async (data = {}) => {
  const to = String(data.to || '');
  if (await canTalkTo(socket, to)) io.to(to).emit('location_stop', { from: socket.userId });
};

export const handleJoinGroup = (socket) => async (groupId, callback) => {
  const ok = await isGroupMember(socket, String(groupId || ''));
  if (ok) {
    socket.data.groups ??= new Set();
    socket.data.groups.add(groupId);
    socket.join(`group:${groupId}`);
  }
  if (typeof callback === 'function') callback({ ok });
};

export const handleLeaveGroup = (socket) => (groupId) => {
  socket.data.groups?.delete(groupId);
  socket.leave(`group:${groupId}`);
};

export const handleSendGroupMessage = (io, socket) => (data = {}) => {
  const groupId = String(data.groupId || '');
  const message = cleanText(data.message);
  if (!message || !socket.data.groups?.has(groupId)) {
    socket.emit('message_rejected', { groupId, clientTimestamp: data.clientTimestamp, reason: 'Join the group first' });
    return;
  }
  const { reject, flag } = inspect(socket, `group:${groupId}`, message);
  if (reject) {
    socket.emit('message_rejected', { groupId, clientTimestamp: data.clientTimestamp, reason: reject });
    return;
  }
  const createdAt = new Date().toISOString();
  const payload = {
    id: `temp-group-${data.clientTimestamp}`,
    groupId,
    senderId: socket.userId,
    senderName: socket.data.name ?? null,
    message,
    clientTimestamp: data.clientTimestamp,
    createdAt,
    flag,
  };
  enqueue(io, {
    socket,
    streamPayload: { type: 'group', groupId, senderId: socket.userId, message, clientTimestamp: data.clientTimestamp, timestamp: createdAt },
    deliver: () => io.to(`group:${groupId}`).emit('receive_group_message', payload),
  });
};

export const handleDisconnect = (io, socket) => async () => {
  console.log('User disconnected from Gateway:', socket.id);
  if (!socket.userId) return;
  try {
    // A user may have several tabs open; only go offline when the last one closes.
    const remaining = await io.in(socket.userId).fetchSockets();
    if (remaining.length > 0) return;
    await pubClient.sRem('online_users', socket.userId);
    io.emit('user_status', { userId: socket.userId, status: 'offline' });
  } catch (err) {
    console.error('Error setting offline status:', err);
  }
};
