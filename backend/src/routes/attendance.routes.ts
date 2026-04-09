import { Router } from "express";
import {
  endAttendance,
  getAdminAttendanceHistory,
  getAdminTodayAttendance,
  getAttendanceHistory,
  getTodayAttendance,
  heartbeatAttendance,
  startAttendance,
  uploadAttendanceProof,
  uploadAttendanceProofFile,
} from "../controllers/attendance.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

// User endpoints
router.get("/today", getTodayAttendance);
router.post("/start", startAttendance);
router.post("/end", endAttendance);
router.post("/upload-proof", uploadAttendanceProofFile.single("file"), uploadAttendanceProof);
router.post("/heartbeat", heartbeatAttendance);
router.get("/history", getAttendanceHistory);

// Admin endpoints
router.get("/admin/today", requireAdmin, getAdminTodayAttendance);
router.get("/admin/history", requireAdmin, getAdminAttendanceHistory);

export default router;
