import { Router } from "express";
import {
  listSignatures,
  getSignature,
  createSignature,
  updateSignature,
  deleteSignature,
  getDefaultSignature,
  setDefaultSignature,
} from "../controllers/emailSignatures.controller.js";
import { authenticate, requirePermission } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requirePermission(["suppliers", "sourcing_suppliers"]));

router.get("/", listSignatures);
router.get("/default", getDefaultSignature);
router.get("/:id", getSignature);
router.post("/", createSignature);
router.post("/default", setDefaultSignature);
router.put("/:id", updateSignature);
router.delete("/:id", deleteSignature);

export default router;
