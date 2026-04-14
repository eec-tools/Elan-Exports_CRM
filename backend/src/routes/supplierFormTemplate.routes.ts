import { Router } from "express";
import {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
} from "../controllers/supplierFormTemplate.controller.js";
import { authenticate, requirePermission, requireEdit } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission("suppliers"));

router.get("/", listTemplates);
router.get("/:id", getTemplate);

router.post("/", requireEdit("suppliers"), createTemplate);
router.put("/:id", requireEdit("suppliers"), updateTemplate);
router.delete("/:id", requireEdit("suppliers"), deleteTemplate);

export default router;
