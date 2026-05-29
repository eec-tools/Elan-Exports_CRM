import { Router } from "express";
import { authenticate, requirePermission, requireEdit } from "../middleware/auth.js";
import {
    listBuyerEmailTemplates,
    getBuyerEmailTemplate,
    getBuyerDefaultContent,
    createBuyerEmailTemplate,
    updateBuyerEmailTemplate,
    deleteBuyerEmailTemplate,
} from "../controllers/buyerEmailCampaignTemplate.controller.js";

const router = Router();

router.use(authenticate, requirePermission("sourcing_buyers"));

router.get("/default-content", getBuyerDefaultContent);
router.get("/",   listBuyerEmailTemplates);
router.get("/:id", getBuyerEmailTemplate);
router.post("/",   requireEdit("sourcing_buyers"), createBuyerEmailTemplate);
router.put("/:id", requireEdit("sourcing_buyers"), updateBuyerEmailTemplate);
router.delete("/:id", requireEdit("sourcing_buyers"), deleteBuyerEmailTemplate);

export default router;
