import { Router } from "express";
import {
    listSourcingSuppliers,
    getSourcingSupplierStats,
    getSourcingSupplier,
    createSourcingSupplier,
    updateSourcingSupplier,
    deleteSourcingSupplier,
    convertToNewSupplier,
} from "../controllers/sourcingSuppliers.controller.js";
import { authenticate, requirePermission, requireEdit } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission("suppliers"));

router.get("/", listSourcingSuppliers);
router.get("/stats", getSourcingSupplierStats);
router.get("/:id", getSourcingSupplier);

router.post("/", requireEdit("suppliers"), createSourcingSupplier);
router.post("/:id/convert", requireEdit("suppliers"), convertToNewSupplier);
router.put("/:id", requireEdit("suppliers"), updateSourcingSupplier);
router.delete("/:id", requireEdit("suppliers"), deleteSourcingSupplier);

export default router;
