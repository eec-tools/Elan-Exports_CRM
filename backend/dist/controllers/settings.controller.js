import prisma from "../config/db.js";
/**
 * GET /api/settings/:key
 */
export async function getSetting(req, res) {
    try {
        const setting = await prisma.appSetting.findUnique({
            where: { key: req.params.key },
        });
        if (!setting) {
            res.status(404).json({ error: "Setting not found" });
            return;
        }
        res.json({ key: setting.key, value: setting.value });
    }
    catch (err) {
        console.error("Get setting error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * PUT /api/settings/:key
 */
export async function updateSetting(req, res) {
    try {
        const { value } = req.body;
        const key = req.params.key;
        const setting = await prisma.appSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
        res.json({ key: setting.key, value: setting.value });
    }
    catch (err) {
        console.error("Update setting error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
//# sourceMappingURL=settings.controller.js.map