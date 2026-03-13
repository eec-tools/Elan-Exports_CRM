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
      dealsByStage,
      pipelineRevenue,
      recentDeals,
    ] = await Promise.all([
      safe(() => prisma.buyer.count(), 0),
      safe(() => prisma.supplier.count(), 0),
      safe(() => prisma.user.count({ where: { isActive: true } }), 0),
      safe(() => prisma.report.count(), 0),
      safe(() => (prisma as any).deal.count(), 0),
      safe(() => (prisma as any).vaultDocument.count(), 0),
      safe(() => (prisma as any).dailyTask.count({ where: { status: { not: "Completed" } } }), 0),
      safe(() =>
        (prisma as any).deal.groupBy({
          by: ["stage"],
          _count: { id: true },
          _sum: { expectedRevenue: true },
        }), []
      ),
      safe(() => (prisma as any).deal.aggregate({ _sum: { expectedRevenue: true } }), { _sum: { expectedRevenue: 0 } }),
      safe(() =>
        (prisma as any).deal.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
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
        }), []
      ),
    ]);

    const STAGE_ORDER = [
      "LEAD", "RFQ", "SAMPLE", "NEGOTIATION", "CONTRACT", "CLOSED_WON", "CLOSED_LOST",
    ];

    const stagesRaw = dealsByStage as Array<{ stage: string; _count: { id: number }; _sum: { expectedRevenue: number | null } }>;

    const pipeline = STAGE_ORDER.map((stage) => {
      const found = stagesRaw.find((d) => d.stage === stage);
      return {
        stage,
        count: found?._count.id ?? 0,
        revenue: found?._sum.expectedRevenue ?? 0,
      };
    }).filter((s) => s.count > 0);

    const revenue = (pipelineRevenue as any)?._sum?.expectedRevenue ?? 0;

    res.json({
      totalBuyers,
      totalSuppliers,
      activeUsers,
      totalReports,
      totalDeals,
      totalVaultDocs,
      pendingTasks,
      totalPipelineRevenue: revenue,
      pipeline,
      recentDeals,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
