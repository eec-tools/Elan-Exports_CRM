import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { createNotification } from "../services/notificationService.js";
import { startCampaignForBuyer } from "./sourcingBuyerEmailCampaign.controller.js";
import { sanitizeEmail } from "../utils/email.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const EMAIL_SEND_DELAY_MS = 2 * 60 * 1000;

// Fixed Gmail account for all buyer outreach
export const BUYER_GMAIL_ACCOUNT = "partners@eectrade.com";

const BUYER_FIELDS = [
  "company", "email", "phone", "contactPerson", "country",
  "product", "productCategory", "notes", "assignedGmailAccount", "emailTemplateId",
] as const;

/**
 * GET /api/sourcing-buyers
 */
export async function listSourcingBuyers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const {
      search = "", page = "1", limit = "20",
      status, company, contactPerson, country, product, createdBy, assignedGmailAccount,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search) {
      where.OR = [
        { company: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { product: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status && status !== "all") where.status = status;
    if (company && company !== "all") where.company = { equals: company, mode: "insensitive" };
    if (contactPerson && contactPerson !== "all") where.contactPerson = { equals: contactPerson, mode: "insensitive" };
    if (country && country !== "all") where.country = { equals: country, mode: "insensitive" };
    if (product && product !== "all") where.product = { equals: product, mode: "insensitive" };
    if (createdBy && createdBy !== "all") where.createdBy = createdBy;
    if (assignedGmailAccount && assignedGmailAccount !== "all") {
      where.assignedGmailAccount = { equals: assignedGmailAccount, mode: "insensitive" };
    }

    const [buyers, total] = await Promise.all([
      (prisma as any).sourcingBuyer.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: {
          emailCampaign: true,
          creator: { select: { fullName: true } },
        },
      }),
      (prisma as any).sourcingBuyer.count({ where }),
    ]);

    res.json({
      data: buyers,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error("List sourcing buyers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/sourcing-buyers/stats
 */
export async function getSourcingBuyerStats(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [total, activeCampaigns, responseReceived, converted, noResponse, invalidEmails] =
      await Promise.all([
        (prisma as any).sourcingBuyer.count({ where: { status: { not: "invalid" } } }),
        (prisma as any).sourcingBuyerEmailCampaign.count({ where: { status: "active" } }),
        (prisma as any).sourcingBuyer.count({ where: { status: "response_received" } }),
        (prisma as any).sourcingBuyer.count({ where: { status: "converted_to_buyer" } }),
        (prisma as any).sourcingBuyer.count({ where: { status: "no_response" } }),
        (prisma as any).sourcingBuyer.count({ where: { status: "invalid" } }),
      ]);

    res.json({ total, activeCampaigns, responseReceived, converted, noResponse, invalidEmails });
  } catch (err) {
    console.error("Sourcing buyer stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/sourcing-buyers/:id
 */
export async function getSourcingBuyer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const buyer = await (prisma as any).sourcingBuyer.findUnique({
      where: { id: req.params.id },
      include: {
        emailCampaign: true,
        creator: { select: { fullName: true } },
      },
    });
    if (!buyer) { res.status(404).json({ error: "Sourcing buyer not found" }); return; }
    res.json(buyer);
  } catch (err) {
    console.error("Get sourcing buyer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/sourcing-buyers
 */
export async function createSourcingBuyer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { company, email, phone, contactPerson, country, product, productCategory, notes, emailTemplateId } = req.body;

    if (!company) { res.status(400).json({ error: "Company name is required" }); return; }
    if (!email) { res.status(400).json({ error: "Buyer email is required" }); return; }

    const cleanEmail = sanitizeEmail(email)!;
    const buyer = await (prisma as any).sourcingBuyer.create({
      data: {
        company, email: cleanEmail, phone: phone ?? null, contactPerson: contactPerson ?? null,
        country: country ?? null, product: product ?? null,
        productCategory: productCategory ?? null, notes: notes ?? null,
        assignedGmailAccount: BUYER_GMAIL_ACCOUNT,
        emailTemplateId: emailTemplateId ?? null,
        status: "pending",
        createdBy: req.user!.id,
      },
    });

    let campaignStarted = false;
    campaignStarted = await startCampaignForBuyer(buyer.id, req.user?.id);

    res.status(201).json({ ...buyer, campaignStarted });
  } catch (err) {
    console.error("Create sourcing buyer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/sourcing-buyers/:id
 */
export async function updateSourcingBuyer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).sourcingBuyer.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: "Sourcing buyer not found" }); return; }

    const updateData: any = {};
    for (const field of BUYER_FIELDS) {
      if (req.body[field] !== undefined) updateData[field] = field === "email" ? sanitizeEmail(req.body[field]) : req.body[field];
    }

    const updated = await (prisma as any).sourcingBuyer.update({ where: { id }, data: updateData });
    res.json(updated);
  } catch (err) {
    console.error("Update sourcing buyer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE /api/sourcing-buyers/:id
 */
export async function deleteSourcingBuyer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).sourcingBuyer.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: "Sourcing buyer not found" }); return; }

    await (prisma as any).sourcingBuyer.delete({ where: { id } });

    // Clean up matching buyer vault contact if present
    let deletedFromVault = false;
    if (existing.email) {
      const vaultMatch = await (prisma as any).buyerVaultContact.findFirst({
        where: { company: existing.company, email: existing.email },
      });
      if (vaultMatch) {
        await (prisma as any).buyerVaultContact.delete({ where: { id: vaultMatch.id } });
        deletedFromVault = true;
      }
    }

    res.json({ success: true, deletedFromVault });
  } catch (err) {
    console.error("Delete sourcing buyer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/sourcing-buyers/from-folder?folderId=X
 * Returns BuyerVaultContact rows with emailStatus = "Not Sent"
 */
export async function getVaultFolderNotSent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { folderId } = req.query as Record<string, string>;
    if (!folderId) { res.status(400).json({ error: "folderId is required" }); return; }

    const contacts = await (prisma as any).buyerVaultContact.findMany({
      where: { folderId, emailStatus: "Not Sent" },
      orderBy: { createdAt: "desc" },
    });

    res.json(contacts);
  } catch (err) {
    console.error("Get vault folder not-sent buyers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/sourcing-buyers/from-folder
 * Promotes all "Not Sent" vault contacts from a folder to the SourcingBuyer pipeline.
 */
export async function addFromVaultFolder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { folderId, emailTemplateId } = req.body as {
      folderId: string;
      emailTemplateId?: string;
    };

    if (!folderId) { res.status(400).json({ error: "folderId is required" }); return; }

    const folder = await (prisma as any).buyerVaultFolder.findUnique({ where: { id: folderId } });
    if (!folder) { res.status(404).json({ error: "Folder not found" }); return; }

    const vaultContacts = await (prisma as any).buyerVaultContact.findMany({
      where: { folderId, emailStatus: "Not Sent" },
    });

    if (vaultContacts.length === 0) {
      res.status(400).json({ error: "No unsent contacts in this folder" });
      return;
    }

    const vaultIdByCompanyEmail = new Map<string, string>(
      vaultContacts.map((c: any) => [`${c.company}||${c.email ?? ""}`, c.id] as [string, string]),
    );

    const buyerData = vaultContacts.map((c: any) => ({
      company: c.company,
      email: c.email,
      phone: c.phone,
      contactPerson: c.contactPerson,
      country: c.country,
      product: c.product,
      notes: c.notes,
      productCategory: folder.name,
      assignedGmailAccount: BUYER_GMAIL_ACCOUNT,
      emailTemplateId: emailTemplateId ?? null,
      status: "pending",
      createdBy: req.user!.id,
    }));

    const createdBuyers: any[] = await (prisma as any).$transaction(async (tx: any) => {
      const created: any[] = [];
      for (const data of buyerData) {
        try {
          const b = await tx.sourcingBuyer.create({ data });
          created.push(b);
        } catch (e: any) {
          if (e?.code === "P2002") continue;
          throw e;
        }
      }
      return created;
    });

    // Respond immediately — campaigns sent in background
    res.status(201).json({
      added: createdBuyers.length,
      sending: true,
    });

    const userId = req.user?.id;
    (async () => {
      for (let i = 0; i < createdBuyers.length; i++) {
        const buyer = createdBuyers[i];
        const campaignStarted = buyer.email ? await startCampaignForBuyer(buyer.id, userId) : false;

        if (campaignStarted || !buyer.email) {
          const key = `${buyer.company}||${buyer.email ?? ""}`;
          const vaultId = vaultIdByCompanyEmail.get(key);
          if (vaultId) {
            await (prisma as any).buyerVaultContact.update({
              where: { id: vaultId },
              data: { emailStatus: "Sent" },
            });
          }
        }
        if (campaignStarted && i < createdBuyers.length - 1) {
          await sleep(EMAIL_SEND_DELAY_MS);
        }
      }
      console.log("[addFromVaultFolder buyers] Background send complete");
    })().catch((err) => console.error("[addFromVaultFolder buyers] Background send error:", err));
  } catch (err) {
    console.error("Add from vault folder buyers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/sourcing-buyers/:id/convert
 * Convert a responded sourcing buyer to the Buyers Directory.
 */
export async function convertToBuyer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const sourcing = await (prisma as any).sourcingBuyer.findUnique({ where: { id } });

    if (!sourcing) { res.status(404).json({ error: "Sourcing buyer not found" }); return; }
    if (sourcing.status === "converted_to_buyer") {
      res.status(400).json({ error: "Buyer has already been converted" });
      return;
    }

    const newBuyer = await (prisma as any).$transaction(async (tx: any) => {
      const created = await tx.buyer.create({
        data: {
          company: sourcing.company,
          name: sourcing.contactPerson ?? sourcing.company,
          email: sourcing.email ?? "",
          phone: sourcing.phone ?? null,
          country: sourcing.country ?? "Unknown",
          productCategoryInterest: sourcing.product ?? sourcing.productCategory ?? null,
          notes: sourcing.notes ?? null,
          leadSource: "Sourcing Outreach",
          status: "Prospect",
          requiredProducts: [],
          supplierLinks: [],
          documents: [],
          createdBy: req.user!.id,
        },
      });

      await tx.sourcingBuyer.update({
        where: { id },
        data: { status: "converted_to_buyer" },
      });

      return created;
    });

    await createNotification({
      type: "buyer_converted",
      title: "Sourcing Buyer Converted",
      message: `${sourcing.company} has been added to the Buyers Directory`,
      entityType: "buyer",
      entityId: newBuyer.id,
      entityName: sourcing.company,
      entityLink: `/buyers/${newBuyer.id}`,
      createdBy: req.user?.id,
    });

    res.status(201).json(newBuyer);
  } catch (err) {
    console.error("Convert sourcing buyer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
