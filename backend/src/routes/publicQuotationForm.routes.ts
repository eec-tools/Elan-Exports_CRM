import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
    getPublicQuotationForm,
    submitPublicQuotationForm,
} from "../controllers/publicQuotationForm.controller.js";

const router = Router();

const formLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
});

// No authentication — public routes
router.get("/:token", formLimiter, getPublicQuotationForm);
router.post("/:token", formLimiter, submitPublicQuotationForm);

export default router;
