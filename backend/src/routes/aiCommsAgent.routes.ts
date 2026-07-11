import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.js";
import { getInbox, getThread, draftReply, sendReply } from "../controllers/aiCommsAgent.controller.js";

const router = Router();

router.use(authenticate, requirePermission(["sourcing_buyers"]));

router.get("/inbox", getInbox);
router.get("/:sourcingBuyerId/thread", getThread);
router.post("/:sourcingBuyerId/draft", draftReply);
router.post("/:sourcingBuyerId/send", sendReply);

export default router;
