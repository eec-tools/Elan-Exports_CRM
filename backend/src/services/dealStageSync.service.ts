import { PrismaClient } from "@prisma/client";
import { createNotification } from "./notificationService.js";

const prisma = new PrismaClient();

/**
 * Valid deal stages in order
 */
export const DEAL_STAGES = [
    "Communication",
    "Sampling",
    "Quotation",
    "Negotiation with EEC",
    "Price quotation to Buyer after EEC approval",
    "Negotiation with buyer",
    "Price approval by buyer",
    "Quotation send to the supplier from buyer end",
    "Orders confirmed from buyers end",
    "Timeline (Product shipping.. etc) should be established from suppliers end",
] as const;

export type DealStage = typeof DEAL_STAGES[number];

/**
 * Sync deal stage from a supplier to all related deals and reports
 * If no deal exists for this supplier, create one automatically
 * @param supplierCompanyName - The company name of the supplier
 * @param newStage - The new deal stage
 * @param sourceEntity - Where the change originated from (for notifications)
 */
export async function syncDealStageFromSupplier(
    supplierCompanyName: string,
    newStage: string,
    sourceEntity: "NewSupplier" | "Supplier" | "OldSupplier"
) {
    if (!supplierCompanyName) return;

    // Check if any deals exist for this supplier
    const existingDeals = await prisma.deal.findMany({
        where: { supplier: supplierCompanyName },
    });

    // If no deals exist, create one automatically
    if (existingDeals.length === 0) {
        // Get supplier details to populate the deal
        let supplierData: any = null;

        if (sourceEntity === "Supplier") {
            supplierData = await prisma.supplier.findFirst({
                where: { company: supplierCompanyName },
            });
        } else if (sourceEntity === "NewSupplier") {
            supplierData = await prisma.newSupplier.findFirst({
                where: { company: supplierCompanyName },
            });
        } else if (sourceEntity === "OldSupplier") {
            supplierData = await prisma.oldSupplier.findFirst({
                where: { company: supplierCompanyName },
            });
        }

        // Create a new deal for this supplier
        const newDeal = await prisma.deal.create({
            data: {
                title: `${supplierCompanyName} - Deal`,
                supplier: supplierCompanyName,
                buyer: supplierData?.contractBuyer || supplierData?.accountManager || null,
                product: supplierData?.products || supplierData?.product || null,
                stage: newStage,
                probability: 20,
                margin: 15,
                riskScore: "Medium",
                notes: `Auto-created from ${sourceEntity}`,
            },
        });

        await createNotification({
            type: "deal_created",
            title: "Deal Auto-Created",
            message: `New deal created for ${supplierCompanyName} with stage "${newStage}"`,
            entityType: "deal",
            entityId: newDeal.id,
            entityName: newDeal.title,
            entityLink: `/deals`,
        });

        // Update reports
        const updatedReports = await prisma.report.updateMany({
            where: {
                companyName: supplierCompanyName,
                buyerSupplier: "Supplier",
            },
            data: { dealStage: newStage },
        });

        return { dealsCreated: 1, dealsUpdated: 0, reportsUpdated: updatedReports.count };
    }

    // Update all existing deals where supplier matches this company name
    const updatedDeals = await prisma.deal.updateMany({
        where: { supplier: supplierCompanyName },
        data: { stage: newStage },
    });

    // Update all reports where companyName matches and buyerSupplier is "Supplier"
    const updatedReports = await prisma.report.updateMany({
        where: {
            companyName: supplierCompanyName,
            buyerSupplier: "Supplier",
        },
        data: { dealStage: newStage },
    });

    // Create notification if any entities were updated
    if (updatedDeals.count > 0 || updatedReports.count > 0) {
        await createNotification({
            type: "deal_stage_sync",
            title: "Deal Stage Synced",
            message: `Deal stage updated to "${newStage}" for ${supplierCompanyName}. ${updatedDeals.count} deal(s) and ${updatedReports.count} report(s) updated.`,
            entityType: sourceEntity.toLowerCase(),
            entityId: supplierCompanyName,
            entityName: supplierCompanyName,
            entityLink: `/suppliers`,
        });
    }

    return { dealsCreated: 0, dealsUpdated: updatedDeals.count, reportsUpdated: updatedReports.count };
}

/**
 * Sync deal stage from a deal to all related suppliers and reports
 * @param dealId - The ID of the deal
 * @param supplierCompanyName - The supplier company name from the deal
 * @param newStage - The new deal stage
 */
export async function syncDealStageFromDeal(
    dealId: string,
    supplierCompanyName: string | null | undefined,
    newStage: string
) {
    if (!supplierCompanyName) return { suppliersUpdated: 0, reportsUpdated: 0 };

    let suppliersUpdated = 0;

    // Update NewSupplier if exists
    const newSupplier = await prisma.newSupplier.updateMany({
        where: { company: supplierCompanyName },
        data: { dealStage: newStage },
    });
    suppliersUpdated += newSupplier.count;

    // Update Supplier (signed contracts) if exists
    const supplier = await prisma.supplier.updateMany({
        where: { company: supplierCompanyName },
        data: { dealStage: newStage },
    });
    suppliersUpdated += supplier.count;

    // Update OldSupplier if exists
    const oldSupplier = await prisma.oldSupplier.updateMany({
        where: { company: supplierCompanyName },
        data: { dealStage: newStage },
    });
    suppliersUpdated += oldSupplier.count;

    // Update all reports where companyName matches
    const updatedReports = await prisma.report.updateMany({
        where: {
            companyName: supplierCompanyName,
            buyerSupplier: "Supplier",
        },
        data: { dealStage: newStage },
    });

    // Create notification if any entities were updated
    if (suppliersUpdated > 0 || updatedReports.count > 0) {
        await createNotification({
            type: "deal_stage_sync",
            title: "Deal Stage Synced",
            message: `Deal stage updated to "${newStage}" for ${supplierCompanyName}. ${suppliersUpdated} supplier(s) and ${updatedReports.count} report(s) updated.`,
            entityType: "deal",
            entityId: dealId,
            entityName: supplierCompanyName,
            entityLink: `/deals`,
        });
    }

    return { suppliersUpdated, reportsUpdated: updatedReports.count };
}

/**
 * Auto-create a deal for a newly created supplier
 * @param supplierCompanyName - The company name of the supplier
 * @param sourceEntity - Where the supplier was created from
 * @param supplierData - The supplier data to populate the deal
 */
export async function autoCreateDealForSupplier(
    supplierCompanyName: string,
    sourceEntity: "NewSupplier" | "Supplier" | "OldSupplier",
    supplierData: any
) {
    if (!supplierCompanyName) return;

    // Check if a deal already exists for this supplier
    const existingDeal = await prisma.deal.findFirst({
        where: { supplier: supplierCompanyName },
    });

    // If deal already exists, don't create a new one
    if (existingDeal) return { dealCreated: false, dealId: existingDeal.id };

    // Create a new deal for this supplier
    const newDeal = await prisma.deal.create({
        data: {
            title: `${supplierCompanyName} - Deal`,
            supplier: supplierCompanyName,
            buyer: supplierData?.contractBuyer || supplierData?.accountManager || null,
            product: supplierData?.products || supplierData?.product || null,
            stage: supplierData?.dealStage || "Communication",
            probability: 20,
            margin: 15,
            riskScore: "Medium",
            notes: `Auto-created from ${sourceEntity}`,
        },
    });

    await createNotification({
        type: "deal_created",
        title: "Deal Auto-Created",
        message: `New deal created for ${supplierCompanyName}`,
        entityType: "deal",
        entityId: newDeal.id,
        entityName: newDeal.title,
        entityLink: `/deals`,
    });

    return { dealCreated: true, dealId: newDeal.id };
}

