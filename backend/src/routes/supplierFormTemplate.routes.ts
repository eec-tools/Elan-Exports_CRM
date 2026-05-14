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

router.use(authenticate, requirePermission(["suppliers", "sourcing_suppliers"]));

router.get("/", listTemplates);
router.get("/:id", getTemplate);

router.post("/", requireEdit(["suppliers", "sourcing_suppliers"]), createTemplate);
router.put("/:id", requireEdit(["suppliers", "sourcing_suppliers"]), updateTemplate);
router.delete("/:id", requireEdit(["suppliers", "sourcing_suppliers"]), deleteTemplate);

export default router;
