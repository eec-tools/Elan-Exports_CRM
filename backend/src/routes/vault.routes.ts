import { Router } from "express";
import {
  listDocuments,
  getCategories,
  getBreadcrumbs,
  createFolder,
  uploadDocument,
  editDocument,
  deleteDocument,
  upload,
} from "../controllers/vault.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();

// All vault routes require authentication
router.use(authenticate);

// Read – all authenticated users
router.get("/", listDocuments);
router.get("/categories", getCategories);
router.get("/breadcrumbs/:id", getBreadcrumbs);

// Write – admin only
router.post("/folder", requireAdmin, createFolder);
router.post("/upload", requireAdmin, upload.single("file"), uploadDocument);
router.put("/:id", requireAdmin, editDocument);
router.delete("/:id", requireAdmin, deleteDocument);

export default router;
