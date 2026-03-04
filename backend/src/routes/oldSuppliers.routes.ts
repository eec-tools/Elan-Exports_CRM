import { Router } from "express";
import {
  listOldSuppliers,
  getOldSupplier,
  createOldSupplier,
  updateOldSupplier,
  deleteOldSupplier,
  exportOldSuppliersCsv,
} from "../controllers/oldSuppliers.controller.js";
import {
  authenticate,
  requirePermission,
  requireEdit,
} from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission("suppliers"));

router.get("/", listOldSuppliers);
router.get("/export/csv", exportOldSuppliersCsv);
router.get("/:id", getOldSupplier);

router.post("/", requireEdit("suppliers"), createOldSupplier);
router.put("/:id", requireEdit("suppliers"), updateOldSupplier);
router.delete("/:id", requireEdit("suppliers"), deleteOldSupplier);

export default router;
