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
router.patch("/:sourcingId/contacted", toggleContacted);
router.get("/:sourcingId/thread", getThread);
router.post("/:sourcingId/draft", draftReply);
router.post("/:sourcingId/send", sendReply);
router.post("/:sourcingId/upload-attachment", uploadComposeAttachmentMiddleware.single("file"), uploadComposeAttachment);

export default router;
