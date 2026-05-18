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
} from "../controllers/vault.controller.js";
import { authenticate, requireEdit } from "../middleware/auth.js";

const router = Router();

// All vault routes require authentication
router.use(authenticate);

// Read – all authenticated users
router.get("/", listDocuments);
router.get("/categories", getCategories);
router.get("/breadcrumbs/:id", getBreadcrumbs);

// Upload signature – admin OR vault edit (used by frontend for direct-to-Cloudinary upload)
router.get("/upload-signature", requireEdit("vault"), getVaultUploadSignature);

// Write – admin OR members with vault edit permission
router.post("/folder", requireEdit("vault"), createFolder);
router.post("/upload", requireEdit("vault"), uploadDocument);   // JSON body, no multipart
router.put("/:id", requireEdit("vault"), editDocument);
router.delete("/:id", requireEdit("vault"), deleteDocument);

export default router;

