import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { handle } from "../utils/handler.js";
import { aiEnabled } from "../ai/claude.js";
import { parseTrip } from "../ai/tripParser.js";
import { getIcebreakers } from "../ai/icebreakers.js";
import { screenMessage } from "../ai/moderation.js";

const router = express.Router();
router.use(authenticateToken);

// Tiny per-user rate limit so one account can't run up AI costs.
const hits = new Map();
const limit = (req, res, next) => {
  const now = Date.now();
  const list = (hits.get(req.user.id) || []).filter((t) => now - t < 60_000);
  if (list.length >= 20) return res.status(429).json({ success: false, message: "Too many requests, try again in a minute" });
  list.push(now);
  hits.set(req.user.id, list);
  next();
};

router.get("/status", handle(() => ({ ai: aiEnabled() })));

router.post("/parse-trip", limit, handle(async (req) => {
  const text = String(req.body.text || "").trim().slice(0, 300);
  if (!text) throw new Error("Type where you want to go");
  return parseTrip(text, req.body.now);
}));

router.get("/icebreakers/:userId", limit, handle((req) => getIcebreakers(req.user.id, req.params.userId)));

router.post("/screen", limit, handle((req) => screenMessage(req.body.text)));

export default router;
