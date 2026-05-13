import { Response } from "express";
import prisma from "../config/db.js";
import { AuthRequest } from "../types/index.js";

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const listSignatures = async (_req: AuthRequest, res: Response) => {
  try {
    const sigs = await prisma.emailSignature.findMany({ orderBy: { createdAt: "asc" } });
    res.json(sigs);
  } catch {
    res.status(500).json({ error: "Failed to list signatures" });
  }
};

export const getSignature = async (req: AuthRequest, res: Response) => {
  try {
    const sig = await prisma.emailSignature.findUnique({ where: { id: req.params.id } });
    if (!sig) return res.status(404).json({ error: "Not found" });
    res.json(sig);
  } catch {
    res.status(500).json({ error: "Failed to get signature" });
  }
};

export const createSignature = async (req: AuthRequest, res: Response) => {
  const { name, role, company, tagline, links } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
  try {
    const sig = await prisma.emailSignature.create({
      data: { name: name.trim(), role: role ?? "", company: company ?? "", tagline: tagline ?? "", links: links ?? [] },
    });
    res.status(201).json(sig);
  } catch {
    res.status(500).json({ error: "Failed to create signature" });
  }
};

export const updateSignature = async (req: AuthRequest, res: Response) => {
  const { name, role, company, tagline, links } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
  try {
    const sig = await prisma.emailSignature.update({
      where: { id: req.params.id },
      data: { name: name.trim(), role: role ?? "", company: company ?? "", tagline: tagline ?? "", links: links ?? [] },
    });
    res.json(sig);
  } catch {
    res.status(500).json({ error: "Failed to update signature" });
  }
};

export const deleteSignature = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.emailSignature.delete({ where: { id: req.params.id } });

    // Clean up any AppSetting keys pointing to this signature
    await prisma.appSetting.deleteMany({
      where: { key: { startsWith: "gmail_default_signature_" }, value: req.params.id },
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete signature" });
  }
};

// ─── Per-account default signature ───────────────────────────────────────────

export const getDefaultSignature = async (req: AuthRequest, res: Response) => {
  const { account } = req.query as { account: string };
  if (!account) return res.status(400).json({ error: "account query param required" });
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: `gmail_default_signature_${account}` },
    });
    if (!setting) return res.json(null);
    const sig = await prisma.emailSignature.findUnique({ where: { id: setting.value } });
    res.json(sig ?? null);
  } catch {
    res.status(500).json({ error: "Failed to get default signature" });
  }
};

export const setDefaultSignature = async (req: AuthRequest, res: Response) => {
  const { account, signatureId } = req.body;
  if (!account) return res.status(400).json({ error: "account is required" });
  try {
    if (!signatureId) {
      await prisma.appSetting.deleteMany({
        where: { key: `gmail_default_signature_${account}` },
      });
    } else {
      await prisma.appSetting.upsert({
        where: { key: `gmail_default_signature_${account}` },
        update: { value: signatureId },
        create: { key: `gmail_default_signature_${account}`, value: signatureId },
      });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to set default signature" });
  }
};

// ─── Helper for campaign sending ──────────────────────────────────────────────

export async function fetchDefaultSignatureForAccount(gmailAccount: string): Promise<{
  name: string; role: string; company: string; tagline: string;
  links: Array<{ label: string; url: string }>;
} | null> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: `gmail_default_signature_${gmailAccount}` },
    });
    if (!setting) return null;
    const sig = await prisma.emailSignature.findUnique({ where: { id: setting.value } });
    if (!sig) return null;
    return {
      name: sig.name,
      role: sig.role,
      company: sig.company,
      tagline: sig.tagline,
      links: (sig.links as Array<{ label: string; url: string }>) ?? [],
    };
  } catch {
    return null;
  }
}
