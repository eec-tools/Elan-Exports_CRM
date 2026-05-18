import { Request, Response, NextFunction } from "express";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../types/index.js";

const prisma = new PrismaClient();

// ─── Cloudinary config ──────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Multer + Cloudinary storage ────────────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (_req: Express.Request, file: Express.Multer.File) => {
    let resource_type = "auto";
    let isRaw = false;
    if (
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().match(/\.(pdf|doc|docx|xls|xlsx|csv|zip)$/)
    ) {
      resource_type = "raw";
      isRaw = true;
    }

    const extMatch = file.originalname.match(/\.[^/.]+$/);
    const ext = isRaw && extMatch ? extMatch[0] : "";
    const baseName = file.originalname.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");

    return {
      folder: "elan-vault",
      resource_type,
      public_id: `vault_${Date.now()}_${baseName}${ext}`,
    };
  },
} as any);

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ─── Helper: derive fileType from mimetype ──────────
function deriveFileType(mimetype: string): string {
  if (mimetype === "application/pdf") return "pdf";
  if (mimetype.startsWith("image/")) return "image";
  if (
    mimetype.includes("word") ||
    mimetype.includes("document") ||
    mimetype.includes("openxmlformats-officedocument.wordprocessingml")
  )
    return "doc";
  if (
    mimetype.includes("excel") ||
    mimetype.includes("sheet") ||
    mimetype.includes("openxmlformats-officedocument.spreadsheetml")
  )
    return "sheet";
  return "file";
}

// ─── Controllers ────────────────────────────────────

/** GET /api/vault/upload-signature - generate a signed Cloudinary upload params */
export async function getVaultUploadSignature(
  _req: AuthRequest,
  res: Response,
): Promise<void> {
  const timestamp = Math.round(Date.now() / 1000);
  const params = { folder: "elan-vault", timestamp };
  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET!,
  );
  res.json({
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder: "elan-vault",
  });
}

/** GET /api/vault - list documents/folders in a given parent (or root) */
export async function listDocuments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { category, search, parentId } = req.query as {
      category?: string;
      search?: string;
      parentId?: string;
    };

    const where: any = {};

    // If searching, search across everything (not scoped to parent)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
        { region: { contains: search, mode: "insensitive" } },
      ];
    } else {
      // Scope to parent folder (null = root)
      if (parentId) {
        where.parentId = parentId;
      } else {
        where.parentId = null;
      }
    }

    if (category && category !== "all") where.category = category;

    const documents = await prisma.vaultDocument.findMany({
      where,
      orderBy: [
        { isFolder: "desc" }, // folders first
        { name: "asc" },
      ],
      include: {
        uploader: { select: { fullName: true, email: true } },
        _count: { select: { children: true } },
      },
    });

    res.json(documents);
  } catch (err) {
    next(err);
  }
}

/** GET /api/vault/categories - get category names + doc counts */
export async function getCategories(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const raw = await prisma.vaultDocument.groupBy({
      by: ["category"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const categories = raw.map((r) => ({
      category: r.category,
      count: r._count.id,
    }));

    res.json(categories);
  } catch (err) {
    next(err);
  }
}

/** GET /api/vault/breadcrumbs/:id - get ancestor chain for breadcrumbs */
export async function getBreadcrumbs(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const crumbs: { id: string; name: string }[] = [];

    let currentId: string | null = id as string;
    let safety = 20; // prevent infinite loops

    while (currentId && safety-- > 0) {
      const doc: any = await prisma.vaultDocument.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true },
      });
      if (!doc) break;
      crumbs.unshift({ id: doc.id, name: doc.name });
      currentId = doc.parentId as string | null;
    }

    res.json(crumbs);
  } catch (err) {
    next(err);
  }
}

/** POST /api/vault/folder - create a new folder */
export async function createFolder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { name, parentId, category } = req.body;
    if (!name) {
      res.status(400).json({ error: "Folder name is required" });
      return;
    }

    const userId = (req as any).user?.id;

    // Determine category: inherit from parent if applicable
    let folderCategory = category || "General";
    if (parentId) {
      const parent = await prisma.vaultDocument.findUnique({ where: { id: parentId } });
      if (parent) folderCategory = parent.category;
    }

    const folder = await prisma.vaultDocument.create({
      data: {
        name,
        category: folderCategory,
        region: "Global",
        isFolder: true,
        parentId: parentId || null,
        uploadedBy: userId ?? null,
      },
      include: {
        uploader: { select: { fullName: true, email: true } },
        _count: { select: { children: true } },
      },
    });

    res.status(201).json(folder);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/vault/upload
 * Accepts a JSON body with the Cloudinary result already uploaded from the frontend.
 * { name, category, region, parentId, fileUrl, publicId, fileType }
 */
export async function uploadDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { name, category, region, parentId, fileUrl, publicId, fileType } = req.body;

    if (!name || !category) {
      res.status(400).json({ error: "Name and category are required" });
      return;
    }
    if (!fileUrl) {
      res.status(400).json({ error: "fileUrl is required" });
      return;
    }

    const userId = (req as any).user?.id;

    const doc = await prisma.vaultDocument.create({
      data: {
        name,
        category,
        region: region || "Global",
        fileUrl,
        publicId: publicId || null,
        fileType: fileType || "file",
        isFolder: false,
        parentId: parentId || null,
        uploadedBy: userId ?? null,
      },
      include: {
        uploader: { select: { fullName: true, email: true } },
        _count: { select: { children: true } },
      },
    });

    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

/** PUT /api/vault/:id - edit document metadata (name, category, region) */
export async function editDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const { name, category, region } = req.body;

    const existing = await prisma.vaultDocument.findUnique({ where: { id: id as string } });
    if (!existing) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const updated = await prisma.vaultDocument.update({
      where: { id: id as string },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(region !== undefined && { region }),
      },
      include: {
        uploader: { select: { fullName: true, email: true } },
        _count: { select: { children: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/vault/:id - delete a document/folder and its Cloudinary file */
export async function deleteDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;

    const existing = await prisma.vaultDocument.findUnique({ where: { id: id as string } });
    if (!existing) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // If it's a file, remove from Cloudinary
    if (!existing.isFolder && existing.publicId) {
      try {
        await cloudinary.uploader.destroy(existing.publicId, {
          resource_type: existing.fileType === "image" ? "image" : "raw",
        });
      } catch {
        // File may already be removed from Cloudinary; continue
      }
    }

    // Cascade delete is handled by Prisma relation (onDelete: Cascade)
    await prisma.vaultDocument.delete({ where: { id: id as string } });

    res.json({ message: "Document deleted successfully" });
  } catch (err) {
    next(err);
  }
}
