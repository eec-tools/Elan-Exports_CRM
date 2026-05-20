import { Router } from "express";
import {
  listDocuments,
  getCategories,
  getBreadcrumbs,
  createFolder,
  uploadDocument,
  editDocument,
  deleteDocument,
  getVaultUploadSignature,
  replaceDocument,
  getDocumentVersions,
  getExpiryAlerts,
  getFolderPolicy,
} from "../controllers/vault.controller.js";
import { authenticate, requireEdit } from "../middleware/auth.js";

const router = Router();

// All vault routes require authentication
router.use(authenticate);

// Read – all authenticated users
router.get("/", listDocuments);
router.get("/categories", getCategories);
router.get("/expiry-alerts", getExpiryAlerts);
router.get("/folder-policy", getFolderPolicy);
router.get("/breadcrumbs/:id", getBreadcrumbs);
router.get("/:id/versions", getDocumentVersions);

// Upload signature – admin OR vault edit
router.get("/upload-signature", requireEdit("vault"), getVaultUploadSignature);

// Write – admin OR members with vault edit permission
// (individual routes also enforce folder-level policy internally)
router.post("/folder", requireEdit("vault"), createFolder);
router.post("/upload", requireEdit("vault"), uploadDocument);
router.post("/:id/replace", requireEdit("vault"), replaceDocument);
router.put("/:id", requireEdit("vault"), editDocument);
router.delete("/:id", requireEdit("vault"), deleteDocument);

export default router;

