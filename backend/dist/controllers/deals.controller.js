import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
// GET /api/deals
export const getAllDeals = async (_req, res) => {
    try {
        const deals = await prisma.deal.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json(deals);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch deals" });
    }
};
// POST /api/deals
export const createDeal = async (req, res) => {
    try {
        const { title, buyer, supplier, product, hsCode, volume, price, expectedRevenue, margin, stage, probability, category, riskScore, notes, } = req.body;
        const user = req.user;
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
                stage: stage || "LEAD",
                probability: probability ? parseFloat(probability) : 20,
                category,
                riskScore: riskScore || "Medium",
                notes,
                createdBy: user?.id ?? null,
            },
        });
        res.status(201).json(deal);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create deal" });
    }
};
// PATCH /api/deals/:id
export const updateDeal = async (req, res) => {
    try {
        const id = req.params.id;
        const { title, buyer, supplier, product, hsCode, volume, price, expectedRevenue, margin, stage, probability, category, riskScore, notes, } = req.body;
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
        res.json(deal);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update deal" });
    }
};
// DELETE /api/deals/:id
export const deleteDeal = async (req, res) => {
    try {
        const id = req.params.id;
        await prisma.deal.delete({ where: { id } });
        res.json({ message: "Deal deleted" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete deal" });
    }
};
//# sourceMappingURL=deals.controller.js.map