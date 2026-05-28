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

router.use(authenticate, requirePermission("buyers"));

router.get("/stats", getSourcingBuyerStats);
router.get("/from-folder", getVaultFolderNotSent);
router.get("/", listSourcingBuyers);
router.get("/:id", getSourcingBuyer);

router.post("/", requireEdit("buyers"), createSourcingBuyer);
router.post("/from-folder", requireEdit("buyers"), addFromVaultFolder);
router.post("/:id/convert", requireEdit("buyers"), convertToBuyer);
router.put("/:id", requireEdit("buyers"), updateSourcingBuyer);
router.delete("/:id", requireEdit("buyers"), deleteSourcingBuyer);

export default router;
