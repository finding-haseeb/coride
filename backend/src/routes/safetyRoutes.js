import express from "express";
import prisma from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";
import { notifyMany } from "../services/notificationService.js";
import { handle, HttpError } from "../utils/handler.js";
import { triageReport } from "../ai/triage.js";

const router = express.Router();
router.use(authenticateToken);

const REPORT_REASONS = ["harassment", "fake_profile", "unsafe_behaviour", "spam", "no_show", "other"];

const requireOtherUser = async (req, id) => {
  if (!id || id === req.user.id) throw new Error("Pick another user");
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new HttpError(404, "User not found");
};

router.post("/report", handle(async (req) => {
  const { userId, reason, details } = req.body;
  await requireOtherUser(req, userId);
  if (!REPORT_REASONS.includes(reason)) throw new Error("Pick a reason for the report");
  const report = await prisma.report.create({
    data: {
      reporterId: req.user.id,
      reportedId: userId,
      reason,
      details: typeof details === "string" ? details.trim().slice(0, 1000) || null : null,
    },
    select: { id: true, reason: true, status: true, createdAt: true },
  });
  // Risk scoring runs in the background; the reporter does not wait for it.
  triageReport(report.id);
  return report;
}, 201));

router.get("/blocks", handle((req) =>
  prisma.block.findMany({
    where: { blockerId: req.user.id },
    select: { id: true, createdAt: true, blocked: { select: { id: true, name: true, username: true, profile_image: true } } },
    orderBy: { createdAt: "desc" },
  }),
));

// Blocking also ends any friendship, so the two people can no longer chat.
router.post("/block", handle(async (req) => {
  const { userId } = req.body;
  await requireOtherUser(req, userId);
  await prisma.$transaction([
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: req.user.id, blockedId: userId } },
      create: { blockerId: req.user.id, blockedId: userId },
      update: {},
    }),
    prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: req.user.id, receiverId: userId },
          { requesterId: userId, receiverId: req.user.id },
        ],
      },
    }),
  ]);
}, 201));

router.delete("/block/:userId", handle(async (req) => {
  await prisma.block.deleteMany({ where: { blockerId: req.user.id, blockedId: req.params.userId } });
}));

const friendIdsOf = async (userId) => {
  const rows = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { receiverId: userId }] },
    select: { requesterId: true, receiverId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.receiverId : r.requesterId));
};

/**
 * SOS: alerts the user's CoRide friends in the app. Texting emergency contacts
 * happens on the user's phone (the app opens an SMS with this message).
 */
router.post("/sos", handle(async (req) => {
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const mapsUrl = hasLocation ? `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}` : null;
  const station = typeof req.body.station === "string" ? req.body.station.slice(0, 80) : null;

  const friends = await friendIdsOf(req.user.id);
  await notifyMany(friends, {
    type: "SOS",
    title: `🚨 ${req.user.name} needs help`,
    body: [station && `Near ${station}`, mapsUrl].filter(Boolean).join(" · ") || "Location not shared",
    link: mapsUrl,
  });

  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { emergencyContacts: true } });
  const message = `SOS from ${req.user.name} via CoRide. I need help${station ? ` near ${station} metro station` : ""}.${mapsUrl ? ` My location: ${mapsUrl}` : ""}`;
  return { notifiedFriends: friends.length, contacts: me?.emergencyContacts || [], message, mapsUrl };
}));

export default router;
