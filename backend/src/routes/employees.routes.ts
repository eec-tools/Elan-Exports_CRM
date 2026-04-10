import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  createEmployee,
  listEmployees,
  updateEmployee,
} from "../controllers/employees.controller.js";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/", listEmployees);
router.post("/", createEmployee);
router.patch("/:id", updateEmployee);

export default router;
