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

router.use(authenticate, requirePermission(["suppliers", "sourcing_suppliers"]));

router.get("/", listSourcingSuppliers);
router.get("/stats", getSourcingSupplierStats);
router.get("/:id", getSourcingSupplier);

router.post("/", requireEdit(["suppliers", "sourcing_suppliers"]), createSourcingSupplier);
router.post("/:id/convert", requireEdit(["suppliers", "sourcing_suppliers"]), convertToNewSupplier);
router.put("/:id", requireEdit(["suppliers", "sourcing_suppliers"]), updateSourcingSupplier);
router.delete("/:id", requireEdit(["suppliers", "sourcing_suppliers"]), deleteSourcingSupplier);

export default router;
