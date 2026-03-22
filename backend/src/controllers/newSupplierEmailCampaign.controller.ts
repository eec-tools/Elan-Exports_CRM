import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { createNotification } from "../services/notificationService.js";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * GET /api/new-supplier-campaigns
 */
export async function listCampaigns(req: AuthRequest, res: Response) {
  try {
    const campaigns = await prisma.newSupplierEmailCampaign.findMany({
      include: {
        newSupplier: {
          select: { id: true, company: true, email: true, accountManager: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(campaigns);
  } catch {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
}

/**
 * GET /api/new-supplier-campaigns/due
 */
export async function getDueCampaigns(req: AuthRequest, res: Response) {
  try {
    const today = endOfDay(new Date());
    const campaigns = await prisma.newSupplierEmailCampaign.findMany({
      where: { status: "active", nextFollowupDue: { lte: today } },
      include: {
        newSupplier: {
          select: { id: true, company: true, email: true, accountManager: true },
        },
      },
      orderBy: { nextFollowupDue: "asc" },
    });
    res.json(campaigns);
  } catch {
    res.status(500).json({ error: "Failed to fetch due campaigns" });
  }
}

/**
 * GET /api/new-supplier-campaigns/stats
 */
export async function getCampaignStats(req: AuthRequest, res: Response) {
  try {
    const today = endOfDay(new Date());
    const todayStart = startOfDay(new Date());

    const [active, dueToday, completed, responseReceived] = await Promise.all([
      prisma.newSupplierEmailCampaign.count({ where: { status: "active" } }),
      prisma.newSupplierEmailCampaign.count({
        where: { status: "active", nextFollowupDue: { gte: todayStart, lte: today } },
      }),
      prisma.newSupplierEmailCampaign.count({ where: { status: "completed" } }),
      prisma.newSupplierEmailCampaign.count({ where: { status: "response_received" } }),
    ]);

    res.json({ active, dueToday, completed, responseReceived });
  } catch {
    res.status(500).json({ error: "Failed to fetch campaign stats" });
  }
}

/**
 * GET /api/new-supplier-campaigns/:id
 */
export async function getCampaign(req: AuthRequest, res: Response) {
  try {
    const newSupplierId = req.params.id as string;
    const campaign = await prisma.newSupplierEmailCampaign.findUnique({
      where: { newSupplierId },
      include: {
        newSupplier: {
          select: { id: true, company: true, email: true, accountManager: true },
        },
      },
    });
    if (!campaign) {
      return res.status(404).json({ error: "No campaign found for this supplier" });
    }
    res.json(campaign);
  } catch {
    res.status(500).json({ error: "Failed to fetch campaign" });
  }
}

/**
 * POST /api/new-supplier-campaigns/:id/start
 */
export async function startCampaign(req: AuthRequest, res: Response) {
  try {
    const newSupplierId = req.params.id as string;

    const supplier = await prisma.newSupplier.findUnique({ where: { id: newSupplierId } });
    if (!supplier) {
      return res.status(404).json({ error: "New supplier not found" });
    }

    const existing = await prisma.newSupplierEmailCampaign.findUnique({ where: { newSupplierId } });
    if (existing) {
      return res.status(409).json({ error: "Campaign already exists for this supplier" });
    }

    const now = new Date();
    const campaign = await prisma.newSupplierEmailCampaign.create({
      data: {
        newSupplierId,
        status: "active",
        currentStep: 1,
        introEmailSentAt: now,
        nextFollowupDue: addDays(now, 3),
      },
    });

    res.status(201).json(campaign);
  } catch {
    res.status(500).json({ error: "Failed to start campaign" });
  }
}

/**
 * POST /api/new-supplier-campaigns/:id/mark-sent
 */
export async function markEmailSent(req: AuthRequest, res: Response) {
  try {
    const newSupplierId = req.params.id as string;

    const campaign = await prisma.newSupplierEmailCampaign.findUnique({ where: { newSupplierId } });
    if (!campaign) {
      return res.status(404).json({ error: "No campaign found for this supplier" });
    }
    if (campaign.status !== "active") {
      return res.status(400).json({ error: `Campaign is already ${campaign.status}` });
    }

    const now = new Date();
    let updateData: Record<string, unknown> = {};

    if (campaign.currentStep === 1) {
      updateData = { currentStep: 2, followup1SentAt: now, nextFollowupDue: addDays(now, 3) };
    } else if (campaign.currentStep === 2) {
      updateData = { currentStep: 3, followup2SentAt: now, nextFollowupDue: addDays(now, 3) };
    } else if (campaign.currentStep === 3) {
      updateData = { currentStep: 4, followup3SentAt: now, nextFollowupDue: null, status: "completed" };
    } else {
      return res.status(400).json({ error: "Campaign is already completed" });
    }

    const updated = await prisma.newSupplierEmailCampaign.update({
      where: { newSupplierId },
      data: updateData,
      include: { newSupplier: { select: { company: true } } },
    });

    if (updateData.status === "completed") {
      await createNotification({
        type: "campaign_completed",
        title: "Email Campaign Completed",
        message: `All follow-up emails completed for ${updated.newSupplier.company}`,
        entityType: "new_supplier",
        entityId: newSupplierId,
        entityName: updated.newSupplier.company,
        entityLink: `/suppliers/new/${newSupplierId}`,
        createdBy: req.user?.id,
      });
    }

    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to mark email as sent" });
  }
}

/**
 * POST /api/new-supplier-campaigns/:id/mark-response
 */
export async function markResponseReceived(req: AuthRequest, res: Response) {
  try {
    const newSupplierId = req.params.id as string;

    const campaign = await prisma.newSupplierEmailCampaign.findUnique({ where: { newSupplierId } });
    if (!campaign) {
      return res.status(404).json({ error: "No campaign found for this supplier" });
    }
    if (campaign.status === "response_received") {
      return res.status(400).json({ error: "Response already recorded" });
    }

    const updated = await prisma.newSupplierEmailCampaign.update({
      where: { newSupplierId },
      data: { status: "response_received", responseReceivedAt: new Date(), nextFollowupDue: null },
      include: { newSupplier: { select: { company: true } } },
    });

    await createNotification({
      type: "campaign_responded",
      title: "Supplier Responded",
      message: `${updated.newSupplier.company} responded to the intro email — campaign stopped`,
      entityType: "new_supplier",
      entityId: newSupplierId,
      entityName: updated.newSupplier.company,
      entityLink: `/suppliers/new/${newSupplierId}`,
      createdBy: req.user?.id,
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to record response" });
  }
}
