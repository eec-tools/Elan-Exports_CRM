import { Router } from "express";
import {
    listNewSuppliers,
    listNewSuppliersForDropdown,
    getNewSupplier,
    createNewSupplier,
    updateNewSupplier,
    deleteNewSupplier,
    exportNewSuppliersCsv,
    getNewSupplierFilters,
    updateNewSupplierStage,
    uploadNewSupplierCatalog,
    uploadNewSupplierFile,
} from "../controllers/newSuppliers.controller.js";
import {
    authenticate,
    requirePermission,
    requireEdit,
} from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission(["suppliers", "new_suppliers"]));

router.get("/", listNewSuppliers);
router.get("/list", listNewSuppliersForDropdown);
router.get("/filters", getNewSupplierFilters);
router.get("/export/csv", exportNewSuppliersCsv);
router.get("/:id", getNewSupplier);

router.post("/upload", requireEdit(["suppliers", "new_suppliers"]), uploadNewSupplierFile.single("file"), uploadNewSupplierCatalog);
router.post("/", requireEdit(["suppliers", "new_suppliers"]), createNewSupplier);
router.put("/:id", requireEdit(["suppliers", "new_suppliers"]), updateNewSupplier);
router.patch("/:id/stage", requireEdit(["suppliers", "new_suppliers"]), updateNewSupplierStage);
router.delete("/:id", requireEdit(["suppliers", "new_suppliers"]), deleteNewSupplier);

export default router;
