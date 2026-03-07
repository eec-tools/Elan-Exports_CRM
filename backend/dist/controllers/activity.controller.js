import prisma from "../config/db.js";
/**
 * GET /api/activity
 * Returns last 100 activity logs with user names resolved
 */
export async function listActivity(req, res) {
    try {
        const { limit = "100" } = req.query;
        const limitNum = Math.min(500, Math.max(1, parseInt(limit)));
        const logs = await prisma.activityLog.findMany({
            take: limitNum,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { fullName: true, email: true } },
            },
        });
        res.json(logs);
    }
    catch (err) {
        console.error("List activity error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
//# sourceMappingURL=activity.controller.js.map