import { Router } from "express";
import { resolveShortLink } from "../controllers/shortLinks.controller.js";

const router = Router();

router.get("/:code", resolveShortLink);

export default router;
