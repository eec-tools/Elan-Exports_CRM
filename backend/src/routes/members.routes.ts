import { Router } from "express";
import {
  listMembers,
  listMemberNames,
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

// Public route for authenticated users - get member names for dropdowns
router.get("/names", authenticate, listMemberNames);

// All other member routes require admin
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
