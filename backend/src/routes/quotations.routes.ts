import { Router } from "express";
import {
    listQuotations,
    getQuotationStats,
    searchSuppliers,
    searchBuyers,
    getQuotation,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    regenerateToken,
    exportQuotationPdf,
    convertToDeal,
} from "../controllers/quotations.controller.js";
import { authenticate, requirePermission, requireEdit } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission(["suppliers", "quotations"]));

router.get("/", listQuotations);
router.get("/stats", getQuotationStats);
router.get("/search-suppliers", searchSuppliers);
router.get("/search-buyers", searchBuyers);
router.get("/:id", getQuotation);
router.get("/:id/export-pdf", exportQuotationPdf);

router.post("/", requireEdit(["suppliers", "quotations"]), createQuotation);
router.post("/:id/regenerate-token", requireEdit(["suppliers", "quotations"]), regenerateToken);
router.post("/:id/convert-to-deal", requireEdit(["suppliers", "quotations"]), convertToDeal);
router.put("/:id", requireEdit(["suppliers", "quotations"]), updateQuotation);
router.delete("/:id", requireEdit(["suppliers", "quotations"]), deleteQuotation);

export default router;
