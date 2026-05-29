import { Router } from "express";
import { authenticate, requireEdit } from "../middleware/auth.js";
import {
  getAttachment,
  uploadAttachment,
  deleteAttachment,
  uploadAttachmentMiddleware,
} from "../controllers/emailAttachment.controller.js";

const router = Router();

router.get("/attachment", authenticate, getAttachment);
router.post("/attachment", authenticate, requireEdit("sourcing_buyers"), uploadAttachmentMiddleware.single("file"), uploadAttachment);
router.delete("/attachment", authenticate, requireEdit("sourcing_buyers"), deleteAttachment);

export default router;
