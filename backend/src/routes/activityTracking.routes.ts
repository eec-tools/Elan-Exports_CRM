import { Router } from "express";
import {
  getAdminActivity,
  getMyActivity,
  trackActivityBatch,
  trackActivityEvent,
} from "../controllers/activityTracking.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.post("/track", trackActivityEvent);
router.post("/track/batch", trackActivityBatch);
router.get("/my", getMyActivity);
router.get("/admin", requireAdmin, getAdminActivity);

export default router;
