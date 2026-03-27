import { Router } from "express";
import {
  listNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
  streamNotifications,
} from "../controllers/notifications.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/stream", streamNotifications);
router.get("/", listNotifications);
router.get("/unread-count", getUnreadCount);
router.post("/read-all", markAllRead);
router.post("/:id/read", markOneRead);

export default router;
