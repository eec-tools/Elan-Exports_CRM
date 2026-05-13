import { Router } from "express";
import {
    listEmailTemplates,
    getEmailTemplate,
    getDefaultContent,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
} from "../controllers/emailCampaignTemplate.controller.js";
import { authenticate, requirePermission, requireEdit } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission(["suppliers", "sourcing_suppliers"]));

router.get("/", listEmailTemplates);
router.get("/default-content", getDefaultContent);
router.get("/:id", getEmailTemplate);

router.post("/", requireEdit(["suppliers", "sourcing_suppliers"]), createEmailTemplate);
router.put("/:id", requireEdit(["suppliers", "sourcing_suppliers"]), updateEmailTemplate);
router.delete("/:id", requireEdit(["suppliers", "sourcing_suppliers"]), deleteEmailTemplate);

export default router;
