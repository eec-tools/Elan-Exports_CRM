import prisma from "../config/db.js";
import { syncThreadMessages, syncBuyerThreadMessages } from "./gmailReplyDetector.js";
import { BUYER_GMAIL_ACCOUNT } from "../controllers/sourcingBuyers.controller.js";

const STATUS_KEY = "email_attachment_backfill_status";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface BackfillStatus {
  status: "idle" | "running" | "completed" | "error";
  startedAt?: string;
  finishedAt?: string;
  supplierTotal?: number;
  supplierChecked?: number;
  buyerTotal?: number;
  buyerChecked?: number;
  errors?: number;
  supplierAttachmentsStored?: number;
  buyerAttachmentsStored?: number;
  errorMessage?: string;
}

async function readStatus(): Promise<BackfillStatus> {
  const setting = await (prisma as any).appSetting.findUnique({ where: { key: STATUS_KEY } });
  if (!setting?.value) return { status: "idle" };
  try {
    return JSON.parse(setting.value);
  } catch {
    return { status: "idle" };
  }
}

async function writeStatus(status: BackfillStatus): Promise<void> {
  await (prisma as any).appSetting.upsert({
    where: { key: STATUS_KEY },
    update: { value: JSON.stringify(status) },
    create: { key: STATUS_KEY, value: JSON.stringify(status) },
  });
}

export async function getBackfillStatus(): Promise<BackfillStatus> {
  return readStatus();
}

/**
 * Kicks off the historical attachment backfill in the background and returns
 * immediately. Safe to call while a run is already in progress — returns the
 * existing status instead of starting a second overlapping run.
 */
export async function startBackfill(): Promise<BackfillStatus> {
  const current = await readStatus();
  if (current.status === "running") return current;

  const initial: BackfillStatus = {
    status: "running",
    startedAt: new Date().toISOString(),
    supplierChecked: 0,
    buyerChecked: 0,
    errors: 0,
  };
  await writeStatus(initial);

  runBackfillJob().catch(async (err) => {
    console.error("[EmailAttachmentBackfill] Fatal error:", err);
    const s = await readStatus();
    await writeStatus({
      ...s,
      status: "error",
      finishedAt: new Date().toISOString(),
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  });

  return initial;
}

async function runBackfillJob(): Promise<void> {
  const startedAt = (await readStatus()).startedAt ?? new Date().toISOString();

  const supplierCampaigns = await (prisma as any).sourcingEmailCampaign.findMany({
    where: { gmailThreadId: { not: null } },
    include: { sourcingSupplier: { select: { id: true, company: true, assignedGmailAccount: true } } },
  });
  const buyerCampaigns = await (prisma as any).sourcingBuyerEmailCampaign.findMany({
    where: { gmailThreadId: { not: null } },
    include: { sourcingBuyer: { select: { id: true, company: true, assignedGmailAccount: true } } },
  });

  const status: BackfillStatus = {
    status: "running",
    startedAt,
    supplierTotal: supplierCampaigns.length,
    buyerTotal: buyerCampaigns.length,
    supplierChecked: 0,
    buyerChecked: 0,
    errors: 0,
  };
  await writeStatus(status);

  for (const campaign of supplierCampaigns) {
    const supplier = campaign.sourcingSupplier;
    if (supplier?.assignedGmailAccount && campaign.gmailThreadId) {
      try {
        await syncThreadMessages(campaign.sourcingId, supplier.assignedGmailAccount, campaign.gmailThreadId);
      } catch (err) {
        status.errors = (status.errors ?? 0) + 1;
        console.error(`[EmailAttachmentBackfill] Supplier error for ${supplier.company}:`, err);
      }
    }
    status.supplierChecked = (status.supplierChecked ?? 0) + 1;
    if (status.supplierChecked % 10 === 0) await writeStatus(status);
    await sleep(300);
  }
  await writeStatus(status);

  for (const campaign of buyerCampaigns) {
    const buyer = campaign.sourcingBuyer;
    if (campaign.gmailThreadId) {
      try {
        await syncBuyerThreadMessages(buyer.id, campaign.gmailThreadId, BUYER_GMAIL_ACCOUNT);
      } catch (err) {
        status.errors = (status.errors ?? 0) + 1;
        console.error(`[EmailAttachmentBackfill] Buyer error for ${buyer.company}:`, err);
      }
    }
    status.buyerChecked = (status.buyerChecked ?? 0) + 1;
    if (status.buyerChecked % 10 === 0) await writeStatus(status);
    await sleep(300);
  }

  const supplierAttachmentsStored = await (prisma as any).supplierEmailAttachment.count();
  const buyerAttachmentsStored = await (prisma as any).buyerEmailAttachment.count();

  await writeStatus({
    ...status,
    status: "completed",
    finishedAt: new Date().toISOString(),
    supplierAttachmentsStored,
    buyerAttachmentsStored,
  });
}
