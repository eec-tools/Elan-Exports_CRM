import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildDateFilter(from?: string, to?: string) {
  if (!from && !to) return undefined;
  const filter: any = {};
  if (from) filter.gte = new Date(from);
  if (to) filter.lte = new Date(to);
  return filter;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function parseCategoryString(val: string | null | undefined): string[] {
  if (!val) return [];
  return val
    .split(/[,;\/\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 60);
}

function groupByMonthTrend(dates: Date[]): { month: string; count: number }[] {
  const map = new Map<string, number>();
  for (const d of dates) {
    const key = monthLabel(d);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
}

function countFieldValues(
  rows: string[],
  topN = 15,
): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const val of rows) {
    for (const cat of parseCategoryString(val)) {
      const key = cat.toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// ─── GET /api/analytics/buyers-report ─────────────────────────────────────

export async function getBuyersReport(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { from, to } = req.query as Record<string, string>;
    const dateFilter = buildDateFilter(from, to);

    const buyerWhere: any = {};
    if (dateFilter) buyerWhere.createdAt = dateFilter;

    const [buyers, deals] = await Promise.all([
      prisma.buyer.findMany({
        where: buyerWhere,
        select: {
          id: true,
          company: true,
          name: true,
          country: true,
          region: true,
          status: true,
          riskRating: true,
          productCategoryInterest: true,
          productCategories: true,
          supplierLinks: true,
          createdAt: true,
          email: true,
          phone: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      (prisma as any).deal.findMany({
        select: {
          id: true,
          buyer: true,
          stage: true,
          expectedRevenue: true,
          probability: true,
          riskScore: true,
          createdAt: true,
        },
      }),
    ]);

    // Build buyer-name → deals map for O(1) lookup
    const dealsByBuyer = new Map<string, typeof deals>();
    for (const d of deals) {
      if (!d.buyer) continue;
      const key = d.buyer.toLowerCase().trim();
      if (!dealsByBuyer.has(key)) dealsByBuyer.set(key, []);
      dealsByBuyer.get(key)!.push(d);
    }

    // Compute per-buyer deal metrics
    const buyerRows = buyers.map((b: any) => {
      const key = (b.company || b.name || "").toLowerCase().trim();
      const bDeals = dealsByBuyer.get(key) ?? [];
      const pipelineValue = bDeals.reduce(
        (sum: number, d: any) => sum + (d.expectedRevenue ?? 0),
        0,
      );
      const latestDeal = bDeals[0] ?? null;
      const supplierLinkCount = Array.isArray(b.supplierLinks)
        ? b.supplierLinks.length
        : 0;
      return {
        id: b.id,
        company: b.company,
        name: b.name,
        country: b.country ?? "—",
        region: b.region ?? "—",
        status: b.status ?? "Pending",
        riskRating: b.riskRating ?? "—",
        productCategoryInterest: b.productCategoryInterest ?? b.productCategories ?? "—",
        email: b.email,
        phone: b.phone ?? "—",
        dealCount: bDeals.length,
        pipelineValue,
        lastDealStage: latestDeal?.stage ?? "—",
        linkedSupplierCount: supplierLinkCount,
      };
    });

    // KPIs
    const totalBuyers = buyers.length;
    const activeBuyers = buyers.filter((b: any) => b.status === "Active").length;
    const pendingBuyers = buyers.filter(
      (b: any) => !b.status || b.status === "Pending",
    ).length;
    const suspendedBuyers = buyers.filter(
      (b: any) => b.status === "Suspended",
    ).length;
    const highRiskCount = buyers.filter(
      (b: any) => b.riskRating === "High",
    ).length;
    const noDealBuyers = buyerRows.filter((b) => b.dealCount === 0);
    const withDeals = buyerRows.filter((b) => b.dealCount > 0);
    const totalPipelineValue = buyerRows.reduce(
      (sum, b) => sum + b.pipelineValue,
      0,
    );
    const avgDealValue =
      withDeals.length > 0 ? totalPipelineValue / withDeals.length : 0;
    const countriesCount = new Set(
      buyers.map((b: any) => b.country).filter(Boolean),
    ).size;

    // Status breakdown
    const statusMap = new Map<string, number>();
    for (const b of buyers) {
      const s = (b as any).status ?? "Pending";
      statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
    }
    const statusBreakdown = Array.from(statusMap.entries()).map(
      ([status, count]) => ({ status, count }),
    );

    // Buyers by country (top 15)
    const countryMap = new Map<string, number>();
    for (const b of buyers) {
      const c = (b as any).country ?? "Unknown";
      countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
    }
    const byCountry = Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Top buyers by pipeline value (top 10)
    const topByPipelineValue = [...buyerRows]
      .sort((a, b) => b.pipelineValue - a.pipelineValue)
      .slice(0, 10)
      .map((b) => ({
        company: b.company,
        name: b.name,
        pipelineValue: b.pipelineValue,
        dealCount: b.dealCount,
      }));

    // Deal stage distribution from all deals
    const stageMap = new Map<string, number>();
    for (const d of deals) {
      if (!d.stage) continue;
      stageMap.set(d.stage, (stageMap.get(d.stage) ?? 0) + 1);
    }
    const dealStageDistribution = Array.from(stageMap.entries())
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count);

    // Product category demand
    const productDemand = countFieldValues(
      buyers.map(
        (b: any) =>
          b.productCategoryInterest || b.productCategories || "",
      ),
    );

    // Risk rating distribution
    const riskMap = new Map<string, number>();
    for (const b of buyers) {
      const r = (b as any).riskRating ?? "Not Set";
      riskMap.set(r, (riskMap.get(r) ?? 0) + 1);
    }
    const riskDistribution = Array.from(riskMap.entries()).map(
      ([rating, count]) => ({ rating, count }),
    );

    // Acquisition trend (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    const recentBuyers = buyers.filter(
      (b: any) => b.createdAt >= twelveMonthsAgo,
    );
    const acquisitionTrend = groupByMonthTrend(
      recentBuyers.map((b: any) => b.createdAt),
    );

    // Buyers with no linked supplier but have deals
    const noSupplierLinkBuyers = buyerRows.filter(
      (b) => b.dealCount > 0 && b.linkedSupplierCount === 0,
    );

    res.json({
      kpis: {
        totalBuyers,
        activeBuyers,
        pendingBuyers,
        suspendedBuyers,
        totalPipelineValue: Math.round(totalPipelineValue),
        countriesCount,
        highRiskCount,
        noDealCount: noDealBuyers.length,
        avgDealValue: Math.round(avgDealValue),
      },
      statusBreakdown,
      byCountry,
      topByPipelineValue,
      dealStageDistribution,
      productDemand,
      riskDistribution,
      acquisitionTrend,
      buyerTable: buyerRows,
      noDealBuyers: noDealBuyers.map((b) => ({
        id: b.id,
        company: b.company,
        name: b.name,
        country: b.country,
        status: b.status,
        riskRating: b.riskRating,
        linkedSupplierCount: b.linkedSupplierCount,
      })),
      noSupplierLinkBuyers: noSupplierLinkBuyers.map((b) => ({
        id: b.id,
        company: b.company,
        dealCount: b.dealCount,
        pipelineValue: b.pipelineValue,
      })),
    });
  } catch (err) {
    console.error("Buyers report error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── GET /api/analytics/suppliers-report?tab=new|signed|old ───────────────

export async function getSuppliersReport(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { tab = "new", from, to } = req.query as Record<string, string>;
    const dateFilter = buildDateFilter(from, to);

    if (tab === "new") {
      const where: any = {};
      if (dateFilter) where.createdAt = dateFilter;

      const newSuppliers = await (prisma as any).newSupplier.findMany({
        where,
        select: {
          id: true,
          company: true,
          country: true,
          contactPerson: true,
          product: true,
          productCategory: true,
          currentStatus: true,
          dealStage: true,
          vettingScore: true,
          convertedFromSourcingId: true,
          createdAt: true,
          emailCampaign: {
            select: {
              status: true,
              currentStep: true,
              introEmailSentAt: true,
              followup1SentAt: true,
              followup2SentAt: true,
              followup3SentAt: true,
              responseReceivedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // KPIs
      const total = newSuppliers.length;
      const withCampaign = newSuppliers.filter((s: any) => s.emailCampaign).length;
      const responded = newSuppliers.filter(
        (s: any) => s.emailCampaign?.responseReceivedAt,
      ).length;
      const convertedFromSourcing = newSuppliers.filter(
        (s: any) => s.convertedFromSourcingId,
      ).length;
      const countries = new Set(
        newSuppliers.map((s: any) => s.country).filter(Boolean),
      ).size;

      // Avg days to respond
      const responseTimes: number[] = newSuppliers
        .filter(
          (s: any) =>
            s.emailCampaign?.introEmailSentAt &&
            s.emailCampaign?.responseReceivedAt,
        )
        .map((s: any) => {
          const sent = new Date(s.emailCampaign.introEmailSentAt).getTime();
          const resp = new Date(s.emailCampaign.responseReceivedAt).getTime();
          return Math.round((resp - sent) / (1000 * 60 * 60 * 24));
        });
      const avgDaysToRespond =
        responseTimes.length > 0
          ? Math.round(
              responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
            )
          : 0;

      // Onboarding funnel
      const funnelSteps = [
        "Added",
        "Intro Sent",
        "Followup 1",
        "Followup 2",
        "Followup 3",
        "Responded",
      ];
      const funnelCounts = [
        total,
        newSuppliers.filter((s: any) => s.emailCampaign?.introEmailSentAt).length,
        newSuppliers.filter((s: any) => s.emailCampaign?.followup1SentAt).length,
        newSuppliers.filter((s: any) => s.emailCampaign?.followup2SentAt).length,
        newSuppliers.filter((s: any) => s.emailCampaign?.followup3SentAt).length,
        responded,
      ];
      const onboardingFunnel = funnelSteps.map((step, i) => ({
        step,
        count: funnelCounts[i],
      }));

      // By country (top 15)
      const countryMap = new Map<string, number>();
      for (const s of newSuppliers) {
        const c = (s as any).country ?? "Unknown";
        countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
      }
      const byCountry = Array.from(countryMap.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      // Product coverage
      const productCoverage = countFieldValues(
        newSuppliers.map((s: any) => s.productCategory || s.product || ""),
      );

      // Time in pipeline buckets
      const now = Date.now();
      const buckets = [
        { label: "0-7 days", min: 0, max: 7 },
        { label: "8-14 days", min: 8, max: 14 },
        { label: "15-30 days", min: 15, max: 30 },
        { label: "31-60 days", min: 31, max: 60 },
        { label: "60+ days", min: 61, max: Infinity },
      ];
      const timeInPipeline = buckets.map(({ label, min, max }) => ({
        label,
        count: newSuppliers.filter((s: any) => {
          const days = Math.floor(
            (now - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24),
          );
          return days >= min && days <= max;
        }).length,
      }));

      // Monthly trend (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
      twelveMonthsAgo.setDate(1);
      const recentNew = newSuppliers.filter(
        (s: any) => new Date(s.createdAt) >= twelveMonthsAgo,
      );
      const monthlyTrend = groupByMonthTrend(
        recentNew.map((s: any) => new Date(s.createdAt)),
      );

      // Table
      const table = newSuppliers.map((s: any) => {
        const campaign = s.emailCampaign;
        let emailStage = "Not Started";
        if (campaign?.responseReceivedAt) emailStage = "Responded";
        else if (campaign?.followup3SentAt) emailStage = "Followup 3 Sent";
        else if (campaign?.followup2SentAt) emailStage = "Followup 2 Sent";
        else if (campaign?.followup1SentAt) emailStage = "Followup 1 Sent";
        else if (campaign?.introEmailSentAt) emailStage = "Intro Sent";

        return {
          id: s.id,
          company: s.company,
          country: s.country ?? "—",
          contactPerson: s.contactPerson ?? "—",
          product: s.productCategory || s.product || "—",
          emailStage,
          responded: !!campaign?.responseReceivedAt,
          convertedFromSourcing: !!s.convertedFromSourcingId,
          daysInPipeline: Math.floor(
            (now - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24),
          ),
          createdAt: s.createdAt,
        };
      });

      res.json({
        kpis: {
          total,
          withEmailCampaign: withCampaign,
          responded,
          convertedFromSourcing,
          avgDaysToRespond,
          countries,
        },
        onboardingFunnel,
        byCountry,
        productCoverage,
        timeInPipeline,
        monthlyTrend,
        table,
      });
    } else if (tab === "signed") {
      const where: any = {};
      if (dateFilter) where.createdAt = dateFilter;

      const [signedSuppliers, allDeals] = await Promise.all([
        prisma.supplier.findMany({
          where,
          select: {
            id: true,
            company: true,
            country: true,
            contactPerson: true,
            products: true,
            dealStage: true,
            vettingScore: true,
            eecMarginPercent: true,
            paymentTerms: true,
            haccpAvailable: true,
            isoFsscCertNo: true,
            fssaiLicense: true,
            apedaNumber: true,
            fdaRegistrationNumber: true,
            farmerOrganicCert: true,
            processingUnitOrganicCert: true,
            avgMonthlyVolume: true,
            buyerIds: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        (prisma as any).deal.findMany({
          select: {
            supplier: true,
            stage: true,
            expectedRevenue: true,
          },
        }),
      ]);

      const dealsBySupplier = new Map<string, typeof allDeals>();
      for (const d of allDeals) {
        if (!d.supplier) continue;
        const key = d.supplier.toLowerCase().trim();
        if (!dealsBySupplier.has(key)) dealsBySupplier.set(key, []);
        dealsBySupplier.get(key)!.push(d);
      }

      const enriched = signedSuppliers.map((s: any) => {
        const key = s.company.toLowerCase().trim();
        const sDeals = dealsBySupplier.get(key) ?? [];
        const pipelineValue = sDeals.reduce(
          (sum: number, d: any) => sum + (d.expectedRevenue ?? 0),
          0,
        );
        const marginNum = parseFloat(s.eecMarginPercent ?? "");
        const buyerCount = Array.isArray(s.buyerIds) ? s.buyerIds.length : 0;
        return {
          ...s,
          dealCount: sDeals.length,
          pipelineValue,
          marginPercent: isNaN(marginNum) ? null : marginNum,
          buyerCount,
          hasHaccp: s.haccpAvailable === "Yes" || s.haccpAvailable === "yes",
          hasIso: !!s.isoFsscCertNo,
          hasFssai: !!s.fssaiLicense,
          hasApeda: !!s.apedaNumber,
          hasFda: !!s.fdaRegistrationNumber,
          hasOrganic: !!(s.farmerOrganicCert || s.processingUnitOrganicCert),
        };
      });

      // KPIs
      const total = enriched.length;
      const withActiveDeals = enriched.filter((s: any) => s.dealCount > 0).length;
      const vettingScores = enriched
        .map((s: any) => s.vettingScore)
        .filter((v: any) => v != null) as number[];
      const marginValues = enriched
        .map((s: any) => s.marginPercent)
        .filter((v: any) => v != null) as number[];
      const avgVettingScore = avg(vettingScores);
      const avgMarginPercent =
        marginValues.length > 0
          ? Math.round(
              (marginValues.reduce((a, b) => a + b, 0) / marginValues.length) * 10,
            ) / 10
          : 0;
      const countries = new Set(
        enriched.map((s: any) => s.country).filter(Boolean),
      ).size;
      const haccpCount = enriched.filter((s: any) => s.hasHaccp).length;

      // Deal stage distribution from actual deals linked to these suppliers
      const signedDealStages = new Map<string, number>();
      for (const d of allDeals) {
        if (!d.stage) continue;
        signedDealStages.set(d.stage, (signedDealStages.get(d.stage) ?? 0) + 1);
      }
      const dealStageDistribution = Array.from(signedDealStages.entries())
        .map(([stage, count]) => ({ stage, count }))
        .sort((a, b) => b.count - a.count);

      // Top 10 by deal value
      const topByDealValue = [...enriched]
        .sort((a: any, b: any) => b.pipelineValue - a.pipelineValue)
        .slice(0, 10)
        .map((s: any) => ({
          company: s.company,
          pipelineValue: Math.round(s.pipelineValue),
          dealCount: s.dealCount,
          country: s.country ?? "—",
        }));

      // Vetting score distribution
      const vettingBuckets = [
        { label: "0-25", min: 0, max: 25 },
        { label: "26-50", min: 26, max: 50 },
        { label: "51-75", min: 51, max: 75 },
        { label: "76-100", min: 76, max: 100 },
      ];
      const vettingScoreDistribution = vettingBuckets.map(
        ({ label, min, max }) => ({
          label,
          count: vettingScores.filter((v) => v >= min && v <= max).length,
        }),
      );

      // Country breakdown
      const countryMap = new Map<string, number>();
      for (const s of enriched) {
        const c = (s as any).country ?? "Unknown";
        countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
      }
      const byCountry = Array.from(countryMap.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      // Payment terms breakdown
      const paymentMap = new Map<string, number>();
      for (const s of enriched) {
        const p = (s as any).paymentTerms ?? "Not Specified";
        const key = p.length > 30 ? p.slice(0, 30) + "…" : p;
        paymentMap.set(key, (paymentMap.get(key) ?? 0) + 1);
      }
      const paymentTermsBreakdown = Array.from(paymentMap.entries())
        .map(([terms, count]) => ({ terms, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // Certification coverage
      const certificationCoverage = [
        { cert: "HACCP", count: enriched.filter((s: any) => s.hasHaccp).length },
        { cert: "ISO/FSSC", count: enriched.filter((s: any) => s.hasIso).length },
        { cert: "FSSAI", count: enriched.filter((s: any) => s.hasFssai).length },
        { cert: "APEDA", count: enriched.filter((s: any) => s.hasApeda).length },
        { cert: "FDA", count: enriched.filter((s: any) => s.hasFda).length },
        { cert: "Organic", count: enriched.filter((s: any) => s.hasOrganic).length },
      ].map((c) => ({
        ...c,
        percentage: total > 0 ? Math.round((c.count / total) * 100) : 0,
      }));

      // Table
      const table = enriched.map((s: any) => ({
        id: s.id,
        company: s.company,
        country: s.country ?? "—",
        contactPerson: s.contactPerson ?? "—",
        products: s.products ?? "—",
        dealStage: s.dealStage ?? "—",
        vettingScore: s.vettingScore ?? null,
        marginPercent: s.marginPercent,
        avgMonthlyVolume: s.avgMonthlyVolume ?? "—",
        paymentTerms: s.paymentTerms ?? "—",
        dealCount: s.dealCount,
        pipelineValue: Math.round(s.pipelineValue),
        buyerCount: s.buyerCount,
        hasHaccp: s.hasHaccp,
        hasIso: s.hasIso,
        hasFssai: s.hasFssai,
        hasApeda: s.hasApeda,
        hasFda: s.hasFda,
        hasOrganic: s.hasOrganic,
        createdAt: s.createdAt,
      }));

      res.json({
        kpis: {
          total,
          withActiveDeals,
          avgVettingScore,
          avgMarginPercent,
          countries,
          haccpCount,
        },
        dealStageDistribution,
        topByDealValue,
        vettingScoreDistribution,
        byCountry,
        paymentTermsBreakdown,
        certificationCoverage,
        table,
        marginValues: marginValues.slice(0, 50).map((v) => ({ value: Math.round(v * 10) / 10 })),
      });
    } else {
      // tab === "old"
      const where: any = {};
      if (dateFilter) where.createdAt = dateFilter;

      const oldSuppliers = await (prisma as any).oldSupplier.findMany({
        where,
        select: {
          id: true,
          company: true,
          country: true,
          product: true,
          productCategory: true,
          reasonInactive: true,
          reactivationPotential: true,
          currentStatus: true,
          certifications: true,
          dateMarkedInactive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const total = oldSuppliers.length;
      const countries = new Set(
        oldSuppliers.map((s: any) => s.country).filter(Boolean),
      ).size;

      // By country
      const countryMap = new Map<string, number>();
      for (const s of oldSuppliers) {
        const c = (s as any).country ?? "Unknown";
        countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
      }
      const byCountry = Array.from(countryMap.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      // By product category
      const productCategories = countFieldValues(
        oldSuppliers.map((s: any) => s.productCategory || s.product || ""),
      );

      // Reactivation potential breakdown
      const reactMap = new Map<string, number>();
      for (const s of oldSuppliers) {
        const r = (s as any).reactivationPotential ?? "Unknown";
        reactMap.set(r, (reactMap.get(r) ?? 0) + 1);
      }
      const reactivationBreakdown = Array.from(reactMap.entries()).map(
        ([potential, count]) => ({ potential, count }),
      );

      const table = oldSuppliers.map((s: any) => ({
        id: s.id,
        company: s.company,
        country: s.country ?? "—",
        product: s.productCategory || s.product || "—",
        reasonInactive: s.reasonInactive ?? "—",
        reactivationPotential: s.reactivationPotential ?? "—",
        currentStatus: s.currentStatus ?? "—",
        certifications: s.certifications ?? "—",
        dateMarkedInactive: s.dateMarkedInactive ?? "—",
        createdAt: s.createdAt,
      }));

      res.json({
        kpis: {
          total,
          countries,
          productCategories: productCategories.length,
          highReactivation: oldSuppliers.filter(
            (s: any) => s.reactivationPotential === "High",
          ).length,
        },
        byCountry,
        productCategories,
        reactivationBreakdown,
        table,
      });
    }
  } catch (err) {
    console.error("Suppliers report error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─── GET /api/analytics/employees-report ──────────────────────────────────

export async function getEmployeesReport(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const { from, to } = req.query as Record<string, string>;
    const dateFilter = buildDateFilter(from, to);

    const sourcingWhere: any = {};
    if (dateFilter) sourcingWhere.createdAt = dateFilter;

    const [sourcingSuppliers, newSuppliers, allUsers] = await Promise.all([
      prisma.sourcingSupplier.findMany({
        where: sourcingWhere,
        select: {
          id: true,
          company: true,
          country: true,
          product: true,
          productCategory: true,
          status: true,
          createdBy: true,
          createdAt: true,
          emailCampaign: {
            select: {
              status: true,
              currentStep: true,
              introEmailSentAt: true,
              followup1SentAt: true,
              followup2SentAt: true,
              followup3SentAt: true,
              responseReceivedAt: true,
            },
          },
          creator: {
            select: {
              id: true,
              fullName: true,
              designation: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      (prisma as any).newSupplier.findMany({
        where: { convertedFromSourcingId: { not: null } },
        select: {
          convertedFromSourcingId: true,
        },
      }),
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          fullName: true,
          designation: true,
        },
      }),
    ]);

    // Set of sourcingSupplier IDs that were converted to new suppliers
    const convertedToNewIds = new Set(
      newSuppliers.map((n: any) => n.convertedFromSourcingId as string),
    );

    // Build attribution rows
    const attributionRows = sourcingSuppliers.map((s: any) => {
      const campaign = s.emailCampaign;
      let emailStage = "Not Started";
      if (campaign?.responseReceivedAt) emailStage = "Responded";
      else if (campaign?.followup3SentAt) emailStage = "Followup 3 Sent";
      else if (campaign?.followup2SentAt) emailStage = "Followup 2 Sent";
      else if (campaign?.followup1SentAt) emailStage = "Followup 1 Sent";
      else if (campaign?.introEmailSentAt) emailStage = "Intro Sent";

      const convertedToNew = convertedToNewIds.has(s.id);
      const daysInPipeline = Math.floor(
        (Date.now() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        sourcingId: s.id,
        company: s.company,
        country: s.country ?? "—",
        product: s.productCategory || s.product || "—",
        status: s.status,
        emailStage,
        introSentAt: campaign?.introEmailSentAt ?? null,
        responseReceivedAt: campaign?.responseReceivedAt ?? null,
        convertedToNew,
        daysInPipeline,
        createdAt: s.createdAt,
        employeeId: s.createdBy,
        employeeName: s.creator?.fullName ?? "Unknown",
        employeeDesignation: s.creator?.designation ?? "—",
      };
    });

    // Group by employee
    const employeeMap = new Map<
      string,
      {
        userId: string;
        fullName: string;
        designation: string;
        rows: typeof attributionRows;
      }
    >();

    for (const row of attributionRows) {
      const key = row.employeeId ?? "unassigned";
      if (!employeeMap.has(key)) {
        employeeMap.set(key, {
          userId: key,
          fullName: row.employeeName,
          designation: row.employeeDesignation,
          rows: [],
        });
      }
      employeeMap.get(key)!.rows.push(row);
    }

    // Per-employee stats
    const perEmployee = Array.from(employeeMap.values()).map((emp) => {
      const rows = emp.rows;
      const totalSourced = rows.length;
      const convertedToNew = rows.filter((r) => r.convertedToNew).length;
      const responded = rows.filter(
        (r) => r.responseReceivedAt != null,
      ).length;
      const withCampaign = rows.filter((r) => r.emailStage !== "Not Started").length;
      const responseRate =
        withCampaign > 0 ? Math.round((responded / withCampaign) * 100) : 0;
      const conversionRate =
        totalSourced > 0
          ? Math.round((convertedToNew / totalSourced) * 100)
          : 0;

      // Status breakdown
      const statusMap = new Map<string, number>();
      for (const r of rows) {
        statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
      }
      const statusBreakdown = Array.from(statusMap.entries()).map(
        ([status, count]) => ({ status, count }),
      );

      // Countries
      const countriesSet = new Set(
        rows.map((r) => r.country).filter((c) => c !== "—"),
      );

      // Monthly trend (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      const recentRows = rows.filter(
        (r) => new Date(r.createdAt) >= sixMonthsAgo,
      );
      const monthlyTrend = groupByMonthTrend(
        recentRows.map((r) => new Date(r.createdAt)),
      );

      // This month count
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonth = rows.filter(
        (r) => new Date(r.createdAt) >= thisMonthStart,
      ).length;

      return {
        userId: emp.userId,
        fullName: emp.fullName,
        designation: emp.designation,
        totalSourced,
        thisMonth,
        convertedToNew,
        conversionRate,
        responseRate,
        countries: Array.from(countriesSet).slice(0, 5),
        statusBreakdown,
        monthlyTrend,
      };
    });

    // Sort by totalSourced desc
    perEmployee.sort((a, b) => b.totalSourced - a.totalSourced);

    // Leaderboard
    const leaderboard = perEmployee.map((emp, i) => ({
      rank: i + 1,
      userId: emp.userId,
      fullName: emp.fullName,
      designation: emp.designation,
      totalSourced: emp.totalSourced,
      thisMonth: emp.thisMonth,
      convertedToNew: emp.convertedToNew,
      conversionRate: emp.conversionRate,
      responseRate: emp.responseRate,
      countriesCount: emp.countries.length,
    }));

    // Overall KPIs
    const totalSourcing = sourcingSuppliers.length;
    const totalConverted = attributionRows.filter((r) => r.convertedToNew).length;
    const endToEndRate =
      totalSourcing > 0
        ? Math.round((totalConverted / totalSourcing) * 100)
        : 0;
    const topSourcer = leaderboard[0] ?? null;

    // Volume chart data (for bar chart: employee vs count)
    const volumeChart = perEmployee
      .slice(0, 10)
      .map((e) => ({ name: e.fullName.split(" ")[0], totalSourced: e.totalSourced, thisMonth: e.thisMonth }));

    res.json({
      kpis: {
        activeEmployees: allUsers.length,
        totalSourcing,
        totalConverted,
        endToEndRate,
        topSourcerName: topSourcer?.fullName ?? "—",
        topSourcerCount: topSourcer?.totalSourced ?? 0,
      },
      leaderboard,
      perEmployee,
      attributionTable: attributionRows,
      volumeChart,
    });
  } catch (err) {
    console.error("Employees report error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
