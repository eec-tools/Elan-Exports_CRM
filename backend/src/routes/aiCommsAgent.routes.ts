import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.js";
import { getInbox, getThread, draftReply, sendReply, toggleContacted } from "../controllers/aiCommsAgent.controller.js";

const router = Router();

router.use(authenticate, requirePermission(["sourcing_buyers"]));

router.get("/inbox", getInbox);
router.patch("/:sourcingBuyerId/contacted", toggleContacted);
router.get("/:sourcingBuyerId/thread", getThread);
router.post("/:sourcingBuyerId/draft", draftReply);
router.post("/:sourcingBuyerId/send", sendReply);

export default router;
