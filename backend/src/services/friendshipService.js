import prisma from "../config/db.js";
import { isBlockedBetween } from "./blockService.js";
import { notify } from "./notificationService.js";

const FRIEND_SELECT = { id: true, name: true, username: true, profile_image: true, emailVerified: true };

// More requests than this in an hour looks like spam, not commuting.
const MAX_REQUESTS_PER_HOUR = 20;

export const sendRequest = async (requesterId, receiverId) => {
  if (requesterId === receiverId) throw new Error("Cannot send request to yourself");
  const recent = await prisma.friendship.count({
    where: { requesterId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_REQUESTS_PER_HOUR) {
    throw new Error("You've sent a lot of requests. Please wait a while before sending more.");
  }
  const existing = await prisma.friendship.findFirst({
    where: { OR: [{ requesterId, receiverId }, { requesterId: receiverId, receiverId: requesterId }] },
  });
  if (existing) throw new Error("Friendship interaction already exists");
  if (await isBlockedBetween(requesterId, receiverId)) throw new Error("You cannot connect with this user");
  const friendship = await prisma.friendship.create({
    data: { requesterId, receiverId, status: "PENDING" },
    include: { requester: { select: FRIEND_SELECT } },
  });
  await notify(receiverId, {
    type: "FRIEND_REQUEST",
    title: `${friendship.requester.name} wants to ride with you`,
    link: "/notifications",
  });
  return friendship;
};

export const acceptRequest = async (id, userId) => {
  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship) throw new Error("Request not found");
  if (friendship.receiverId !== userId) throw new Error("Unauthorized");
  const updated = await prisma.friendship.update({
    where: { id }, data: { status: "ACCEPTED" },
    include: { receiver: { select: FRIEND_SELECT } },
  });
  await notify(friendship.requesterId, {
    type: "FRIEND_ACCEPTED",
    title: `${updated.receiver.name} accepted your request`,
    body: "You can chat now.",
    link: "/chat",
  });
  return updated;
};

export const rejectRequest = async (id, userId) => {
  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship) throw new Error("Request not found");
  if (friendship.receiverId !== userId && friendship.requesterId !== userId) throw new Error("Unauthorized");
  await prisma.friendship.delete({ where: { id } });
};

export const getPendingRequests = async (userId) => {
  return await prisma.friendship.findMany({
    where: { receiverId: userId, status: "PENDING" },
    include: { requester: { select: FRIEND_SELECT } },
  });
};

export const getFriends = async (userId) => {
  const requests = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: userId }, { receiverId: userId }], status: "ACCEPTED" },
    include: {
      requester: { select: FRIEND_SELECT },
      receiver: { select: FRIEND_SELECT },
    },
  });
  const hidden = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const hiddenIds = new Set(hidden.flatMap((b) => [b.blockerId, b.blockedId]));
  hiddenIds.delete(userId);
  return requests
    .map((f) => (f.requesterId === userId ? f.receiver : f.requester))
    .filter((u) => !hiddenIds.has(u.id));
};

export const removeFriendByUserId = async (userId, friendId) => {
  const friendship = await prisma.friendship.findFirst({
    where: { OR: [{ requesterId: userId, receiverId: friendId }, { requesterId: friendId, receiverId: userId }] },
  });
  if (!friendship) throw new Error("Friendship not found");
  await prisma.friendship.delete({ where: { id: friendship.id } });
};
