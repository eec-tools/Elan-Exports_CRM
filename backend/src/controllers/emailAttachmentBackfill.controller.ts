import { Response } from "express";
import { AuthRequest } from "../types/index.js";
import { getBackfillStatus, startBackfill } from "../services/emailAttachmentBackfill.service.js";

export async function getStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const status = await getBackfillStatus();
    res.json(status);
  } catch (err) {
    console.error("[emailAttachmentBackfill] getStatus error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function start(req: AuthRequest, res: Response): Promise<void> {
  try {
    const status = await startBackfill();
    res.json(status);
  } catch (err) {
    console.error("[emailAttachmentBackfill] start error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
