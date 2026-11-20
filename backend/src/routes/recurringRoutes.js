import express from "express";
import prisma from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";
import { validateTripInput } from "../services/tripService.js";
import { handle, HttpError } from "../utils/handler.js";

const router = express.Router();
router.use(authenticateToken);

const MAX_RECURRING = 10;

const parseSchedule = (data, partial = false) => {
  const out = {};
  if (!partial || data.days !== undefined) {
    const days = Array.isArray(data.days) ? [...new Set(data.days.map(Number))] : [];
    if (!days.length || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      throw new Error("Pick at least one day (0 = Sunday ... 6 = Saturday)");
    }
    out.days = days.sort();
  }
  if (!partial || data.departureMinutes !== undefined) {
    const m = Number(data.departureMinutes);
    if (!Number.isInteger(m) || m < 0 || m >= 24 * 60) throw new Error("Invalid departure time");
    out.departureMinutes = m;
  }
  if (data.active !== undefined) out.active = !!data.active;
  return out;
};

router.get("/", handle((req) =>
  prisma.recurringTrip.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } }),
));

router.post("/", handle(async (req) => {
  const count = await prisma.recurringTrip.count({ where: { userId: req.user.id } });
  if (count >= MAX_RECURRING) throw new Error(`You can save up to ${MAX_RECURRING} regular trips`);
  return prisma.recurringTrip.create({
    data: { userId: req.user.id, ...parseSchedule(req.body), ...validateTripInput(req.body) },
  });
}, 201));

const ownTrip = async (req) => {
  const trip = await prisma.recurringTrip.findUnique({ where: { id: req.params.id } });
  if (!trip || trip.userId !== req.user.id) throw new HttpError(404, "Regular trip not found");
  return trip;
};

router.put("/:id", handle(async (req) => {
  await ownTrip(req);
  return prisma.recurringTrip.update({ where: { id: req.params.id }, data: parseSchedule(req.body, true) });
}));

router.delete("/:id", handle(async (req) => {
  await ownTrip(req);
  await prisma.recurringTrip.delete({ where: { id: req.params.id } });
}));

export default router;
