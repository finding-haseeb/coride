import prisma from "../config/db.js";

/** IDs of users hidden from `userId`: people they blocked and people who blocked them. */
export const getHiddenUserIds = async (userId) => {
  if (!userId) return [];
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return [...new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)))];
};

export const isBlockedBetween = async (a, b) => {
  const row = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return !!row;
};
