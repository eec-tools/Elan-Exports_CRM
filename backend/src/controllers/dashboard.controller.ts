import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

// Wraps a Prisma query so a missing table / undefined model returns a fallback
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * GET /api/dashboard/stats
 */
export async function getDashboardStats(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const [
      totalBuyers,
      totalSuppliers,
      activeUsers,
      totalReports,
      totalDeals,
      totalVaultDocs,
      pendingTasks,
      recentDeals,
      tasksGrouped,
    ] = await Promise.all([
      safe(() => prisma.buyer.count(), 0),
      safe(() => prisma.supplier.count(), 0),
      safe(() => prisma.user.count({ where: { isActive: true } }), 0),
      safe(() => prisma.report.count(), 0),
      safe(() => (prisma as any).deal.count(), 0),
      safe(() => (prisma as any).vaultDocument.count(), 0),
      safe(() => (prisma as any).dailyTask.count({ where: { status: { not: "Completed" } } }), 0),
      safe(async () => {
        const allDeals = await (prisma as any).deal.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            buyer: true,
            stage: true,
            expectedRevenue: true,
            probability: true,
            riskScore: true,
            createdAt: true,
          },
        });
        // Group by stage, keep up to 3 latest per stage
        const byStage: Record<string, any[]> = {};
        for (const deal of allDeals) {
          if (!byStage[deal.stage]) byStage[deal.stage] = [];
          if (byStage[deal.stage].length < 3) byStage[deal.stage].push(deal);
        }
        return Object.values(byStage).flat();
      }, []),
      safe(() =>
        (prisma as any).dailyTask.groupBy({
          by: ["owner", "status"],
          _count: { id: true },
          where: {
            owner: {
              not: null,
              notIn: ["", "N/A", "n/a"]
            }
          },
        }), []
      ),
    ]);

    // Process Task Analytics
    const rawTasks = tasksGrouped as Array<{ owner: string; status: string; _count: { id: number } }>;
    const taskAnalyticsMap: Record<string, { pending: number; inProgress: number; completed: number; closed: number; total: number }> = {};

    for (const item of rawTasks) {
      if (!item.owner) continue;

      const owner = item.owner;
      const status = (item.status || "").toLowerCase();
      const count = item._count.id;

      if (!taskAnalyticsMap[owner]) {
        taskAnalyticsMap[owner] = { pending: 0, inProgress: 0, completed: 0, closed: 0, total: 0 };
      }

      taskAnalyticsMap[owner].total += count;

      if (status === "inprogress") {
        taskAnalyticsMap[owner].inProgress += count;
      } else if (status === "completed") {
        taskAnalyticsMap[owner].completed += count;
      } else if (status === "closed") {
        taskAnalyticsMap[owner].closed += count;
      } else {
        taskAnalyticsMap[owner].pending += count; // handles "not started" and any other unrecognized ones mapped to pending
      }
    }

    const taskAnalytics = Object.entries(taskAnalyticsMap)
      .map(([owner, stats]) => ({ owner, ...stats }))
      .sort((a, b) => b.total - a.total); // Sort by total tasks descending

    res.json({
      totalBuyers,
      totalSuppliers,
      activeUsers,
      totalReports,
      totalDeals,
      totalVaultDocs,
      pendingTasks,
      recentDeals,
      taskAnalytics,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
