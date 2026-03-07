import { Router } from "express";
import { getTasks, createTask, updateTask, deleteTask } from "../controllers/dailyTask.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getTasks);
router.post("/", createTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

export default router;
