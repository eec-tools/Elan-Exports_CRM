import { Router } from "express";
import {
  listAccessRequests,
  createAccessRequest,
  reviewAccessRequest,
} from "../controllers/accessRequests.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticate, listAccessRequests);
router.post("/", authenticate, createAccessRequest);
router.put("/:id", authenticate, requireAdmin, reviewAccessRequest);

export default router;
