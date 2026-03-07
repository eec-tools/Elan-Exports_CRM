import { Router } from "express";
import { listActivity } from "../controllers/activity.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
const router = Router();
router.get("/", authenticate, requireAdmin, listActivity);
export default router;
//# sourceMappingURL=activity.routes.js.map