import { Router } from "express";
import {
    listSourcingSuppliers,
    getSourcingSupplierStats,
    getSourcingCategoryStats,
    getSourcingCreators,
    getSourcingSupplier,
    createSourcingSupplier,
    updateSourcingSupplier,
    deleteSourcingSupplier,
    convertToNewSupplier,
    bulkCreateSourcingSuppliers,
    getVaultFolderNotSent,
    addFromVaultFolder,
    toggleContactedSupplier,
} from "../controllers/sourcingSuppliers.controller.js";
import { authenticate, requirePermission, requireEdit } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission(["suppliers", "sourcing_suppliers"]));

router.get("/", listSourcingSuppliers);
router.get("/stats", getSourcingSupplierStats);
router.get("/category-stats", getSourcingCategoryStats);
router.get("/creators", getSourcingCreators);
router.get("/from-folder", getVaultFolderNotSent);
router.get("/:id", getSourcingSupplier);

router.post("/", requireEdit(["suppliers", "sourcing_suppliers"]), createSourcingSupplier);
router.post("/bulk-create", requireEdit(["suppliers", "sourcing_suppliers"]), bulkCreateSourcingSuppliers);
router.post("/from-folder", requireEdit(["suppliers", "sourcing_suppliers"]), addFromVaultFolder);
router.post("/:id/convert", requireEdit(["suppliers", "sourcing_suppliers"]), convertToNewSupplier);
router.patch("/:id/contacted", requireEdit(["suppliers", "sourcing_suppliers"]), toggleContactedSupplier);
router.put("/:id", requireEdit(["suppliers", "sourcing_suppliers"]), updateSourcingSupplier);
router.delete("/:id", requireEdit(["suppliers", "sourcing_suppliers"]), deleteSourcingSupplier);

export default router;
