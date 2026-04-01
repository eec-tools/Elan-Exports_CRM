import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { createNotification } from "../services/notificationService.js";
import { syncDealStageFromDeal } from "../services/dealStageSync.service.js";

const prisma = new PrismaClient();

// GET /api/deals
export const getAllDeals = async (_req: Request, res: Response) => {
  try {
    const deals = await prisma.deal.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(deals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch deals" });
  }
};

// POST /api/deals
export const createDeal = async (req: Request, res: Response) => {
  try {
    const {
      title,
      buyer,
      supplier,
      product,
      hsCode,
      volume,
      price,
      expectedRevenue,
      margin,
      stage,
      probability,
      category,
      riskScore,
      notes,
    } = req.body;

    const user = (req as any).user;

    const deal = await prisma.deal.create({
      data: {
        title,
        buyer,
        supplier,
        product,
        hsCode,
        volume,
        price: price ? parseFloat(price) : null,
        expectedRevenue: expectedRevenue ? parseFloat(expectedRevenue) : null,
        margin: margin ? parseFloat(margin) : 15,
        stage: stage || "Communication",
        probability: probability ? parseFloat(probability) : 20,
        category,
        riskScore: riskScore || "Medium",
        notes,
        createdBy: user?.id ?? null,
      },
    });
    res.status(201).json(deal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create deal" });
  }
};

// PATCH /api/deals/:id
export const updateDeal = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const {
      title,
      buyer,
      supplier,
      product,
      hsCode,
      volume,
      price,
      expectedRevenue,
      margin,
      stage,
      probability,
      category,
      riskScore,
      notes,
    } = req.body;

    const existing = await prisma.deal.findUnique({ where: { id }, select: { stage: true, title: true, supplier: true } });

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(buyer !== undefined && { buyer }),
        ...(supplier !== undefined && { supplier }),
        ...(product !== undefined && { product }),
        ...(hsCode !== undefined && { hsCode }),
        ...(volume !== undefined && { volume }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(expectedRevenue !== undefined && {
          expectedRevenue: parseFloat(expectedRevenue),
        }),
        ...(margin !== undefined && { margin: parseFloat(margin) }),
        ...(stage !== undefined && { stage }),
        ...(probability !== undefined && {
          probability: parseFloat(probability),
        }),
        ...(category !== undefined && { category }),
        ...(riskScore !== undefined && { riskScore }),
        ...(notes !== undefined && { notes }),
      },
    });

    // If stage changed, sync to suppliers and reports
    if (stage !== undefined && existing?.stage !== stage) {
      await createNotification({
        type: "deal_stage_change",
        title: "Deal Stage Updated",
        message: `Deal "${deal.title}" moved from ${existing?.stage} → ${stage}`,
        entityType: "deal",
        entityId: deal.id,
        entityName: deal.title,
        entityLink: `/deals`,
      });

      // Sync the stage change to all related suppliers and reports
      const supplierName = supplier !== undefined ? supplier : existing?.supplier;
      if (supplierName) {
        await syncDealStageFromDeal(deal.id, supplierName, stage);
      }
    }

    res.json(deal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update deal" });
  }
};

// DELETE /api/deals/:id
export const deleteDeal = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.deal.delete({ where: { id } });
    res.json({ message: "Deal deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete deal" });
  }
};
