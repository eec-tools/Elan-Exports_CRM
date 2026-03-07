import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { PrismaClient } from "@prisma/client";
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
    params: async (_req, file) => {
        let resource_type = "auto";
        let isRaw = false;
        if (file.mimetype === "application/pdf" ||
            file.originalname.toLowerCase().match(/\.(pdf|doc|docx|xls|xlsx|csv|zip)$/)) {
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
});
export const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});
// ─── Helper: derive fileType from mimetype ──────────
function deriveFileType(mimetype) {
    if (mimetype === "application/pdf")
        return "pdf";
    if (mimetype.startsWith("image/"))
        return "image";
    if (mimetype.includes("word") ||
        mimetype.includes("document") ||
        mimetype.includes("openxmlformats-officedocument.wordprocessingml"))
        return "doc";
    if (mimetype.includes("excel") ||
        mimetype.includes("sheet") ||
        mimetype.includes("openxmlformats-officedocument.spreadsheetml"))
        return "sheet";
    return "file";
}
// ─── Controllers ────────────────────────────────────
/** GET /api/vault - list all vault documents (optional ?category=) */
export async function listDocuments(req, res, next) {
    try {
        const { category, search } = req.query;
        const where = {};
        if (category && category !== "all")
            where.category = category;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
                { region: { contains: search, mode: "insensitive" } },
            ];
        }
        const documents = await prisma.vaultDocument.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                uploader: { select: { fullName: true, email: true } },
            },
        });
        res.json(documents);
    }
    catch (err) {
        next(err);
    }
}
/** GET /api/vault/categories - get category names + doc counts */
export async function getCategories(_req, res, next) {
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
    }
    catch (err) {
        next(err);
    }
}
/** POST /api/vault/upload - upload a new document */
export async function uploadDocument(req, res, next) {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        const { name, category, region } = req.body;
        if (!name || !category) {
            res.status(400).json({ error: "Name and category are required" });
            return;
        }
        const userId = req.user?.id;
        const doc = await prisma.vaultDocument.create({
            data: {
                name,
                category,
                region: region || "Global",
                fileUrl: file.path || file.secure_url || file.url,
                publicId: file.filename || file.public_id,
                fileType: deriveFileType(file.mimetype),
                uploadedBy: userId ?? null,
            },
            include: {
                uploader: { select: { fullName: true, email: true } },
            },
        });
        res.status(201).json(doc);
    }
    catch (err) {
        next(err);
    }
}
/** PUT /api/vault/:id - edit document metadata (name, category, region) */
export async function editDocument(req, res, next) {
    try {
        const { id } = req.params;
        const { name, category, region } = req.body;
        const existing = await prisma.vaultDocument.findUnique({ where: { id: id } });
        if (!existing) {
            res.status(404).json({ error: "Document not found" });
            return;
        }
        const updated = await prisma.vaultDocument.update({
            where: { id: id },
            data: {
                ...(name && { name }),
                ...(category && { category }),
                ...(region !== undefined && { region }),
            },
            include: {
                uploader: { select: { fullName: true, email: true } },
            },
        });
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
}
/** DELETE /api/vault/:id - delete a document and its Cloudinary file */
export async function deleteDocument(req, res, next) {
    try {
        const { id } = req.params;
        const existing = await prisma.vaultDocument.findUnique({ where: { id: id } });
        if (!existing) {
            res.status(404).json({ error: "Document not found" });
            return;
        }
        // Remove from Cloudinary
        try {
            await cloudinary.uploader.destroy(existing.publicId, {
                resource_type: existing.fileType === "image" ? "image" : "raw",
            });
        }
        catch {
            // File may already be removed from Cloudinary; continue
        }
        await prisma.vaultDocument.delete({ where: { id: id } });
        res.json({ message: "Document deleted successfully" });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=vault.controller.js.map