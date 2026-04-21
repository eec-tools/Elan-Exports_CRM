import { Router } from "express";
import { listAccounts, initiateAuth, handleCallback } from "../controllers/gmail.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Public callback — Google redirects here after OAuth (no auth middleware)
router.get("/callback", handleCallback);

// Protected routes
router.get("/accounts", authenticate, listAccounts);
router.get("/auth", authenticate, requireAdmin, initiateAuth);

export default router;
