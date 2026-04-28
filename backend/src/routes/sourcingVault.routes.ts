import { Router } from "express";
import {
  listFolders,
  createFolder,
  deleteFolder,
  listVaultSuppliers,
  addToList,
  sendBulkEmail,
  listVaultCreators,
} from "../controllers/sourcingVault.controller.js";
import {
  authenticate,
  requirePermission,
  requireEdit,
} from "../middleware/auth.js";

const router = Router();

router.use(
  authenticate,
  requirePermission(["suppliers", "sourcing_suppliers"]),
);

router.get("/", listFolders);
router.post(
  "/",
  requireEdit(["suppliers", "sourcing_suppliers"]),
  createFolder,
);

// Folder-scoped supplier routes (before /:id to avoid param conflict)
router.get("/:folderId/suppliers", listVaultSuppliers);
router.get("/:folderId/creators", listVaultCreators);
router.post(
  "/:folderId/suppliers/send",
  requireEdit(["suppliers", "sourcing_suppliers"]),
  sendBulkEmail,
);
router.post(
  "/:folderId/suppliers",
  requireEdit(["suppliers", "sourcing_suppliers"]),
  addToList,
);

router.delete(
  "/:id",
  requireEdit(["suppliers", "sourcing_suppliers"]),
  deleteFolder,
);

export default router;
