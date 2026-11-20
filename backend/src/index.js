import express from "express";
import prisma from "./config/db.js";
import dotenv from "dotenv";
import cors from "cors";

import userRoutes from "./routes/userRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import utilRoutes from "./routes/utilsRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import friendshipRoutes from "./routes/friendshipRoutes.js";
import recurringRoutes from "./routes/recurringRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import safetyRoutes from "./routes/safetyRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import { UPLOAD_DIR } from "./services/userService.js";
import { initCronJobs } from "./jobs/tripCron.js";

dotenv.config();

// Initialize scheduled background jobs
if (process.env.NODE_ENV !== "test") {
  initCronJobs();
}

const app = express();


const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8000",
  "https://alaska-69fq.vercel.app",
];

// ─── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/utils", utilRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/friendships", friendshipRoutes);
app.use("/api/recurring-trips", recurringRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/safety", safetyRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/ai", aiRoutes);
// Gallery images saved locally when Cloudinary is not configured.
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", fallthrough: false }));
app.get("/health", (req,res)=>{
  res.status(200).json({message:"health endpoint is working fine"})
});

// ─── Error handler ────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, message: "Image must be 5 MB or smaller" });
  }
  if (error.status === 404 && req.path.startsWith("/uploads")) {
    return res.status(404).json({ success: false, message: "Not found" });
  }
  console.error("Error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: IS_PRODUCTION ? undefined : error.message,
  });
});

// ─── Start server (local only) ────────────────────────────────────────────────
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("Database connected successfully");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  }
};

if (!IS_PRODUCTION && process.env.NODE_ENV !== "test") {
  startServer();
}

export default app;
