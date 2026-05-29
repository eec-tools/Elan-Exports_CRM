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
import newSuppliersRoutes from "./routes/newSuppliers.routes.js";
import membersRoutes from "./routes/members.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import accessRequestsRoutes from "./routes/accessRequests.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import emailTasksRoutes from "./routes/emailTasks.routes.js";
import vaultRoutes from "./routes/vault.routes.js";
import dailyTaskRoutes from "./routes/dailyTask.routes.js";
import dealsRoutes from "./routes/deals.routes.js";
import complianceRoutes from "./routes/compliance.routes.js";
import introEmailCampaignRoutes from "./routes/introEmailCampaign.routes.js";
import newSupplierEmailCampaignRoutes from "./routes/newSupplierEmailCampaign.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import { startEmailCampaignScheduler } from "./services/emailCampaignScheduler.js";
import { startGmailInboxScheduler } from "./services/gmailInboxScheduler.js";
import { startGmailReplyDetector } from "./services/gmailReplyDetector.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import { startAttendanceScheduler } from "./services/attendanceScheduler.js";
import activityTrackingRoutes from "./routes/activityTracking.routes.js";
import employeesRoutes from "./routes/employees.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import payrollRoutes from "./routes/payroll.routes.js";
import sourcingSuppliersRoutes from "./routes/sourcingSuppliers.routes.js";
import sourcingVaultRoutes from "./routes/sourcingVault.routes.js";
import buyersVaultRoutes from "./routes/buyersVault.routes.js";
import sourcingEmailCampaignRoutes from "./routes/sourcingEmailCampaign.routes.js";
import sourcingBuyersRoutes from "./routes/sourcingBuyers.routes.js";
import sourcingBuyerEmailCampaignRoutes from "./routes/sourcingBuyerEmailCampaign.routes.js";
import buyerEmailCampaignTemplateRoutes from "./routes/buyerEmailCampaignTemplate.routes.js";
import gmailRoutes from "./routes/gmail.routes.js";
import emailSignaturesRoutes from "./routes/emailSignatures.routes.js";
import supplierFormTemplateRoutes from "./routes/supplierFormTemplate.routes.js";
import emailCampaignTemplateRoutes from "./routes/emailCampaignTemplate.routes.js";
import publicSupplierFormRoutes from "./routes/publicSupplierForm.routes.js";
import quotationsRoutes from "./routes/quotations.routes.js";
import publicQuotationFormRoutes from "./routes/publicQuotationForm.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import shortLinksRoutes from "./routes/shortLinks.routes.js";
import emailSettingsRoutes from "./routes/emailSettings.routes.js";
import holidayRoutes from "./routes/holiday.routes.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Global Middleware ──────────────────────────────

// Trust proxy for rate limiting behind reverse proxies (AWS ALB, etc.)
app.set("trust proxy", 1);

// Security headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// CORS configuration
const hardcodedOrigins = [
  "http://localhost:5173",
  "http://elan-exports-s3.s3-website.ap-south-1.amazonaws.com",
  "https://d2f9ltld390jy8.cloudfront.net",
  "https://dtbfqaoo30d2u.cloudfront.net",
  "https://crm.eectrade.com",
];

const envOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
  : [];

const allowedOrigins = [...new Set([...hardcodedOrigins, ...envOrigins])];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, mobile apps)
    if (!origin) return callback(null, true);

    // Always allow localhost for development (any port)
    if (/^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }

    // Check against allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 600, // 10 minutes
};

app.use(cors(corsOptions));

// Handle preflight requests using the same CORS options
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 1000 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // strict limit only on login attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts, please try again later.",
});

app.use("/api/", limiter);
app.use("/api/auth/login", authLimiter);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ─── API Routes ─────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/buyers", buyersRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/old-suppliers", oldSuppliersRoutes);
app.use("/api/new-suppliers", newSuppliersRoutes);
app.use("/api/members", membersRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/access-requests", accessRequestsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/email-tasks", emailTasksRoutes);
app.use("/api/vault", vaultRoutes);
app.use("/api/daily-tasks", dailyTaskRoutes);
app.use("/api/deals", dealsRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/intro-campaigns", introEmailCampaignRoutes);
app.use("/api/new-supplier-campaigns", newSupplierEmailCampaignRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/activity-tracking", activityTrackingRoutes);
app.use("/api/admin/employees", employeesRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/sourcing-suppliers", sourcingSuppliersRoutes);
app.use("/api/sourcing-vault", sourcingVaultRoutes);
app.use("/api/buyers-vault", buyersVaultRoutes);
app.use("/api/sourcing-campaigns", sourcingEmailCampaignRoutes);
app.use("/api/sourcing-buyers", sourcingBuyersRoutes);
app.use("/api/buyer-campaigns", sourcingBuyerEmailCampaignRoutes);
app.use("/api/buyer-email-templates", buyerEmailCampaignTemplateRoutes);
app.use("/api/gmail", gmailRoutes);
app.use("/api/email-signatures", emailSignaturesRoutes);
app.use("/api/supplier-form-templates", supplierFormTemplateRoutes);
app.use("/api/email-campaign-templates", emailCampaignTemplateRoutes);
app.use("/api/public/supplier-form", publicSupplierFormRoutes);
app.use("/api/quotations", quotationsRoutes);
app.use("/api/public/quotation-form", publicQuotationFormRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/f", shortLinksRoutes);
app.use("/api/email-settings", emailSettingsRoutes);
app.use("/api/holidays", holidayRoutes);

// Health check with detailed status
app.get("/api/health", async (_req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    cors: {
      allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : ["localhost only"],
    },
  };

  // Check database connection
  try {
    await import("./config/db.js").then((db) => db.default.$queryRaw`SELECT 1`);
    (health as any).database = "connected";
  } catch (error) {
    (health as any).database = "disconnected";
    (health as any).status = "degraded";
  }

  res.json(health);
});

// ─── Error Handler ──────────────────────────────────

app.use(errorHandler);

// ─── Start Server ───────────────────────────────────

// Validate required environment variables
function validateEnvironment() {
  const required = ["DATABASE_URL", "JWT_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
    console.warn("⚠️  Warning: FRONTEND_URL not set in production. CORS may not work correctly.");
  }
}

validateEnvironment();

app.listen(PORT, () => {
  console.log(`Élan Exports CRM API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ") || "localhost only"}`);
  startEmailCampaignScheduler();
  startAttendanceScheduler();
  startGmailInboxScheduler();
  startGmailReplyDetector();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  process.exit(0);
});

// Prevent unhandled promise rejections (e.g. Cloudinary upload failures)
// from crashing the process and dropping all active SSE + in-flight requests.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (caught to prevent crash):", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (caught to prevent crash):", err);
});

export default app;
