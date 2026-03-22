import { Router } from "express";
import multer from "multer";
import path from "path";
import {
  listReports,
  createReport,
  updateReport,
  deleteReport,
  exportPdf,
} from "../controllers/reports.controller.js";
import {
  authenticate,
  requirePermission,
  requireEdit,
} from "../middleware/auth.js";

import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer-storage-cloudinary for image uploads
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (_req, file) => {
    return {
      folder: "elan-exports-reports",
      public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}_${path.basename(file.originalname, path.extname(file.originalname))}`,
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const valid =
      allowed.test(path.extname(file.originalname).toLowerCase()) &&
      allowed.test(file.mimetype.split("/")[1]);
    cb(null, valid);
  },
});

const router = Router();

router.use(authenticate, requirePermission("reports"));

router.get("/", listReports);
router.get("/export/pdf", exportPdf);

router.post(
  "/",
  requireEdit("reports"),
  upload.single("productImage"),
  createReport,
);
router.put(
  "/:id",
  requireEdit("reports"),
  upload.single("productImage"),
  updateReport,
);
router.delete("/:id", requireEdit("reports"), deleteReport);

export default router;
