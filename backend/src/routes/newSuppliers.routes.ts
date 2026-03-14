import { Router } from "express";
import {
    listNewSuppliers,
    getNewSupplier,
    createNewSupplier,
    updateNewSupplier,
    deleteNewSupplier,
    exportNewSuppliersCsv,
} from "../controllers/newSuppliers.controller.js";
import {
    authenticate,
    requirePermission,
    requireEdit,
} from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission("suppliers"));

router.get("/", listNewSuppliers);
router.get("/export/csv", exportNewSuppliersCsv);
router.get("/:id", getNewSupplier);

router.post("/", requireEdit("suppliers"), createNewSupplier);
router.put("/:id", requireEdit("suppliers"), updateNewSupplier);
router.delete("/:id", requireEdit("suppliers"), deleteNewSupplier);

export default router;
