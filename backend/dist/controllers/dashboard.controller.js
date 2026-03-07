import prisma from "../config/db.js";
/**
 * GET /api/dashboard/stats
 */
export async function getDashboardStats(_req, res) {
    try {
        const [totalBuyers, totalSuppliers, activeUsers, totalReports] = await Promise.all([
            prisma.buyer.count(),
            prisma.supplier.count(),
            prisma.user.count({ where: { isActive: true } }),
            prisma.report.count(),
        ]);
        res.json({
            totalBuyers,
            totalSuppliers,
            activeUsers,
            totalReports,
        });
    }
    catch (err) {
        console.error("Dashboard stats error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
//# sourceMappingURL=dashboard.controller.js.map