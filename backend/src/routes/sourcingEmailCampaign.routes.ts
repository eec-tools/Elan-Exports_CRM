import { Router, Request, Response } from "express";
import {
    listCampaigns,
    getDueCampaigns,
    getCampaign,
    startCampaign,
    sendFollowup,
    markEmailSent,
    markResponseReceived,
    getSourceReplies,
    syncReplies,
    startCampaignForSupplier,
} from "../controllers/sourcingEmailCampaign.controller.js";
import { authenticate, requirePermission, requireEdit, requireAdmin } from "../middleware/auth.js";
import { autoSendDueFollowups } from "../services/emailCampaignScheduler.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const EMAIL_SEND_DELAY_MS = 2 * 60 * 1000;

const router = Router();

router.use(authenticate, requirePermission("suppliers"));

router.get("/", listCampaigns);
router.get("/due", getDueCampaigns);
router.get("/:id", getCampaign);
router.get("/:id/replies", getSourceReplies);
router.post("/:id/sync-replies", syncReplies);

router.post("/:id/start", requireEdit("suppliers"), startCampaign);
router.post("/:id/send-followup", requireEdit("suppliers"), sendFollowup);
router.post("/:id/mark-sent", requireEdit("suppliers"), markEmailSent);
router.post("/:id/mark-response", requireEdit("suppliers"), markResponseReceived);

router.post("/admin/run-scheduler", requireAdmin, async (_req: Request, res: Response) => {
    res.json({ message: "Scheduler triggered — follow-ups will be sent now." });
    await autoSendDueFollowups();
});

router.post("/admin/retry-pending", requireAdmin, async (req: Request, res: Response) => {
    const prisma = (await import("../config/db.js")).default;
    const pending = await (prisma as any).sourcingSupplier.findMany({
        where: {
            status: "pending",
            assignedGmailAccount: { not: null },
            email: { not: null },
            emailCampaign: null,
        },
        select: { id: true },
    });

    // Respond immediately — emails are sent in the background
    res.json({ total: pending.length, sending: true });

    const userId = (req as any).user?.id;
    (async () => {
        let started = 0;
        for (let i = 0; i < pending.length; i++) {
            const ok = await startCampaignForSupplier(pending[i].id, userId);
            if (ok) started++;
            if (i < pending.length - 1) {
                await sleep(EMAIL_SEND_DELAY_MS);
            }
        }
        console.log(`[retry-pending] Background send complete: ${started}/${pending.length}`);
    })().catch((err) => console.error("[retry-pending] Background send error:", err));
});

export default router;
