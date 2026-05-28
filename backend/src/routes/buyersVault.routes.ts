import { Router } from "express";
import {
  listFolders,
  createFolder,
  deleteFolder,
  listVaultSuppliers,
  addToList,
  sendBulkEmail,
  listVaultCreators,
  updateVaultSupplier,
  deleteVaultSupplier,
} from "../controllers/buyersVault.controller.js";
import {
  authenticate,
  requirePermission,
  requireEdit,
} from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission(["buyers"]));

router.get("/", listFolders);
router.post("/", requireEdit(["buyers"]), createFolder);

router.get("/:folderId/suppliers", listVaultSuppliers);
router.get("/:folderId/creators", listVaultCreators);
router.post("/:folderId/suppliers/send", requireEdit(["buyers"]), sendBulkEmail);
router.post("/:folderId/suppliers", requireEdit(["buyers"]), addToList);

router.put("/:folderId/suppliers/:supplierId", requireEdit(["buyers"]), updateVaultSupplier);
router.delete("/:folderId/suppliers/:supplierId", requireEdit(["buyers"]), deleteVaultSupplier);

router.delete("/:id", requireEdit(["buyers"]), deleteFolder);

export default router;
