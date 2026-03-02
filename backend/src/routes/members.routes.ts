import { Router } from "express";
import {
  listMembers,
  createMember,
  updateMember,
  deleteMember,
  updatePermissions,
  updateStatus,
  setPasskey,
  sendCredentials,
} from "../controllers/members.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();

// All member routes require admin
router.use(authenticate, requireAdmin);

router.get("/", listMembers);
router.post("/", createMember);
router.put("/:id", updateMember);
router.delete("/:id", deleteMember);
router.put("/:id/permissions", updatePermissions);
router.put("/:id/status", updateStatus);
router.put("/:id/passkey", setPasskey);
router.post("/:id/send-credentials", sendCredentials);

export default router;
