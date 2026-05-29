import { Router } from "express";
import {
    listSourcingBuyers,
    getSourcingBuyerStats,
    getSourcingBuyer,
    createSourcingBuyer,
    updateSourcingBuyer,
    deleteSourcingBuyer,
    getVaultFolderNotSent,
    addFromVaultFolder,
    convertToBuyer,
} from "../controllers/sourcingBuyers.controller.js";
import { authenticate, requirePermission, requireEdit } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission("sourcing_buyers"));

router.get("/stats", getSourcingBuyerStats);
router.get("/from-folder", getVaultFolderNotSent);
router.get("/", listSourcingBuyers);
router.get("/:id", getSourcingBuyer);

router.post("/", requireEdit("sourcing_buyers"), createSourcingBuyer);
router.post("/from-folder", requireEdit("sourcing_buyers"), addFromVaultFolder);
router.post("/:id/convert", requireEdit("sourcing_buyers"), convertToBuyer);
router.put("/:id", requireEdit("sourcing_buyers"), updateSourcingBuyer);
router.delete("/:id", requireEdit("sourcing_buyers"), deleteSourcingBuyer);

export default router;
