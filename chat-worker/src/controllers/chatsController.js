import { prisma } from '../config/db.js';

const between = (a, b) => ({
  OR: [
    { senderId: a, receiverId: b },
    { senderId: b, receiverId: a },
  ],
});

export async function getChatsBetween(req, res) {
  try {
    const { senderId, receiverId } = req.params;
    const chats = await prisma.chatMessage.findMany({
      where: between(senderId, receiverId),
      orderBy: { createdAt: 'asc' },
    });
    const serializedChats = chats.map((chat) => ({
      ...chat,
      clientTimestamp: chat.clientTimestamp ? Number(chat.clientTimestamp) : null,
    }));
    return res.json({ success: true, data: serializedChats });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function deleteChatsBetween(req, res) {
  try {
    const { senderId, receiverId } = req.params;
    const { count } = await prisma.chatMessage.deleteMany({ where: between(senderId, receiverId) });
    return res.json({ success: true, data: { deleted: count } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** Unread direct messages for the caller, grouped by sender. */
export async function getUnreadCounts(req, res) {
  try {
    const rows = await prisma.chatMessage.groupBy({
      by: ['senderId'],
      where: { receiverId: req.userId, readAt: null },
      _count: { _all: true },
    });
    const data = Object.fromEntries(rows.map((r) => [r.senderId, r._count._all]));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
