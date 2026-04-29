import { Router } from "express";
import {
  listSuppliers,
  listSuppliersForDropdown,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  exportSuppliersCsv,
  uploadCatalog,
  uploadSupplierFile,
  getUploadSignature,
  getSupplierStats,
  getSupplierFilters,
  updateSupplierStage,
} from "../controllers/suppliers.controller.js";
import {
  authenticate,
  requirePermission,
  requireEdit,
} from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission(["suppliers", "signed_suppliers"]));

router.get("/", listSuppliers);
router.get("/list", listSuppliersForDropdown);
router.get("/stats", getSupplierStats);
router.get("/filters", getSupplierFilters);
router.get("/export/csv", exportSuppliersCsv);
router.get("/:id", getSupplier);

router.get("/upload-signature", requireEdit(["suppliers", "signed_suppliers"]), getUploadSignature);
router.post("/upload", requireEdit(["suppliers", "signed_suppliers"]), uploadSupplierFile.single("file"), uploadCatalog);
router.post("/", requireEdit(["suppliers", "signed_suppliers"]), createSupplier);
router.put("/:id", requireEdit(["suppliers", "signed_suppliers"]), updateSupplier);
router.patch("/:id/stage", requireEdit(["suppliers", "signed_suppliers"]), updateSupplierStage);
router.delete("/:id", requireEdit(["suppliers", "signed_suppliers"]), deleteSupplier);

export default router;
