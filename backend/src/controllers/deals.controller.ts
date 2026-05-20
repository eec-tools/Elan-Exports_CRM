import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { createNotification } from "../services/notificationService.js";
import { syncDealStageFromDeal } from "../services/dealStageSync.service.js";

const prisma = new PrismaClient();

function flattenDeal(deal: any) {
  const { creator, ...rest } = deal;
  return { ...rest, creatorName: creator?.fullName ?? null };
}

// GET /api/deals
export const getAllDeals = async (req: Request, res: Response) => {
  try {
    const { supplier } = req.query as { supplier?: string };
    const deals = await prisma.deal.findMany({
      where: supplier ? { supplier: { equals: supplier, mode: "insensitive" } } : undefined,
      orderBy: { createdAt: "desc" },
      include: { creator: { select: { fullName: true } } },
    });
    res.json(deals.map(flattenDeal));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch deals" });
  }
};

// POST /api/deals
export const createDeal = async (req: Request, res: Response) => {
  try {
    const {
      title, buyer, supplier, product, hsCode, volume, price,
      expectedRevenue, margin, stage, probability, category, riskScore, notes,
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
        stageEnteredAt: new Date(),
        createdBy: user?.id ?? null,
      },
      include: { creator: { select: { fullName: true } } },
    });
    res.status(201).json(flattenDeal(deal));
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
      title, buyer, supplier, product, hsCode, volume, price,
      expectedRevenue, margin, stage, probability, category, riskScore, notes,
    } = req.body;

    const existing = await prisma.deal.findUnique({
      where: { id },
      select: { stage: true, title: true, supplier: true },
    });

    const stageChanging = stage !== undefined && existing?.stage !== stage;

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
        ...(expectedRevenue !== undefined && { expectedRevenue: parseFloat(expectedRevenue) }),
        ...(margin !== undefined && { margin: parseFloat(margin) }),
        ...(stage !== undefined && { stage }),
        ...(probability !== undefined && { probability: parseFloat(probability) }),
        ...(category !== undefined && { category }),
        ...(riskScore !== undefined && { riskScore }),
        ...(notes !== undefined && { notes }),
        // Stamp the time when stage changes
        ...(stageChanging && { stageEnteredAt: new Date() }),
      },
      include: { creator: { select: { fullName: true } } },
    });

    if (stageChanging) {
      await createNotification({
        type: "deal_stage_change",
        title: "Deal Stage Updated",
        message: `Deal "${deal.title}" moved from ${existing?.stage} → ${stage}`,
        entityType: "deal",
        entityId: deal.id,
        entityName: deal.title,
        entityLink: `/deals`,
      });

      const supplierName = supplier !== undefined ? supplier : existing?.supplier;
      if (supplierName) {
        await syncDealStageFromDeal(deal.id, supplierName, stage);
      }
    }

    res.json(flattenDeal(deal));
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
