import express from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/auth.js";
import { storeImage } from "../services/userService.js";
import { handle } from "../utils/handler.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = express.Router();

// Images shared in chat. Returns { url }.
router.post(
  "/image",
  authenticateToken,
  upload.single("file"),
  handle(async (req) => {
    if (!req.file) throw new Error("No file provided");
    const url = await storeImage(req.file, `${req.protocol}://${req.get("host")}`, `chat-${req.user.id}`);
    return { url };
  }, 201),
);

export default router;
