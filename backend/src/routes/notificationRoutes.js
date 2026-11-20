import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import * as notifications from "../services/notificationService.js";
import { handle } from "../utils/handler.js";

const router = express.Router();
router.use(authenticateToken);

router.get("/", handle((req) =>
  notifications.listNotifications(req.user.id, {
    unreadOnly: req.query.unread === "true",
    limit: Number(req.query.limit) || 50,
  }),
));
router.put("/read-all", handle((req) => notifications.markAllRead(req.user.id)));
router.put("/:id/read", handle((req) => notifications.markRead(req.user.id, req.params.id)));

export default router;
