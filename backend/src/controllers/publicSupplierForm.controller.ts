import { Request, Response } from "express";
import prisma from "../config/db.js";
import { executeMarkResponse } from "./sourcingEmailCampaign.controller.js";
import multer from "multer";
import multerS3 from "multer-s3";
import { sendFormSubmissionNotificationEmail, buildSupplierThankYouEmailHtml, sendSupplierThankYouEmail } from "../services/mailer.js";
import { sendGmailEmail, getIntroEmailHeaders } from "../services/gmailService.js";
import { s3, S3_BUCKET, s3FileUrl } from "../lib/s3.js";

const publicFormStorage = multerS3({
    s3,
    bucket: S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req: any, file: Express.Multer.File, cb: (err: Error | null, key: string) => void) => {
        const baseName = file.originalname.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
        const extMatch = file.originalname.match(/\.[^/.]+$/);
        const ext = extMatch ? extMatch[0] : "";
        cb(null, `supplier-forms/form_upload_${Date.now()}_${baseName}${ext}`);
    },
});

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
        const url: string = s3FileUrl((file as any).key);
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
    gmailThreadId?: string | null;
    gmailMessageId?: string | null;
}): void {
    const { supplierEmail, supplierCompany, contactPerson, assignedGmailAccount, gmailThreadId, gmailMessageId } = params;
    setTimeout(async () => {
        try {
            const senderEmail = assignedGmailAccount ?? process.env.SMTP_EMAIL!;
            const senderName = "Élan Exports Team";

            const { subject, html } = buildSupplierThankYouEmailHtml({
                contactPerson,
                supplierCompany,
                senderName,
                senderEmail,
            });

            if (assignedGmailAccount) {
                let inReplyTo: string | undefined;
                let references: string | undefined;
                let replySubject = subject;

                if (gmailMessageId) {
                    // Fetch the intro email's SMTP Message-ID AND subject in one call.
                    // Gmail requires the subject to match the thread AND In-Reply-To to be set
                    // for threadId to work on both sender and recipient side.
                    const headers = await getIntroEmailHeaders(assignedGmailAccount, gmailMessageId);
                    if (headers.smtpMessageId) {
                        inReplyTo = headers.smtpMessageId;
                        references = headers.smtpMessageId;
                    }
                    if (headers.subject) {
                        // Strip any existing Re: prefix then add one
                        replySubject = `Re: ${headers.subject.replace(/^Re:\s*/i, "")}`;
                    }
                }

                await sendGmailEmail({
                    fromEmail: assignedGmailAccount,
                    to: supplierEmail,
                    subject: replySubject,
                    html,
                    threadId: gmailThreadId ?? undefined,
                    inReplyTo,
                    references,
                });
            } else {
                await sendSupplierThankYouEmail({ to: supplierEmail, contactPerson, supplierCompany, senderName, senderEmail });
            }
        } catch (err) {
            console.error("Supplier thank-you email failed:", err);
        }
    }, 5 * 60 * 1000);
}

async function sendNotificationToCreator(
    assignedGmailAccount: string | null | undefined,
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
        // Primary recipient = the Gmail account that did the sourcing
        // (e.g. procurement1@eectrade.com, partners@eectrade.com, procurement2@eectrade.com)
        // Fallback = the CRM user who created the record, then the SMTP account
        let recipient: string | null = assignedGmailAccount ?? null;
        let adminName = assignedGmailAccount ?? "Team";

        if (!recipient && createdBy) {
            const creator = await (prisma as any).user.findUnique({
                where: { id: createdBy },
                select: { email: true, fullName: true },
            });
            if (creator?.email) {
                recipient = creator.email;
                adminName = creator.fullName ?? "Team";
            }
        }

        if (!recipient) {
            recipient = process.env.SMTP_EMAIL ?? null;
        }

        if (!recipient) {
            console.warn("[FormNotification] No recipient email found — skipping notification.");
            return;
        }

        console.log(`[FormNotification] Sending submission notification for "${params.supplierCompany}" to: ${recipient}`);

        await sendFormSubmissionNotificationEmail({
            to: recipient,
            adminName,
            ...params,
        });

        console.log(`[FormNotification] Notification sent successfully to ${recipient}`);
    } catch (err) {
        console.error("[FormNotification] Failed to send notification email:", err);
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

        // Try sourcing supplier (include campaign so we can get gmailThreadId / gmailMessageId)
        const sourcing = await (prisma as any).sourcingSupplier.findUnique({
            where: { formToken: token },
            include: { emailCampaign: { select: { gmailThreadId: true, gmailMessageId: true } } },
        });

        if (sourcing) {
            const merged = { ...sourcing, ...update };

            if (Object.keys(update).length > 0) {
                await (prisma as any).sourcingSupplier.update({
                    where: { formToken: token },
                    data: update,
                });
            }

            if (finalSubmit) {
                const crmBase = "https://crm.eectrade.com";

                // Notify the sourcing account (assignedGmailAccount) — awaited so errors appear in logs
                await sendNotificationToCreator(sourcing.assignedGmailAccount, sourcing.createdBy, {
                    supplierCompany: merged.company,
                    contactPerson: merged.contactPerson,
                    supplierEmail: merged.email,
                    phone: merged.phone,
                    whatsapp: merged.whatsapp,
                    product: merged.product,
                    country: merged.country,
                    city: merged.city,
                    viewFormUrl: `${crmBase}/supplier-form/${sourcing.formToken}${sourcing.formTemplateId ? `?t=${sourcing.formTemplateId}` : ""}`,
                });

                // Schedule a thank-you email to the supplier after 5 minutes
                if (merged.email) {
                    scheduleSupplierThankYou({
                        supplierEmail: merged.email as string,
                        supplierCompany: merged.company,
                        contactPerson: merged.contactPerson as string | null,
                        assignedGmailAccount: sourcing.assignedGmailAccount,
                        createdBy: sourcing.createdBy,
                        // Thread IDs live on SourcingEmailCampaign, not SourcingSupplier
                        gmailThreadId: sourcing.emailCampaign?.gmailThreadId ?? null,
                        gmailMessageId: sourcing.emailCampaign?.gmailMessageId ?? null,
                    });
                }

                // Auto-convert to New Supplier if not already converted
                if (sourcing.status !== "converted_to_new") {
                    try {
                        const newSupplierId = await executeMarkResponse(sourcing.id);
                        if (newSupplierId) {
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
