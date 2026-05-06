import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.js";
import {
  getBuyersReport,
  getSuppliersReport,
  getEmployeesReport,
} from "../controllers/analytics.controller.js";

const router = Router();

router.get(
  "/buyers-report",
  authenticate,
  requirePermission("reports"),
  getBuyersReport,
);

router.get(
  "/suppliers-report",
  authenticate,
  requirePermission("reports"),
  getSuppliersReport,
);

router.get(
  "/employees-report",
  authenticate,
  requirePermission("reports"),
  getEmployeesReport,
);

export default router;
