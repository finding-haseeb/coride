import express from "express";
import { optionalAuth } from "../middleware/auth.js";
import { getStats } from "../services/statsService.js";
import { handle } from "../utils/handler.js";

const router = express.Router();

router.get("/:userId", optionalAuth, handle((req) => getStats(req.params.userId)));

export default router;
