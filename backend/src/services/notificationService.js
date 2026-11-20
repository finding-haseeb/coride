import prisma from "../config/db.js";

export const notify = async (userId, { type, title, body = null, link = null }) => {
  try {
    return await prisma.notification.create({ data: { userId, type, title, body, link } });
  } catch (err) {
    // A failed notification must never break the action that caused it.
    console.error("Failed to create notification:", err.message);
    return null;
  }
};

export const notifyMany = async (userIds, payload) => {
  if (!userIds.length) return;
  await prisma.notification
    .createMany({ data: userIds.map((userId) => ({ userId, ...payload })) })
    .catch((err) => console.error("Failed to create notifications:", err.message));
};

export const listNotifications = async (userId, { unreadOnly = false, limit = 50 } = {}) => {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(unreadOnly && { read: false }) },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  return { items, unread };
};

export const markRead = async (userId, id) => {
  const result = await prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
  if (result.count === 0) throw new Error("Notification not found");
};

export const markAllRead = async (userId) => {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
};
