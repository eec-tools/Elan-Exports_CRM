import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getPublicForm, submitPublicForm, uploadPublicFormFile, publicFormUpload } from "../controllers/publicSupplierForm.controller.js";

const router = Router();

const formLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
});

// No authentication — public routes
router.get("/:token", formLimiter, getPublicForm);
router.post("/:token", formLimiter, submitPublicForm);
router.post("/:token/upload", formLimiter, publicFormUpload.single("file"), uploadPublicFormFile);

export default router;
