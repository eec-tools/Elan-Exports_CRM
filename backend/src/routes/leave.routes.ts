import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  adminGetLeaves,
  applyLeave,
  approveLeave,
  getLeaveBalance,
  getMyLeaves,
  rejectLeave,
} from "../controllers/leave.controller.js";

const router = Router();

router.use(authenticate);

// Employee endpoints
router.post("/", applyLeave);
router.get("/", getMyLeaves);
router.get("/balance", getLeaveBalance);

// Admin endpoints
router.get("/admin", requireAdmin, adminGetLeaves);
router.patch("/admin/:id/approve", requireAdmin, approveLeave);
router.patch("/admin/:id/reject", requireAdmin, rejectLeave);

export default router;
