import express from "express";
import prisma from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";
import { notifyMany } from "../services/notificationService.js";
import { getHiddenUserIds } from "../services/blockService.js";
import { handle, HttpError } from "../utils/handler.js";

const router = express.Router();
router.use(authenticateToken);

const MAX_MEMBERS = 8;
const MEMBER_USER = { select: { id: true, name: true, username: true, profile_image: true } };

const acceptedFriendIds = async (userId) => {
  const rows = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { receiverId: userId }] },
    select: { requesterId: true, receiverId: true },
  });
  return new Set(rows.map((r) => (r.requesterId === userId ? r.receiverId : r.requesterId)));
};

/** Only friends you have not blocked can be added to your groups. */
const checkInvitees = async (userId, ids) => {
  const friends = await acceptedFriendIds(userId);
  const hidden = new Set(await getHiddenUserIds(userId));
  for (const id of ids) {
    if (!friends.has(id) || hidden.has(id)) throw new Error("You can only add your CoRide friends");
  }
};

const loadGroupForMember = async (groupId, userId) => {
  const group = await prisma.rideGroup.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: MEMBER_USER }, orderBy: { joinedAt: "asc" } } },
  });
  if (!group || !group.members.some((m) => m.userId === userId)) throw new HttpError(404, "Group not found");
  return group;
};

router.get("/", handle(async (req) => {
  const groups = await prisma.rideGroup.findMany({
    where: { members: { some: { userId: req.user.id } } },
    include: {
      members: { include: { user: MEMBER_USER } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return groups
    .map(({ messages, ...g }) => ({ ...g, lastMessage: messages[0] ?? null }))
    .sort((a, b) => new Date(b.lastMessage?.createdAt ?? b.createdAt) - new Date(a.lastMessage?.createdAt ?? a.createdAt));
}));

router.post("/", handle(async (req) => {
  const name = String(req.body.name || "").trim().slice(0, 50);
  if (!name) throw new Error("Give the group a name");
  const memberIds = [...new Set((req.body.memberIds || []).filter((id) => id !== req.user.id))];
  if (memberIds.length < 1) throw new Error("Add at least one friend");
  if (memberIds.length + 1 > MAX_MEMBERS) throw new Error(`A group can have up to ${MAX_MEMBERS} people`);
  await checkInvitees(req.user.id, memberIds);

  const group = await prisma.rideGroup.create({
    data: {
      name,
      createdById: req.user.id,
      members: { create: [req.user.id, ...memberIds].map((userId) => ({ userId })) },
    },
    include: { members: { include: { user: MEMBER_USER } } },
  });
  await notifyMany(memberIds, {
    type: "GROUP_INVITE",
    title: `${req.user.name} added you to “${name}”`,
    link: `/chat?group=${group.id}`,
  });
  return group;
}, 201));

// Also used by the chat gateway to check membership before joining a room.
router.get("/:id", handle((req) => loadGroupForMember(req.params.id, req.user.id)));

router.get("/:id/messages", handle(async (req) => {
  await loadGroupForMember(req.params.id, req.user.id);
  const before = req.query.before ? new Date(req.query.before) : null;
  const messages = await prisma.groupMessage.findMany({
    where: { groupId: req.params.id, ...(before && !isNaN(before) && { createdAt: { lt: before } }) },
    include: { sender: MEMBER_USER },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return messages.reverse().map((m) => ({ ...m, clientTimestamp: m.clientTimestamp?.toString() ?? null }));
}));

router.post("/:id/members", handle(async (req) => {
  const group = await loadGroupForMember(req.params.id, req.user.id);
  const ids = [...new Set(req.body.memberIds || [])].filter((id) => !group.members.some((m) => m.userId === id));
  if (!ids.length) throw new Error("Pick friends to add");
  if (group.members.length + ids.length > MAX_MEMBERS) throw new Error(`A group can have up to ${MAX_MEMBERS} people`);
  await checkInvitees(req.user.id, ids);
  await prisma.groupMember.createMany({ data: ids.map((userId) => ({ groupId: group.id, userId })), skipDuplicates: true });
  await notifyMany(ids, {
    type: "GROUP_INVITE",
    title: `${req.user.name} added you to “${group.name}”`,
    link: `/chat?group=${group.id}`,
  });
  return loadGroupForMember(group.id, req.user.id);
}));

// Leaving the group. When the last person leaves, the group is deleted.
router.delete("/:id/members/me", handle(async (req) => {
  await loadGroupForMember(req.params.id, req.user.id);
  await prisma.groupMember.delete({ where: { groupId_userId: { groupId: req.params.id, userId: req.user.id } } });
  const left = await prisma.groupMember.count({ where: { groupId: req.params.id } });
  if (left === 0) await prisma.rideGroup.delete({ where: { id: req.params.id } });
}));

export default router;
