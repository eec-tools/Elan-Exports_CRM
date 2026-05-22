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
} from "../controllers/sourcingEmailCampaign.controller.js";
import { authenticate, requirePermission, requireEdit, requireAdmin } from "../middleware/auth.js";
import { autoSendDueFollowups } from "../services/emailCampaignScheduler.js";

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

router.post("/admin/run-scheduler", requireAdmin, async (req: Request, res: Response) => {
    res.json({ message: "Scheduler triggered — follow-ups will be sent now." });
    await autoSendDueFollowups();
});

export default router;
