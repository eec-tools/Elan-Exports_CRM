import { Router, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { AuthRequest } from "../types/index.js";
import {
  runDailyReport,
  runWeeklyReport,
  runMonthlyReport,
  runMissedReports,
} from "../services/dailyReportScheduler.js";

const router = Router();
router.use(authenticate);

/**
 * POST /api/cron-reports/run-missed
 * Re-runs the missed-report catch-up immediately (force mode, bypasses time check).
 * Useful when reports failed or vault entries have no fileUrl.
 */
router.post("/run-missed", async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user as any;
  if (!user?.roles?.includes("admin")) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  res.json({ message: "Catch-up started — reports will regenerate in the background." });

  runMissedReports({ force: true }).catch((err) =>
    console.error("[CronReport] Manual run-missed failed:", err),
  );
});

/**
 * POST /api/cron-reports/trigger/:type
 * Manually trigger a specific report type (daily | weekly | monthly).
 */
router.post("/trigger/:type", async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user as any;
  if (!user?.roles?.includes("admin")) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const { type } = req.params as { type: string };
  if (type !== "daily" && type !== "weekly" && type !== "monthly") {
    res.status(400).json({ error: "type must be daily, weekly, or monthly" });
    return;
  }

  res.json({ message: `${type} report started in background.` });

  const fn = type === "daily" ? runDailyReport : type === "weekly" ? runWeeklyReport : runMonthlyReport;
  fn().catch((err) => console.error(`[CronReport] Manual ${type} trigger failed:`, err));
});

export default router;
