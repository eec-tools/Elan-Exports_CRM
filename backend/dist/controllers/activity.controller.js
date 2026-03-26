import prisma from "../config/db.js";
/**
 * GET /api/activity
 * Returns last 100 activity logs with user names resolved
 */
export async function listActivity(req, res) {
    try {
        const { limit = "100", days } = req.query;
        const limitNum = Math.min(500, Math.max(1, parseInt(limit)));
        let gteDate = new Date();
        gteDate.setFullYear(gteDate.getFullYear() - 1); // default 1 year expiry
        let lteDate = new Date();
        if (days) {
            gteDate = new Date();
            gteDate.setDate(gteDate.getDate() - parseInt(days));
        }
        const where = {
            createdAt: {
                gte: gteDate,
                lte: lteDate,
            }
        };
        const logs = await prisma.activityLog.findMany({
            where,
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