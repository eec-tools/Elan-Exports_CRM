import { Router } from "express";
import {
    listQuotations,
    getQuotationStats,
    searchSuppliers,
    getQuotation,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    regenerateToken,
    exportQuotationPdf,
} from "../controllers/quotations.controller.js";
import { authenticate, requirePermission, requireEdit } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission("suppliers"));

router.get("/", listQuotations);
router.get("/stats", getQuotationStats);
router.get("/search-suppliers", searchSuppliers);
router.get("/:id", getQuotation);
router.get("/:id/export-pdf", exportQuotationPdf);

router.post("/", requireEdit("suppliers"), createQuotation);
router.post("/:id/regenerate-token", requireEdit("suppliers"), regenerateToken);
router.put("/:id", requireEdit("suppliers"), updateQuotation);
router.delete("/:id", requireEdit("suppliers"), deleteQuotation);

export default router;
