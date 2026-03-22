import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";
import { createNotification } from "../services/notificationService.js";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * GET /api/intro-campaigns
 * List all campaigns with supplier info
 */
export async function listCampaigns(req: AuthRequest, res: Response) {
  try {
    const campaigns = await prisma.supplierEmailCampaign.findMany({
      include: {
        supplier: {
          select: { id: true, company: true, email: true, contactPerson: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
}

/**
 * GET /api/intro-campaigns/due
 * Suppliers where nextFollowupDue <= today and status = active
 */
export async function getDueCampaigns(req: AuthRequest, res: Response) {
  try {
    const today = endOfDay(new Date());
    const campaigns = await prisma.supplierEmailCampaign.findMany({
      where: {
        status: "active",
        nextFollowupDue: { lte: today },
      },
      include: {
        supplier: {
          select: { id: true, company: true, email: true, contactPerson: true },
        },
      },
      orderBy: { nextFollowupDue: "asc" },
    });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch due campaigns" });
  }
}

/**
 * GET /api/intro-campaigns/stats
 */
export async function getCampaignStats(req: AuthRequest, res: Response) {
  try {
    const today = endOfDay(new Date());
    const todayStart = startOfDay(new Date());

    const [active, dueToday, completed, responseReceived] = await Promise.all([
      prisma.supplierEmailCampaign.count({ where: { status: "active" } }),
      prisma.supplierEmailCampaign.count({
        where: {
          status: "active",
          nextFollowupDue: { gte: todayStart, lte: today },
        },
      }),
      prisma.supplierEmailCampaign.count({ where: { status: "completed" } }),
      prisma.supplierEmailCampaign.count({
        where: { status: "response_received" },
      }),
    ]);

    res.json({ active, dueToday, completed, responseReceived });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch campaign stats" });
  }
}

/**
 * GET /api/intro-campaigns/:supplierId
 */
export async function getCampaign(req: AuthRequest, res: Response) {
  try {
    const supplierId = req.params.id as string;
    const campaign = await prisma.supplierEmailCampaign.findUnique({
      where: { supplierId },
      include: {
        supplier: {
          select: { id: true, company: true, email: true, contactPerson: true },
        },
      },
    });
    if (!campaign) {
      return res.status(404).json({ error: "No campaign found for this supplier" });
    }
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch campaign" });
  }
}

/**
 * POST /api/intro-campaigns/:supplierId/start
 * Create campaign and mark intro email as sent
 */
export async function startCampaign(req: AuthRequest, res: Response) {
  try {
    const supplierId = req.params.id as string;

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    const existing = await prisma.supplierEmailCampaign.findUnique({
      where: { supplierId },
    });
    if (existing) {
      return res.status(409).json({ error: "Campaign already exists for this supplier" });
    }

    const now = new Date();
    const campaign = await prisma.supplierEmailCampaign.create({
      data: {
        supplierId,
        status: "active",
        currentStep: 1,
        introEmailSentAt: now,
        nextFollowupDue: addDays(now, 3),
      },
    });

    res.status(201).json(campaign);
  } catch (err) {
    res.status(500).json({ error: "Failed to start campaign" });
  }
}

/**
 * POST /api/intro-campaigns/:supplierId/mark-sent
 * Mark the next follow-up in sequence as sent
 */
export async function markEmailSent(req: AuthRequest, res: Response) {
  try {
    const supplierId = req.params.id as string;

    const campaign = await prisma.supplierEmailCampaign.findUnique({
      where: { supplierId },
    });
    if (!campaign) {
      return res.status(404).json({ error: "No campaign found for this supplier" });
    }
    if (campaign.status !== "active") {
      return res.status(400).json({ error: `Campaign is already ${campaign.status}` });
    }

    const now = new Date();
    let updateData: Record<string, unknown> = {};

    if (campaign.currentStep === 1) {
      updateData = {
        currentStep: 2,
        followup1SentAt: now,
        nextFollowupDue: addDays(now, 3),
      };
    } else if (campaign.currentStep === 2) {
      updateData = {
        currentStep: 3,
        followup2SentAt: now,
        nextFollowupDue: addDays(now, 3),
      };
    } else if (campaign.currentStep === 3) {
      updateData = {
        currentStep: 4,
        followup3SentAt: now,
        nextFollowupDue: null,
        status: "completed",
      };
    } else {
      return res.status(400).json({ error: "Campaign is already completed" });
    }

    const updated = await prisma.supplierEmailCampaign.update({
      where: { supplierId },
      data: updateData,
      include: { supplier: { select: { company: true } } },
    });

    if (updateData.status === "completed") {
      await createNotification({
        type: "campaign_completed",
        title: "Email Campaign Completed",
        message: `All follow-up emails completed for ${updated.supplier.company}`,
        entityType: "supplier",
        entityId: supplierId,
        entityName: updated.supplier.company,
        entityLink: `/suppliers/signed-contract/${supplierId}`,
        createdBy: req.user?.id,
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to mark email as sent" });
  }
}

/**
 * POST /api/intro-campaigns/:supplierId/mark-response
 * Record that supplier responded — stops the campaign
 */
export async function markResponseReceived(req: AuthRequest, res: Response) {
  try {
    const supplierId = req.params.id as string;

    const campaign = await prisma.supplierEmailCampaign.findUnique({
      where: { supplierId },
    });
    if (!campaign) {
      return res.status(404).json({ error: "No campaign found for this supplier" });
    }
    if (campaign.status === "response_received") {
      return res.status(400).json({ error: "Response already recorded" });
    }

    const updated = await prisma.supplierEmailCampaign.update({
      where: { supplierId },
      data: {
        status: "response_received",
        responseReceivedAt: new Date(),
        nextFollowupDue: null,
      },
      include: { supplier: { select: { company: true } } },
    });

    await createNotification({
      type: "campaign_responded",
      title: "Supplier Responded",
      message: `${updated.supplier.company} responded to the intro email — campaign stopped`,
      entityType: "supplier",
      entityId: supplierId,
      entityName: updated.supplier.company,
      entityLink: `/suppliers/signed-contract/${supplierId}`,
      createdBy: req.user?.id,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to record response" });
  }
}
