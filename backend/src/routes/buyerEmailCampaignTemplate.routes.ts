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

router.use(authenticate, requirePermission("buyers"));

router.get("/default-content", getBuyerDefaultContent);
router.get("/",   listBuyerEmailTemplates);
router.get("/:id", getBuyerEmailTemplate);
router.post("/",   requireEdit("buyers"), createBuyerEmailTemplate);
router.put("/:id", requireEdit("buyers"), updateBuyerEmailTemplate);
router.delete("/:id", requireEdit("buyers"), deleteBuyerEmailTemplate);

export default router;
