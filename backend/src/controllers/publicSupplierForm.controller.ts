import { Request, Response } from "express";
import prisma from "../config/db.js";
import { v2 as cloudinary } from "cloudinary";
import { executeMarkResponse } from "./sourcingEmailCampaign.controller.js";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { sendFormSubmissionNotificationEmail, buildSupplierThankYouEmailHtml, sendSupplierThankYouEmail } from "../services/mailer.js";
import { sendGmailEmail } from "../services/gmailService.js";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const publicFormStorage = new CloudinaryStorage({
    cloudinary,
    params: async (_req: Express.Request, file: Express.Multer.File) => {
        const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().match(/\.(pdf|doc|docx|xls|xlsx|csv|zip)$/);
        const extMatch = file.originalname.match(/\.[^/.]+$/);
        const ext = isPdf && extMatch ? extMatch[0] : "";
        const baseName = file.originalname.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
        return {
            folder: "elan-supplier-forms",
            resource_type: isPdf ? "raw" : "auto",
            public_id: `form_upload_${Date.now()}_${baseName}${ext}`,
        };
    },
} as any);

export const publicFormUpload = multer({
    storage: publicFormStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
});

/**
 * POST /api/public/supplier-form/:token/upload
 * Upload a file from the public form (no auth required).
 */
export async function uploadPublicFormFile(_req: Request, res: Response): Promise<void> {
    try {
        const file = (_req as any).file;
        if (!file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        const url: string = file.path || file.secure_url || file.url;
        res.json({ url, name: (_req as any).file.originalname });
    } catch (err) {
        console.error("Public form upload error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
}

const ALL_SECTIONS_ENABLED = {
    identity: { enabled: true, requiredFields: [] },
    contacts: { enabled: true, requiredFields: [] },
    products: { enabled: true, requiredFields: [] },
    production: { enabled: true, requiredFields: [] },
    commercial: { enabled: true, requiredFields: [] },
    regulatory: { enabled: true, requiredFields: [] },
    certifications: { enabled: true, requiredFields: [] },
    organic: { enabled: true, requiredFields: [] },
    labTesting: { enabled: true, requiredFields: [] },
    branding: { enabled: true, requiredFields: [] },
    processing: { enabled: true, requiredFields: [] },
    media: { enabled: true, requiredFields: [] },
};

function scheduleSupplierThankYou(params: {
    supplierEmail: string;
    supplierCompany: string;
    contactPerson?: string | null;
    assignedGmailAccount?: string | null;
    createdBy?: string | null;
}): void {
    const { supplierEmail, supplierCompany, contactPerson, assignedGmailAccount, createdBy } = params;
    setTimeout(async () => {
        try {
            let senderEmail = process.env.SMTP_EMAIL ?? "sales@elanexports.com";
            let senderName = "Élan Exports Team";

            if (createdBy) {
                const creator = await (prisma as any).user.findUnique({
                    where: { id: createdBy },
                    select: { email: true, fullName: true },
                });
                if (creator?.email) {
                    senderEmail = creator.email;
                    senderName = creator.fullName ?? senderName;
                }
            }

            const { subject, html } = buildSupplierThankYouEmailHtml({
                contactPerson,
                supplierCompany,
                senderName,
                senderEmail,
            });

            if (assignedGmailAccount) {
                await sendGmailEmail({ fromEmail: assignedGmailAccount, to: supplierEmail, subject, html });
            } else {
                await sendSupplierThankYouEmail({ to: supplierEmail, contactPerson, supplierCompany, senderName, senderEmail });
            }
        } catch (err) {
            console.error("Supplier thank-you email failed:", err);
        }
    }, 5 * 60 * 1000);
}

async function sendNotificationToCreator(
    createdBy: string | null | undefined,
    params: {
        supplierCompany: string;
        contactPerson?: string | null;
        supplierEmail?: string | null;
        phone?: string | null;
        whatsapp?: string | null;
        product?: string | null;
        country?: string | null;
        city?: string | null;
        viewFormUrl: string;
    }
): Promise<void> {
    try {
        let recipientEmail: string | null = process.env.SMTP_EMAIL ?? null;
        let adminName = "Team";

        if (createdBy) {
            const creator = await (prisma as any).user.findUnique({
                where: { id: createdBy },
                select: { email: true, fullName: true },
            });
            if (creator?.email) {
                recipientEmail = creator.email;
                adminName = creator.fullName ?? "Team";
            }
        }

        if (!recipientEmail) return;

        await sendFormSubmissionNotificationEmail({
            to: recipientEmail,
            adminName,
            ...params,
        });
    } catch (err) {
        console.error("Form submission notification email failed:", err);
    }
}

/**
 * GET /api/public/supplier-form/:token
 * Publicly accessible — no auth required.
 * Looks up token in SourcingSupplier first, then NewSupplier.
 */
export async function getPublicForm(req: Request, res: Response): Promise<void> {
    try {
        const { token } = req.params;
        const templateId = req.query.t as string | undefined;

        // Resolve template: explicit ?t= param takes priority, then default, then all-sections
        const template = templateId
            ? await (prisma as any).supplierFormTemplate.findUnique({ where: { id: templateId } })
            : await (prisma as any).supplierFormTemplate.findFirst({ where: { isDefault: true } });
        const templateConfig = template?.config ?? ALL_SECTIONS_ENABLED;

        // Try sourcing supplier first
        const sourcing = await (prisma as any).sourcingSupplier.findUnique({
            where: { formToken: token },
        });

        if (sourcing) {
            res.json({
                supplierType: "sourcing",
                id: sourcing.id,
                company: sourcing.company,
                contactPerson: sourcing.contactPerson,
                email: sourcing.email,
                templateConfig,
                formData: buildFormData(sourcing),
            });
            return;
        }

        // Try new supplier
        const newSupplier = await (prisma as any).newSupplier.findUnique({
            where: { formToken: token },
        });

        if (newSupplier) {
            res.json({
                supplierType: "new",
                id: newSupplier.id,
                company: newSupplier.company,
                contactPerson: newSupplier.contactPerson,
                email: newSupplier.email,
                templateConfig,
                formData: buildFormData(newSupplier),
            });
            return;
        }

        res.status(404).json({ error: "Form not found. The link may be invalid or expired." });
    } catch (err) {
        console.error("Get public form error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * POST /api/public/supplier-form/:token
 * Submit (or partially save) the form. Merges non-empty fields only.
 */
export async function submitPublicForm(req: Request, res: Response): Promise<void> {
    try {
        const { token } = req.params;
        const { fields, finalSubmit } = req.body as { fields: Record<string, unknown>; finalSubmit?: boolean };

        if (!fields || typeof fields !== "object") {
            res.status(400).json({ error: "Invalid form data" });
            return;
        }

        // Build a safe update payload — only include fields that are non-empty strings
        // so we never overwrite already-filled values with blanks
        const update: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
            if (value !== null && value !== undefined && value !== "") {
                update[key] = value;
            }
        }

        // Blacklist fields that should never be updated via the public form
        const forbidden = new Set([
            "id", "formToken", "supplierStage", "status", "createdBy",
            "createdAt", "updatedAt", "buyerIds", "blacklistedBuyerIds",
            "vettingScore", "exclusivityArrangement", "eecMarginPercent",
            "factoryVisitStatus", "factoryVisitDate", "factoryVisitOutcome",
            "referralSource", "dealStage",
            // EEC / internal-only fields
            "notes", "latestQuotation", "accountManager", "currentStatus",
            "certifications", "reasonInactive", "dateMarkedInactive",
            "reactivationPotential",
        ]);
        for (const key of forbidden) {
            delete update[key];
        }

        // Try sourcing supplier
        const sourcing = await (prisma as any).sourcingSupplier.findUnique({
            where: { formToken: token },
        });

        if (sourcing) {
            const merged = { ...sourcing, ...update };

            if (Object.keys(update).length > 0) {
                await (prisma as any).sourcingSupplier.update({
                    where: { formToken: token },
                    data: update,
                });
            }

            // Auto-convert to New Supplier on final submission if not already converted
            if (finalSubmit && sourcing.status !== "converted_to_new") {
                // Notify the creator (CRM user) immediately
                sendNotificationToCreator(sourcing.createdBy, {
                    supplierCompany: merged.company,
                    contactPerson: merged.contactPerson,
                    supplierEmail: merged.email,
                    phone: merged.phone,
                    whatsapp: merged.whatsapp,
                    product: merged.product,
                    country: merged.country,
                    city: merged.city,
                    viewFormUrl: `${(process.env.FRONTEND_URL ?? "http://localhost:5173").split(",")[0]}/suppliers/sourcing/${sourcing.id}`,
                });

                // Schedule a thank-you email to the supplier after 5 minutes
                if (merged.email) {
                    scheduleSupplierThankYou({
                        supplierEmail: merged.email as string,
                        supplierCompany: merged.company,
                        contactPerson: merged.contactPerson as string | null,
                        assignedGmailAccount: sourcing.assignedGmailAccount,
                        createdBy: sourcing.createdBy,
                    });
                }

                try {
                    const newSupplierId = await executeMarkResponse(sourcing.id);
                    if (newSupplierId) {
                        // Store the sourcing origin on the new supplier record
                        await (prisma as any).newSupplier.update({
                            where: { id: newSupplierId },
                            data: { convertedFromSourcingId: sourcing.id },
                        });
                    }
                    res.json({ success: true, converted: true, newSupplierId });
                    return;
                } catch (convErr) {
                    console.error("Auto-convert error after form submit:", convErr);
                    // Non-fatal — form data is already saved
                }
            }

            res.json({ success: true });
            return;
        }

        // Try new supplier
        const newSupplier = await (prisma as any).newSupplier.findUnique({
            where: { formToken: token },
        });

        if (newSupplier) {
            if (Object.keys(update).length > 0) {
                await (prisma as any).newSupplier.update({
                    where: { formToken: token },
                    data: update,
                });
            }
            res.json({ success: true });
            return;
        }

        res.status(404).json({ error: "Form not found. The link may be invalid or expired." });
    } catch (err) {
        console.error("Submit public form error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * Extract the form-fillable fields from a supplier record.
 * Excludes internal/system fields.
 */
function buildFormData(supplier: Record<string, unknown>): Record<string, unknown> {
    const excluded = new Set([
        "id", "formToken", "supplierStage", "status", "createdBy", "createdAt", "updatedAt",
        "buyerIds", "blacklistedBuyerIds", "vettingScore", "exclusivityArrangement",
        "eecMarginPercent", "factoryVisitStatus", "factoryVisitDate", "factoryVisitOutcome",
        "referralSource", "dealStage", "emailCampaign", "accountManager",
        "latestQuotation", "reasonInactive", "dateMarkedInactive", "reactivationPotential",
        "currentStatus", "certifications", "notes",
    ]);

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(supplier)) {
        if (!excluded.has(key) && value !== null && value !== undefined) {
            result[key] = value;
        }
    }
    return result;
}
