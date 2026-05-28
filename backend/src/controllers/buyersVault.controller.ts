import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { sendGmailEmail } from "../services/gmailService.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const EMAIL_SEND_DELAY_MS = 2 * 60 * 1000;

/**
 * GET /api/buyers-vault
 * Returns all buyer vault folders, each enriched with a BuyerVaultContact count.
 */
export async function listFolders(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const folders = await (prisma as any).buyerVaultFolder.findMany({
      orderBy: { createdAt: "asc" },
      include: { creator: { select: { fullName: true } } },
    });

    const counts = await Promise.all(
      folders.map((f: any) =>
        (prisma as any).buyerVaultContact.count({
          where: { folderId: f.id },
        }),
      ),
    );

    const result = folders.map((f: any, i: number) => ({
      ...f,
      supplierCount: counts[i],
    }));

    res.json(result);
  } catch (err) {
    console.error("List buyer vault folders error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/buyers-vault
 * Creates a new buyer vault folder.
 */
export async function createFolder(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { name } = req.body as { name: string };

    if (!name?.trim()) {
      res.status(400).json({ error: "Folder name is required" });
      return;
    }

    const trimmed = name.trim();

    const existing = await (prisma as any).buyerVaultFolder.findFirst({
      where: { name: { equals: trimmed, mode: "insensitive" } },
    });
    if (existing) {
      res.status(409).json({ error: `A folder named "${trimmed}" already exists` });
      return;
    }

    const folder = await (prisma as any).buyerVaultFolder.create({
      data: { name: trimmed, createdBy: req.user!.id },
      include: { creator: { select: { fullName: true } } },
    });

    res.status(201).json({ ...folder, supplierCount: 0 });
  } catch (err) {
    console.error("Create buyer vault folder error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE /api/buyers-vault/:id
 */
export async function deleteFolder(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    const folder = await (prisma as any).buyerVaultFolder.findUnique({
      where: { id },
    });
    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    await (prisma as any).buyerVaultFolder.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete buyer vault folder error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/buyers-vault/:folderId/suppliers
 * Returns vault contacts for a folder.
 */
export async function listVaultSuppliers(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { folderId } = req.params as { folderId: string };
    const { emailStatus, createdBy, search } = req.query as Record<string, string>;

    const where: any = { folderId };
    if (emailStatus) where.emailStatus = emailStatus;
    if (createdBy && createdBy !== "all") where.createdBy = createdBy;
    if (search) {
      where.OR = [
        { company: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
        { product: { contains: search, mode: "insensitive" } },
      ];
    }

    const contacts = await (prisma as any).buyerVaultContact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { creator: { select: { fullName: true } } },
    });

    res.json(contacts);
  } catch (err) {
    console.error("List buyer vault contacts error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/buyers-vault/:folderId/suppliers
 * "Add to List" — stages buyer contacts with emailStatus = "Not Sent".
 */
export async function addToList(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { folderId } = req.params as { folderId: string };
    const { suppliers } = req.body as {
      suppliers: Array<{
        company: string;
        email?: string;
        phone?: string;
        contactPerson?: string;
        country?: string;
        product?: string;
        notes?: string;
      }>;
    };

    const folder = await (prisma as any).buyerVaultFolder.findUnique({
      where: { id: folderId },
    });
    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      res.status(400).json({ error: "No contacts provided" });
      return;
    }

    const validRows = suppliers.filter((s) => s.company?.trim());
    if (validRows.length === 0) {
      res.status(400).json({ error: "All rows are missing company name" });
      return;
    }

    const data = validRows.map((s) => ({
      folderId,
      company: s.company.trim(),
      email: s.email?.trim() || null,
      phone: s.phone?.trim() || null,
      contactPerson: s.contactPerson?.trim() || null,
      country: s.country?.trim() || null,
      product: s.product?.trim() || null,
      notes: s.notes?.trim() || null,
      emailStatus: "Not Sent",
      createdBy: req.user!.id,
    }));

    const result = await (prisma as any).buyerVaultContact.createMany({ data });

    res.status(201).json({ added: result.count });
  } catch (err) {
    console.error("Add to buyer vault list error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/buyers-vault/:folderId/suppliers/send
 * "Send Bulk Email" — creates vault contact records and sends emails via Gmail.
 * Does NOT create Buyer pipeline records (handled separately by colleague).
 */
export async function sendBulkEmail(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { folderId } = req.params as { folderId: string };
    const { suppliers, assignedGmailAccount, emailTemplateId } = req.body as {
      suppliers: Array<{
        company: string;
        email?: string;
        phone?: string;
        contactPerson?: string;
        country?: string;
        product?: string;
        notes?: string;
      }>;
      assignedGmailAccount?: string;
      emailTemplateId?: string;
    };

    const folder = await (prisma as any).buyerVaultFolder.findUnique({
      where: { id: folderId },
    });
    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      res.status(400).json({ error: "No contacts provided" });
      return;
    }

    const validRows = suppliers.filter((s) => s.company?.trim());
    if (validRows.length === 0) {
      res.status(400).json({ error: "All rows are missing company name" });
      return;
    }

    // Fetch email template if provided
    let emailTemplate: any = null;
    if (emailTemplateId) {
      emailTemplate = await (prisma as any).emailCampaignTemplate.findUnique({
        where: { id: emailTemplateId },
      });
    }

    // Create vault contact records
    const createdContacts: Array<{ id: string; email?: string | null; company: string }> = [];

    await (prisma as any).$transaction(async (tx: any) => {
      for (const s of validRows) {
        const contact = await tx.buyerVaultContact.create({
          data: {
            folderId,
            company: s.company.trim(),
            email: s.email?.trim() || null,
            phone: s.phone?.trim() || null,
            contactPerson: s.contactPerson?.trim() || null,
            country: s.country?.trim() || null,
            product: s.product?.trim() || null,
            notes: s.notes?.trim() || null,
            emailStatus: "Not Sent",
            createdBy: req.user!.id,
          },
        });
        createdContacts.push({ id: contact.id, email: contact.email, company: contact.company });
      }
    });

    // Respond immediately — emails sent in background
    res.status(201).json({ added: createdContacts.length, sending: true });

    (async () => {
      for (let i = 0; i < createdContacts.length; i++) {
        const contact = createdContacts[i];
        if (!contact.email || !assignedGmailAccount || !emailTemplate) continue;

        let emailSent = false;
        try {
          const subject = emailTemplate.introSubject || `Introduction from Elan Exports`;
          const body = (emailTemplate.introBody || "").replace(/\{\{company\}\}/gi, contact.company);

          await sendGmailEmail({
            fromEmail: assignedGmailAccount,
            to: contact.email,
            subject,
            html: body,
          });
          emailSent = true;
        } catch (e) {
          console.error(`[buyersVault sendBulkEmail] Failed to send to ${contact.email}:`, e);
        }

        if (emailSent) {
          await (prisma as any).buyerVaultContact.update({
            where: { id: contact.id },
            data: { emailStatus: "Sent" },
          });
          if (i < createdContacts.length - 1) {
            await sleep(EMAIL_SEND_DELAY_MS);
          }
        }
      }
      console.log(`[buyersVault sendBulkEmail] Background send complete for folder ${folderId}`);
    })().catch((err) => console.error("[buyersVault sendBulkEmail] Background send error:", err));
  } catch (err) {
    console.error("Buyer vault send bulk email error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/buyers-vault/:folderId/suppliers/:supplierId
 * Edit a vault contact — only allowed when emailStatus is "Not Sent".
 */
export async function updateVaultSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { folderId, supplierId } = req.params as { folderId: string; supplierId: string };
    const { company, email, phone, contactPerson, country, product, notes } = req.body;

    const contact = await (prisma as any).buyerVaultContact.findUnique({
      where: { id: supplierId },
    });

    if (!contact || contact.folderId !== folderId) {
      res.status(404).json({ error: "Contact not found in this folder" });
      return;
    }
    if (contact.emailStatus === "Sent") {
      res.status(400).json({ error: "Cannot edit a contact that has already been sent" });
      return;
    }

    const updated = await (prisma as any).buyerVaultContact.update({
      where: { id: supplierId },
      data: {
        company: company?.trim() || contact.company,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        country: country?.trim() || null,
        product: product?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Update buyer vault contact error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE /api/buyers-vault/:folderId/suppliers/:supplierId
 * Delete a vault contact.
 */
export async function deleteVaultSupplier(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { folderId, supplierId } = req.params as { folderId: string; supplierId: string };

    const contact = await (prisma as any).buyerVaultContact.findUnique({
      where: { id: supplierId },
    });

    if (!contact || contact.folderId !== folderId) {
      res.status(404).json({ error: "Contact not found in this folder" });
      return;
    }

    await (prisma as any).buyerVaultContact.delete({ where: { id: supplierId } });

    res.json({ success: true, deletedFromPipeline: false });
  } catch (err) {
    console.error("Delete buyer vault contact error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/buyers-vault/:folderId/creators
 * Returns distinct employees who added contacts to this folder.
 */
export async function listVaultCreators(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { folderId } = req.params as { folderId: string };

    const rows = await (prisma as any).buyerVaultContact.findMany({
      where: { folderId, createdBy: { not: null } },
      select: { createdBy: true, creator: { select: { fullName: true } } },
      distinct: ["createdBy"],
      orderBy: { creator: { fullName: "asc" } },
    });

    const creators = rows
      .filter((r: any) => r.createdBy && r.creator)
      .map((r: any) => ({
        id: r.createdBy as string,
        fullName: r.creator.fullName as string,
      }));

    res.json(creators);
  } catch (err) {
    console.error("List buyer vault creators error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
