import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const attachmentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req: Express.Request, file: Express.Multer.File) => {
    const extMatch = file.originalname.match(/\.[^/.]+$/);
    const ext = extMatch ? extMatch[0] : "";
    const baseName = file.originalname
      .replace(/\.[^/.]+$/, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    return {
      folder: "elan-email-attachments",
      resource_type: "raw",
      public_id: `email_attachment_${Date.now()}_${baseName}${ext}`,
    };
  },
} as any);

export const uploadAttachmentMiddleware = multer({
  storage: attachmentStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const URL_KEY = "email_campaign_attachment_url";
const NAME_KEY = "email_campaign_attachment_name";

export async function getAttachment(_req: AuthRequest, res: Response): Promise<void> {
  const [urlSetting, nameSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: URL_KEY } }),
    prisma.appSetting.findUnique({ where: { key: NAME_KEY } }),
  ]);
  if (!urlSetting?.value) {
    res.json({ attachment: null });
    return;
  }
  res.json({ attachment: { url: urlSetting.value, filename: nameSetting?.value ?? "attachment" } });
}

export async function uploadAttachment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const file = req.file as any;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const fileUrl: string = file.path || file.secure_url || file.url;
    const filename: string = file.originalname;

    await Promise.all([
      prisma.appSetting.upsert({
        where: { key: URL_KEY },
        update: { value: fileUrl },
        create: { key: URL_KEY, value: fileUrl },
      }),
      prisma.appSetting.upsert({
        where: { key: NAME_KEY },
        update: { value: filename },
        create: { key: NAME_KEY, value: filename },
      }),
    ]);

    res.json({ attachment: { url: fileUrl, filename } });
  } catch (err) {
    console.error("[emailAttachment] Upload error:", err);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
}

export async function deleteAttachment(_req: AuthRequest, res: Response): Promise<void> {
  try {
    await Promise.all([
      prisma.appSetting.deleteMany({ where: { key: URL_KEY } }),
      prisma.appSetting.deleteMany({ where: { key: NAME_KEY } }),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("[emailAttachment] Delete error:", err);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
}
