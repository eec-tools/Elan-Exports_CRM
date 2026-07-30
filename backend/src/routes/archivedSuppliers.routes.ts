import { Router } from "express";
import { listArchivedSuppliers } from "../controllers/archivedSuppliers.controller.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(
  authenticate,
  requirePermission(["suppliers", "sourcing_suppliers", "new_suppliers", "signed_suppliers", "old_suppliers"]),
);

router.get("/", listArchivedSuppliers);

export default router;
