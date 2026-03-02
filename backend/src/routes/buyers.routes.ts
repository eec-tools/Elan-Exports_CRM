import { Router } from "express";
import {
  listBuyers,
  getBuyerStats,
  getCrProducts,
  getBuyer,
  createBuyer,
  updateBuyer,
  deleteBuyer,
  exportBuyersCsv,
} from "../controllers/buyers.controller.js";
import {
  authenticate,
  requirePermission,
  requireEdit,
} from "../middleware/auth.js";

const router = Router();

// All buyer routes require authentication + buyers permission
router.use(authenticate, requirePermission("buyers"));

router.get("/", listBuyers);
router.get("/stats", getBuyerStats);
router.get("/cr-products", getCrProducts);
router.get("/export/csv", exportBuyersCsv);
router.get("/:id", getBuyer);

// Write operations require edit access
router.post("/", requireEdit("buyers"), createBuyer);
router.put("/:id", requireEdit("buyers"), updateBuyer);
router.delete("/:id", requireEdit("buyers"), deleteBuyer);

export default router;
