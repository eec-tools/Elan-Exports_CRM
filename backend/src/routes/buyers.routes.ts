import { Router } from "express";
import {
  listBuyers,
  listBuyersForDropdown,
  getBuyerStats,
  getCrProducts,
  getBuyer,
  createBuyer,
  updateBuyer,
  deleteBuyer,
  exportBuyersCsv,
  uploadBuyerCatalog,
  uploadBuyerFile,
  uploadBuyerDocument,
  deleteBuyerDocument,
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
router.get("/list", listBuyersForDropdown);
router.get("/stats", getBuyerStats);
router.get("/cr-products", getCrProducts);
router.get("/export/csv", exportBuyersCsv);
router.get("/:id", getBuyer);

// Write operations require edit access
router.post("/upload", requireEdit("buyers"), uploadBuyerFile.single("file"), uploadBuyerCatalog);
router.post("/", requireEdit("buyers"), createBuyer);
router.post("/:id/documents", requireEdit("buyers"), uploadBuyerFile.single("file"), uploadBuyerDocument);
router.put("/:id", requireEdit("buyers"), updateBuyer);
router.delete("/:id/documents/:docId", requireEdit("buyers"), deleteBuyerDocument);
router.delete("/:id", requireEdit("buyers"), deleteBuyer);

export default router;
