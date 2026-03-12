import { Router } from "express";
import {
  getAllComplianceDocs,
  createComplianceDoc,
  updateComplianceDoc,
  deleteComplianceDoc,
} from "../controllers/compliance.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", getAllComplianceDocs);
router.post("/", createComplianceDoc);
router.patch("/:id", updateComplianceDoc);
router.delete("/:id", deleteComplianceDoc);

export default router;
