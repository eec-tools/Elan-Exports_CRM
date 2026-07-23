import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { getStatus, start } from "../controllers/emailAttachmentBackfill.controller.js";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/status", getStatus);
router.post("/start", start);

export default router;
