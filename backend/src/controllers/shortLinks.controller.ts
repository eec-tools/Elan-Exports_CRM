import { Request, Response } from "express";
import prisma from "../config/db.js";

const FRONTEND_BASE = "https://crm.eectrade.com";

/**
 * GET /f/:code
 * Public redirect — resolves a short code to the full supplier form URL.
 */
export async function resolveShortLink(req: Request, res: Response): Promise<void> {
  const { code } = req.params as { code: string };

  const supplier = await (prisma as any).sourcingSupplier.findFirst({
    where: { shortCode: code },
    select: { formToken: true, formTemplateId: true },
  });

  if (!supplier?.formToken) {
    res.status(404).send("Link not found or expired.");
    return;
  }

  const url = supplier.formTemplateId
    ? `${FRONTEND_BASE}/supplier-form/${supplier.formToken}?t=${supplier.formTemplateId}`
    : `${FRONTEND_BASE}/supplier-form/${supplier.formToken}`;

  res.redirect(302, url);
}
