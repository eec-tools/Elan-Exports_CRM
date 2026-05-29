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

router.use(authenticate, requirePermission(["sourcing_buyers"]));

router.get("/", listFolders);
router.post("/", requireEdit(["sourcing_buyers"]), createFolder);

router.get("/:folderId/suppliers", listVaultSuppliers);
router.get("/:folderId/creators", listVaultCreators);
router.post("/:folderId/suppliers/send", requireEdit(["sourcing_buyers"]), sendBulkEmail);
router.post("/:folderId/suppliers", requireEdit(["sourcing_buyers"]), addToList);

router.put("/:folderId/suppliers/:supplierId", requireEdit(["sourcing_buyers"]), updateVaultSupplier);
router.delete("/:folderId/suppliers/:supplierId", requireEdit(["sourcing_buyers"]), deleteVaultSupplier);

router.delete("/:id", requireEdit(["sourcing_buyers"]), deleteFolder);

export default router;
