import { Router } from "express";
import { listNewSuppliers, getNewSupplier, createNewSupplier, updateNewSupplier, deleteNewSupplier, exportNewSuppliersCsv, getNewSupplierFilters, updateNewSupplierStage, } from "../controllers/newSuppliers.controller.js";
import { authenticate, requirePermission, requireEdit, } from "../middleware/auth.js";
const router = Router();
router.use(authenticate, requirePermission("suppliers"));
router.get("/", listNewSuppliers);
router.get("/filters", getNewSupplierFilters);
router.get("/export/csv", exportNewSuppliersCsv);
router.get("/:id", getNewSupplier);
router.post("/", requireEdit("suppliers"), createNewSupplier);
router.put("/:id", requireEdit("suppliers"), updateNewSupplier);
router.patch("/:id/stage", requireEdit("suppliers"), updateNewSupplierStage);
router.delete("/:id", requireEdit("suppliers"), deleteNewSupplier);
export default router;
//# sourceMappingURL=newSuppliers.routes.js.map