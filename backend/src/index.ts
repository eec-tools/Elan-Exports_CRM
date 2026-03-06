import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

import { errorHandler } from "./middleware/errorHandler.js";

// Route imports
import authRoutes from "./routes/auth.routes.js";
import buyersRoutes from "./routes/buyers.routes.js";
import suppliersRoutes from "./routes/suppliers.routes.js";
import oldSuppliersRoutes from "./routes/oldSuppliers.routes.js";
import membersRoutes from "./routes/members.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import accessRequestsRoutes from "./routes/accessRequests.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import emailTasksRoutes from "./routes/emailTasks.routes.js";
import vaultRoutes from "./routes/vault.routes.js";
import dailyTaskRoutes from "./routes/dailyTask.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Global Middleware ──────────────────────────────

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman)
      if (!origin) return callback(null, true);
      // In development, allow any localhost port
      if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
      // In production, check against FRONTEND_URL
      if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)
        return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ─── API Routes ─────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/buyers", buyersRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/old-suppliers", oldSuppliersRoutes);
app.use("/api/members", membersRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/access-requests", accessRequestsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/email-tasks", emailTasksRoutes);
app.use("/api/vault", vaultRoutes);
app.use("/api/daily-tasks", dailyTaskRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Error Handler ──────────────────────────────────

app.use(errorHandler);

// ─── Start Server ───────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 Élan Exports CRM API running on http://localhost:${PORT}`);
  console.log(`📚 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
