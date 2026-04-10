import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  createEmployee,
  getMyEmployeeProfile,
  listEmployees,
  updateEmployee,
} from "../controllers/employees.controller.js";

const router = Router();

router.use(authenticate);

// Any authenticated user
router.get("/me", getMyEmployeeProfile);

// Admin only
router.get("/", requireAdmin, listEmployees);
router.post("/", requireAdmin, createEmployee);
router.patch("/:id", requireAdmin, updateEmployee);

export default router;
