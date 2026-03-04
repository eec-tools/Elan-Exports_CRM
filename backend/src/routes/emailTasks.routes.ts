import { Router } from "express";
import {
    getEmailTasks,
    updateEmailTask,
    deleteEmailTask,
    getEmailTaskStats
} from "../controllers/emailTasks.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getEmailTasks);
router.get("/stats", getEmailTaskStats);
router.put("/:id", updateEmailTask);
router.delete("/:id", deleteEmailTask);

export default router;
