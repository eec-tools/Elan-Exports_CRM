import { Router } from "express";
import {
  deleteAttendanceRecord,
  deleteUserAttendanceRecords,
  endAttendance,
  getAdminAttendanceHistory,
  getAdminTodayAttendance,
  getAttendanceHistory,
  getTodayAttendance,
  heartbeatAttendance,
  startAttendance,
  updateAttendanceStatus,
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
router.patch("/admin/:id/status", requireAdmin, updateAttendanceStatus);
router.delete("/admin/user/:id", requireAdmin, deleteUserAttendanceRecords);
router.delete("/admin/:id", requireAdmin, deleteAttendanceRecord);

export default router;
