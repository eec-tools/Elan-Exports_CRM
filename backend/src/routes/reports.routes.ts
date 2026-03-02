import { Router } from "express";
import multer from "multer";
import path from "path";
import {
  listReports,
  createReport,
  updateReport,
  deleteReport,
} from "../controllers/reports.controller.js";
import {
  authenticate,
  requirePermission,
  requireEdit,
} from "../middleware/auth.js";

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, "uploads/");
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
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
