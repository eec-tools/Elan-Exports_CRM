import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.js";
import {
  getInbox,
  getThread,
  draftReply,
  sendReply,
  toggleContacted,
  uploadComposeAttachmentMiddleware,
  uploadComposeAttachment,
} from "../controllers/aiSupplierComms.controller.js";

const router = Router();

router.use(authenticate, requirePermission(["suppliers", "sourcing_suppliers"]));

router.get("/inbox", getInbox);
router.patch("/:entityType/:entityId/contacted", toggleContacted);
router.get("/:entityType/:entityId/thread", getThread);
router.post("/:entityType/:entityId/draft", draftReply);
router.post("/:entityType/:entityId/send", sendReply);
router.post("/:entityType/:entityId/upload-attachment", uploadComposeAttachmentMiddleware.single("file"), uploadComposeAttachment);

export default router;
