import { Router } from "express";
import {
    getEmailTasks,
    updateEmailTask,
    deleteEmailTask,
    getEmailTaskStats,
    triggerSync,
    getSyncStatus,
} from "../controllers/emailTasks.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getEmailTasks);
router.get("/stats", getEmailTaskStats);
router.get("/sync-status", getSyncStatus);
router.post("/sync", triggerSync);
router.put("/:id", updateEmailTask);
router.delete("/:id", deleteEmailTask);

export default router;
