import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

/**
 * GET /api/settings/:key
 */
export async function getSetting(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: req.params.key },
    });

    if (!setting) {
      res.status(404).json({ error: "Setting not found" });
      return;
    }

    res.json({ key: setting.key, value: setting.value });
  } catch (err) {
    console.error("Get setting error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/settings/:key
 */
export async function updateSetting(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { value } = req.body;
    const key = req.params.key as string;

    const setting = await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    res.json({ key: setting.key, value: setting.value });
  } catch (err) {
    console.error("Update setting error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
