import { Router, RequestHandler } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  generateMonthlyPayroll,
  getEmployeePayrollHistory,
  getMonthlyPayrollSummary,
  getMyPayroll,
  getPayrollSlip,
} from "../controllers/payroll.controller.js";

const router = Router();

router.use(authenticate);

// Employee endpoint
router.get("/me", getMyPayroll);

// Admin endpoints
router.post("/admin/generate", requireAdmin, generateMonthlyPayroll);
router.get("/admin", requireAdmin, getMonthlyPayrollSummary);
router.get("/admin/:userId/slip", requireAdmin, getPayrollSlip as unknown as RequestHandler);
router.get("/admin/:userId", requireAdmin, getEmployeePayrollHistory as unknown as RequestHandler);

export default router;
