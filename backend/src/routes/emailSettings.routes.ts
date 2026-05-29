import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  getAttachment,
  uploadAttachment,
  deleteAttachment,
  uploadAttachmentMiddleware,
} from "../controllers/emailAttachment.controller.js";

const router = Router();

router.get("/attachment", authenticate, getAttachment);
router.post("/attachment", authenticate, requireAdmin, uploadAttachmentMiddleware.single("file"), uploadAttachment);
router.delete("/attachment", authenticate, requireAdmin, deleteAttachment);

export default router;
