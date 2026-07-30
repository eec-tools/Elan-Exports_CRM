import { Router } from "express";
import { listArchivedBuyers } from "../controllers/archivedBuyers.controller.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission(["buyers_directory", "sourcing_buyers"]));

router.get("/", listArchivedBuyers);

export default router;
