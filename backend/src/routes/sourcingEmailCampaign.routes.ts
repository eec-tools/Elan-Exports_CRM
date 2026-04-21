import { Router } from "express";
import {
    listCampaigns,
    getDueCampaigns,
    getCampaign,
    startCampaign,
    sendFollowup,
    markEmailSent,
    markResponseReceived,
} from "../controllers/sourcingEmailCampaign.controller.js";
import { authenticate, requirePermission, requireEdit } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission("suppliers"));

router.get("/", listCampaigns);
router.get("/due", getDueCampaigns);
router.get("/:id", getCampaign);

router.post("/:id/start", requireEdit("suppliers"), startCampaign);
router.post("/:id/send-followup", requireEdit("suppliers"), sendFollowup);
router.post("/:id/mark-sent", requireEdit("suppliers"), markEmailSent);   // legacy alias
router.post("/:id/mark-response", requireEdit("suppliers"), markResponseReceived);

export default router;
