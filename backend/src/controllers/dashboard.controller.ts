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
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const isAdmin = req.user?.roles?.includes("admin");
    const currentUserName = req.user?.fullName ?? "";
    const currentFirstName = currentUserName.split(" ")[0] || currentUserName;

    // Build firstName -> fullName mapping from members table for owner resolution
    const activeMembers = await prisma.user.findMany({
      where: { isActive: true },
      select: { fullName: true },
    });
    const firstNameToFullName: Record<string, string> = {};
    for (const m of activeMembers) {
      const fn = m.fullName.split(" ")[0]?.toLowerCase();
      if (fn) firstNameToFullName[fn] = m.fullName;
    }
    // Map "Admin" first name to "Shirali Shetty"
    if (firstNameToFullName["admin"])
      firstNameToFullName["admin"] = "Shirali Shetty";

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
      invalidSourcingEmails,
    ] = await Promise.all([
      safe(() => prisma.buyer.count(), 0),
      safe(() => prisma.supplier.count(), 0),
      safe(() => prisma.user.count({ where: { isActive: true } }), 0),
      safe(() => prisma.report.count(), 0),
      safe(() => (prisma as any).deal.count(), 0),
      safe(() => (prisma as any).vaultDocument.count(), 0),
      safe(
        () =>
          (prisma as any).dailyTask.count({
            where: { status: { not: "Completed" } },
          }),
        0,
      ),
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
      safe(
        () =>
          (prisma as any).dailyTask.groupBy({
            by: ["owner", "status"],
            _count: { id: true },
            where: isAdmin
              ? { owner: { not: null, notIn: ["", "N/A", "n/a"] } }
              : {
                  OR: [
                    { owner: { equals: currentUserName, mode: "insensitive" } },
                    {
                      owner: { equals: currentFirstName, mode: "insensitive" },
                    },
                  ],
                },
          }),
        [],
      ),
      safe(() => (prisma as any).sourcingSupplier.count({ where: { status: "invalid" } }), 0),
    ]);

    // Process Task Analytics -- dedup by first name, display full name
    const rawTasks = tasksGrouped as Array<{
      owner: string;
      status: string;
      _count: { id: number };
    }>;
    // key = lowercased first name for deduplication; value stores display name + counts
    const taskAnalyticsMap: Record<
      string,
      {
        displayName: string;
        pending: number;
        inProgress: number;
        completed: number;
        closed: number;
        total: number;
      }
    > = {};

    for (const item of rawTasks) {
      if (!item.owner) continue;

      const ownerTrimmed = item.owner.trim();
      const ownerFirstName =
        ownerTrimmed.split(" ")[0]?.toLowerCase() || ownerTrimmed.toLowerCase();

      // Skip owners that don't match any active user — filters out orphaned/test data
      if (!firstNameToFullName[ownerFirstName]) continue;
      const status = (item.status || "").toLowerCase();
      const count = item._count.id;

      // Resolve to full name if available, otherwise use as-is
      const resolvedDisplayName =
        firstNameToFullName[ownerFirstName] || ownerTrimmed;

      if (!taskAnalyticsMap[ownerFirstName]) {
        taskAnalyticsMap[ownerFirstName] = {
          displayName: resolvedDisplayName,
          pending: 0,
          inProgress: 0,
          completed: 0,
          closed: 0,
          total: 0,
        };
      }
      // Always prefer the full name version as display name
      if (
        resolvedDisplayName.includes(" ") &&
        !taskAnalyticsMap[ownerFirstName].displayName.includes(" ")
      ) {
        taskAnalyticsMap[ownerFirstName].displayName = resolvedDisplayName;
      }

      taskAnalyticsMap[ownerFirstName].total += count;

      if (status === "inprogress") {
        taskAnalyticsMap[ownerFirstName].inProgress += count;
      } else if (status === "completed") {
        taskAnalyticsMap[ownerFirstName].completed += count;
      } else if (status === "closed") {
        taskAnalyticsMap[ownerFirstName].closed += count;
      } else {
        taskAnalyticsMap[ownerFirstName].pending += count;
      }
    }

    const taskAnalytics = Object.values(taskAnalyticsMap)
      .map(({ displayName, ...stats }) => ({ owner: displayName, ...stats }))
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
      invalidSourcingEmails,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
