import { Router } from "express";
import {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  exportSuppliersCsv,
} from "../controllers/suppliers.controller.js";
import {
  authenticate,
  requirePermission,
  requireEdit,
} from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission("suppliers"));

router.get("/", listSuppliers);
router.get("/export/csv", exportSuppliersCsv);
router.get("/:id", getSupplier);

router.post("/", requireEdit("suppliers"), createSupplier);
router.put("/:id", requireEdit("suppliers"), updateSupplier);
router.delete("/:id", requireEdit("suppliers"), deleteSupplier);

export default router;
