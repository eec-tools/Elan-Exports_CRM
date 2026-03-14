import prisma from "../config/db.js";
// Wraps a Prisma query so a missing table / undefined model returns a fallback
async function safe(fn, fallback) {
    try {
        return await fn();
    }
    catch {
        return fallback;
    }
}
/**
 * GET /api/dashboard/stats
 */
export async function getDashboardStats(_req, res) {
    try {
        const [totalBuyers, totalSuppliers, activeUsers, totalReports, totalDeals, totalVaultDocs, pendingTasks, dealsByStage, pipelineRevenue, recentDeals, tasksGrouped,] = await Promise.all([
            safe(() => prisma.buyer.count(), 0),
            safe(() => prisma.supplier.count(), 0),
            safe(() => prisma.user.count({ where: { isActive: true } }), 0),
            safe(() => prisma.report.count(), 0),
            safe(() => prisma.deal.count(), 0),
            safe(() => prisma.vaultDocument.count(), 0),
            safe(() => prisma.dailyTask.count({ where: { status: { not: "Completed" } } }), 0),
            safe(() => prisma.deal.groupBy({
                by: ["stage"],
                _count: { id: true },
                _sum: { expectedRevenue: true },
            }), []),
            safe(() => prisma.deal.aggregate({ _sum: { expectedRevenue: true } }), { _sum: { expectedRevenue: 0 } }),
            safe(() => prisma.deal.findMany({
                orderBy: { createdAt: "desc" },
                take: 2,
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
            }), []),
            safe(() => prisma.dailyTask.groupBy({
                by: ["owner", "status"],
                _count: { id: true },
                where: {
                    owner: {
                        not: null,
                        notIn: ["", "N/A", "n/a"]
                    }
                },
            }), []),
        ]);
        const STAGE_ORDER = [
            "LEAD", "RFQ", "SAMPLE", "NEGOTIATION", "CONTRACT", "CLOSED_WON", "CLOSED_LOST",
        ];
        const stagesRaw = dealsByStage;
        const pipeline = STAGE_ORDER.map((stage) => {
            const found = stagesRaw.find((d) => d.stage === stage);
            return {
                stage,
                count: found?._count.id ?? 0,
                revenue: found?._sum.expectedRevenue ?? 0,
            };
        }).filter((s) => s.count > 0);
        const revenue = pipelineRevenue?._sum?.expectedRevenue ?? 0;
        // Process Task Analytics
        const rawTasks = tasksGrouped;
        const taskAnalyticsMap = {};
        for (const item of rawTasks) {
            if (!item.owner)
                continue;
            const owner = item.owner;
            const status = (item.status || "").toLowerCase();
            const count = item._count.id;
            if (!taskAnalyticsMap[owner]) {
                taskAnalyticsMap[owner] = { pending: 0, inProgress: 0, completed: 0, closed: 0, total: 0 };
            }
            taskAnalyticsMap[owner].total += count;
            if (status === "inprogress") {
                taskAnalyticsMap[owner].inProgress += count;
            }
            else if (status === "completed") {
                taskAnalyticsMap[owner].completed += count;
            }
            else if (status === "closed") {
                taskAnalyticsMap[owner].closed += count;
            }
            else {
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
            totalPipelineRevenue: revenue,
            pipeline,
            recentDeals,
            taskAnalytics,
        });
    }
    catch (err) {
        console.error("Dashboard stats error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
//# sourceMappingURL=dashboard.controller.js.map