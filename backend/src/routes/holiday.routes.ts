import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { createHoliday, deleteHoliday, listHolidays } from "../controllers/holiday.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", listHolidays);
router.post("/", requireAdmin, createHoliday);
router.delete("/:id", requireAdmin, deleteHoliday);

export default router;
