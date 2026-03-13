import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
// GET /api/compliance  — all docs with deal info
export const getAllComplianceDocs = async (_req, res) => {
    try {
        const docs = await prisma.complianceDocument.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                deal: {
                    select: { id: true, title: true, buyer: true, stage: true },
                },
            },
        });
        res.json(docs);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch compliance documents" });
    }
};
// POST /api/compliance
export const createComplianceDoc = async (req, res) => {
    try {
        const { dealId, docType, status, dueDate, notes } = req.body;
        if (!dealId || !docType) {
            return res.status(400).json({ error: "dealId and docType are required" });
        }
        const doc = await prisma.complianceDocument.create({
            data: {
                dealId,
                docType,
                status: status ?? "MISSING",
                dueDate: dueDate ? new Date(dueDate) : null,
                notes: notes ?? null,
            },
            include: {
                deal: { select: { id: true, title: true, buyer: true, stage: true } },
            },
        });
        res.status(201).json(doc);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create compliance document" });
    }
};
// PATCH /api/compliance/:id
export const updateComplianceDoc = async (req, res) => {
    try {
        const id = req.params.id;
        const { status, dueDate, notes, docType } = req.body;
        const doc = await prisma.complianceDocument.update({
            where: { id },
            data: {
                ...(status !== undefined && { status }),
                ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
                ...(notes !== undefined && { notes }),
                ...(docType !== undefined && { docType }),
            },
            include: {
                deal: { select: { id: true, title: true, buyer: true, stage: true } },
            },
        });
        res.json(doc);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update compliance document" });
    }
};
// DELETE /api/compliance/:id
export const deleteComplianceDoc = async (req, res) => {
    try {
        const id = req.params.id;
        await prisma.complianceDocument.delete({ where: { id } });
        res.json({ message: "Compliance document deleted" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete compliance document" });
    }
};
//# sourceMappingURL=compliance.controller.js.map