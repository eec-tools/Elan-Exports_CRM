import { Router, Request, Response } from "express";
import {
    listCampaigns,
    getDueCampaigns,
    getCampaign,
    startCampaign,
    sendFollowup,
    markResponseReceived,
    getSourceReplies,
    syncReplies,
    startCampaignForBuyer,
} from "../controllers/sourcingBuyerEmailCampaign.controller.js";
import { authenticate, requirePermission, requireEdit, requireAdmin } from "../middleware/auth.js";
import { autoSendDueBuyerFollowups } from "../services/emailCampaignScheduler.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const EMAIL_SEND_DELAY_MS = 2 * 60 * 1000;

const router = Router();

router.use(authenticate, requirePermission("buyers"));

router.get("/", listCampaigns);
router.get("/due", getDueCampaigns);
router.get("/:id", getCampaign);
router.get("/:id/replies", getSourceReplies);
router.post("/:id/sync-replies", syncReplies);

router.post("/:id/start", requireEdit("buyers"), startCampaign);
router.post("/:id/send-followup", requireEdit("buyers"), sendFollowup);
router.post("/:id/mark-response", requireEdit("buyers"), markResponseReceived);

router.post("/admin/run-scheduler", requireAdmin, async (_req: Request, res: Response) => {
    res.json({ message: "Buyer scheduler triggered — overdue follow-ups are being sent now." });
    await autoSendDueBuyerFollowups();
});

router.post("/admin/retry-pending", requireAdmin, async (req: Request, res: Response) => {
    const prisma = (await import("../config/db.js")).default;
    const pending = await (prisma as any).sourcingBuyer.findMany({
        where: {
            status: "pending",
            email: { not: null },
            emailCampaign: null,
        },
        select: { id: true },
    });

    res.json({ total: pending.length, sending: true });

    const userId = (req as any).user?.id;
    (async () => {
        let started = 0;
        for (let i = 0; i < pending.length; i++) {
            const ok = await startCampaignForBuyer(pending[i].id, userId);
            if (ok) started++;
            if (i < pending.length - 1) await sleep(EMAIL_SEND_DELAY_MS);
        }
        console.log(`[buyer retry-pending] Background send complete: ${started}/${pending.length}`);
    })().catch((err) => console.error("[buyer retry-pending] Background send error:", err));
});

export default router;
