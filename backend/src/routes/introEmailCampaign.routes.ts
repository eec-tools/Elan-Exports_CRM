import { Router } from "express";
import {
  listCampaigns,
  getDueCampaigns,
  getCampaignStats,
  getCampaign,
  startCampaign,
  markEmailSent,
  markResponseReceived,
} from "../controllers/introEmailCampaign.controller.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission("suppliers"));

router.get("/", listCampaigns);
router.get("/due", getDueCampaigns);
router.get("/stats", getCampaignStats);
router.get("/:id", getCampaign);
router.post("/:id/start", startCampaign);
router.post("/:id/mark-sent", markEmailSent);
router.post("/:id/mark-response", markResponseReceived);

export default router;
