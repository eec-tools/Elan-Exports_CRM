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
  getBuyerUploadSignature,
} from "../controllers/buyers.controller.js";
import {
  authenticate,
  requirePermission,
  requireEdit,
} from "../middleware/auth.js";

const router = Router();

// All buyer routes require authentication + buyers_directory permission
router.use(authenticate, requirePermission("buyers_directory"));

router.get("/", listBuyers);
router.get("/list", listBuyersForDropdown);
router.get("/stats", getBuyerStats);
router.get("/cr-products", getCrProducts);
router.get("/export/csv", exportBuyersCsv);
router.get("/upload-signature", requireEdit("buyers_directory"), getBuyerUploadSignature);
router.get("/:id", getBuyer);

// Write operations require edit access
router.post("/upload", requireEdit("buyers_directory"), uploadBuyerFile.single("file"), uploadBuyerCatalog);
router.post("/", requireEdit("buyers_directory"), createBuyer);
router.post("/:id/documents", requireEdit("buyers_directory"), uploadBuyerDocument);
router.put("/:id", requireEdit("buyers_directory"), updateBuyer);
router.delete("/:id/documents/:docId", requireEdit("buyers_directory"), deleteBuyerDocument);
router.delete("/:id", requireEdit("buyers_directory"), deleteBuyer);

export default router;
