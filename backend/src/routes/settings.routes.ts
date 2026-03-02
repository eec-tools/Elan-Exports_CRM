import { Router } from "express";
import {
  getSetting,
  updateSetting,
} from "../controllers/settings.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/:key", authenticate, getSetting);
router.put("/:key", authenticate, requireAdmin, updateSetting);

export default router;
