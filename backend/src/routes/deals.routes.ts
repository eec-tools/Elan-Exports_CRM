import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getAllDeals,
  createDeal,
  updateDeal,
  deleteDeal,
} from "../controllers/deals.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getAllDeals);
router.post("/", createDeal);
router.patch("/:id", updateDeal);
router.delete("/:id", deleteDeal);

export default router;
