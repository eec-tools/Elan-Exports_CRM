import { Router } from "express";
import {
  listOldSuppliers,
  getOldSupplier,
  createOldSupplier,
  updateOldSupplier,
  deleteOldSupplier,
  exportOldSuppliersCsv,
  getOldSupplierFilters,
  updateOldSupplierStage,
} from "../controllers/oldSuppliers.controller.js";
import {
  authenticate,
  requirePermission,
  requireEdit,
} from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission(["suppliers", "old_suppliers"]));

router.get("/", listOldSuppliers);
router.get("/filters", getOldSupplierFilters);
router.get("/export/csv", exportOldSuppliersCsv);
router.get("/:id", getOldSupplier);

router.post("/", requireEdit(["suppliers", "old_suppliers"]), createOldSupplier);
router.put("/:id", requireEdit(["suppliers", "old_suppliers"]), updateOldSupplier);
router.patch("/:id/stage", requireEdit(["suppliers", "old_suppliers"]), updateOldSupplierStage);
router.delete("/:id", requireEdit(["suppliers", "old_suppliers"]), deleteOldSupplier);

export default router;
