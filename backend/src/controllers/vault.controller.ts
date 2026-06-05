import { Request, Response, NextFunction } from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../types/index.js";
import { resolveFolderPolicy } from "../config/vaultPermissions.js";
import { s3, S3_BUCKET, s3FileUrl } from "../lib/s3.js";

const prisma = new PrismaClient();

// ─── Multer + S3 storage ─────────────────────────────
const storage = multerS3({
  s3,
  bucket: S3_BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (_req: any, file: Express.Multer.File, cb: (err: Error | null, key: string) => void) => {
    const baseName = file.originalname.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
    const extMatch = file.originalname.match(/\.[^/.]+$/);
    const ext = extMatch ? extMatch[0] : "";
    cb(null, `vault/vault_${Date.now()}_${baseName}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ─── Controllers ────────────────────────────────────

/** GET /api/vault/upload-signature - returns S3 presigned PUT URL for direct browser upload */
export async function getVaultUploadSignature(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const { filename = "file", contentType = "application/octet-stream" } = req.query as {
    filename?: string;
    contentType?: string;
  };
  const baseName = filename.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
  const extMatch = filename.match(/\.[^/.]+$/);
  const ext = extMatch ? extMatch[0] : "";
  const s3Key = `vault/vault_${Date.now()}_${baseName}${ext}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  res.json({
    uploadUrl,
    fileUrl: s3FileUrl(s3Key),
    s3Key,
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
    const user = (req as any).user;
    const isAdmin = user?.roles?.includes("admin") ?? false;
    const hasVaultEdit = user?.permissions?.some(
      (p: any) => p.permission === "vault" && p.accessLevel === "edit",
    ) ?? false;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
        { region: { contains: search, mode: "insensitive" } },
      ];
    } else {
      where.parentId = parentId || null;
    }

    if (category && category !== "all") where.category = category;

    const documents = await prisma.vaultDocument.findMany({
      where,
      orderBy: [{ isFolder: "desc" }, { name: "asc" }],
      include: {
        uploader: { select: { fullName: true, email: true } },
        _count: { select: { children: true } },
      },
    });

    // Annotate each item with canEdit based on folder policy
    const annotated = await Promise.all(
      documents.map(async (doc) => {
        const policy = await resolveFolderPolicy(doc.isFolder ? doc.parentId : (doc.parentId ?? doc.id));
        const canEdit =
          isAdmin ||
          (policy.edit === "all" && (isAdmin || hasVaultEdit));
        const canRead = isAdmin || policy.read === "all";
        return { ...doc, canEdit, canRead };
      }),
    );

    res.json(annotated);
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
 * Accepts a JSON body with the S3 file already uploaded from the frontend.
 * { name, category, region, parentId, fileUrl, publicId, fileType, expiryDate? }
 */
export async function uploadDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { name, category, region, parentId, fileUrl, publicId, fileType, expiryDate } = req.body;

    if (!name || !category) {
      res.status(400).json({ error: "Name and category are required" });
      return;
    }
    if (!fileUrl) {
      res.status(400).json({ error: "fileUrl is required" });
      return;
    }

    const user = (req as any).user;
    const userId = user?.id;
    const isAdmin = user?.roles?.includes("admin") ?? false;
    const hasVaultEdit = user?.permissions?.some((p: any) => p.permission === "vault" && p.accessLevel === "edit") ?? false;

    const policy = await resolveFolderPolicy(parentId || null);
    if (!(isAdmin || (policy.edit === "all" && hasVaultEdit))) {
      res.status(403).json({ error: "You do not have permission to upload to this folder" });
      return;
    }

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
        expiryDate: expiryDate ? new Date(expiryDate) : null,
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

/** PUT /api/vault/:id - edit document metadata (name, category, region, expiryDate) */
export async function editDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const { name, category, region, expiryDate } = req.body;

    const existing = await prisma.vaultDocument.findUnique({ where: { id: id as string } });
    if (!existing) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const user = (req as any).user;
    const isAdmin = user?.roles?.includes("admin") ?? false;
    const hasVaultEdit = user?.permissions?.some((p: any) => p.permission === "vault" && p.accessLevel === "edit") ?? false;
    const policy = await resolveFolderPolicy(existing.parentId);
    if (!(isAdmin || (policy.edit === "all" && hasVaultEdit))) {
      res.status(403).json({ error: "You do not have permission to edit files in this folder" });
      return;
    }

    const updated = await prisma.vaultDocument.update({
      where: { id: id as string },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(region !== undefined && { region }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
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

/** POST /api/vault/:id/replace - archive current file as a version, upload new one */
export async function replaceDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const { fileUrl, publicId, fileType, name } = req.body;

    if (!fileUrl) {
      res.status(400).json({ error: "fileUrl is required" });
      return;
    }

    const existing = await prisma.vaultDocument.findUnique({ where: { id: id as string } });
    if (!existing) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const userId = (req as any).user?.id;

    // Get current max version number
    const latestVersion = await prisma.vaultDocumentVersion.findFirst({
      where: { documentId: id as string },
      orderBy: { versionNum: "desc" },
      select: { versionNum: true },
    });
    const nextVersionNum = (latestVersion?.versionNum ?? 0) + 1;

    // Archive current file as a version
    if (existing.fileUrl) {
      await prisma.vaultDocumentVersion.create({
        data: {
          documentId: id as string,
          versionNum: nextVersionNum,
          name: existing.name,
          fileUrl: existing.fileUrl,
          publicId: existing.publicId ?? null,
          fileType: existing.fileType ?? null,
          uploadedBy: existing.uploadedBy ?? null,
        },
      });
    }

    // Update document with new file (do NOT delete old S3 asset — it's versioned)
    const updated = await prisma.vaultDocument.update({
      where: { id: id as string },
      data: {
        fileUrl,
        publicId: publicId || null,
        fileType: fileType || existing.fileType || "file",
        uploadedBy: userId ?? existing.uploadedBy,
        ...(name && { name }),
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

/** GET /api/vault/:id/versions - list archived versions for a document */
export async function getDocumentVersions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;

    const versions = await prisma.vaultDocumentVersion.findMany({
      where: { documentId: id as string },
      orderBy: { versionNum: "desc" },
      include: {
        uploader: { select: { fullName: true, email: true } },
      },
    });

    res.json(versions);
  } catch (err) {
    next(err);
  }
}

/** GET /api/vault/expiry-alerts - certifications expiring within 60 days */
export async function getExpiryAlerts(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const sixtyDaysFromNow = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    const expiring = await prisma.vaultDocument.findMany({
      where: {
        isFolder: false,
        category: "Certifications",
        expiryDate: { not: null, lte: sixtyDaysFromNow },
      },
      include: {
        uploader: { select: { fullName: true, email: true } },
        _count: { select: { children: true } },
      },
      orderBy: { expiryDate: "asc" },
    });

    res.json(expiring);
  } catch (err) {
    next(err);
  }
}

/** GET /api/vault/folder-policy - returns canRead/canEdit for a given folder context */
export async function getFolderPolicy(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { folderId } = req.query as { folderId?: string };
    const user = (req as any).user;

    const policy = await resolveFolderPolicy(folderId || null);
    const isAdmin = user?.roles?.includes("admin") ?? false;

    const canRead = policy.read === "all" || isAdmin;
    const canEdit = (policy.edit === "all" && (isAdmin || user?.permissions?.some((p: any) => p.permission === "vault" && p.accessLevel === "edit"))) || isAdmin;

    res.json({ canRead, canEdit });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/vault/:id - delete a document/folder and its S3 file */
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

    const user = (req as any).user;
    const isAdmin = user?.roles?.includes("admin") ?? false;
    const hasVaultEdit = user?.permissions?.some((p: any) => p.permission === "vault" && p.accessLevel === "edit") ?? false;
    const policy = await resolveFolderPolicy(existing.parentId);
    if (!(isAdmin || (policy.edit === "all" && hasVaultEdit))) {
      res.status(403).json({ error: "You do not have permission to delete files in this folder" });
      return;
    }

    // If it's a file, remove from S3
    if (!existing.isFolder && existing.publicId) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: existing.publicId }));
      } catch {
        // File may already be removed from S3; continue
      }
    }

    // Cascade delete is handled by Prisma relation (onDelete: Cascade)
    await prisma.vaultDocument.delete({ where: { id: id as string } });

    res.json({ message: "Document deleted successfully" });
  } catch (err) {
    next(err);
  }
}
