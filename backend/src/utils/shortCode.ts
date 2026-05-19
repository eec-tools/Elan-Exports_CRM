import prisma from "../config/db.js";

const STRIP_WORDS = /\b(pvt|ltd|inc|corp|llp|pte|co|and|the|of|exports?|international|industries|enterprises|trading|group)\b/gi;
const RANDOM_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous chars (0/O, 1/l/I)

function slugify(company: string): string {
  return company
    .toLowerCase()
    .replace(STRIP_WORDS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18)
    .replace(/-+$/g, "");
}

function randomSuffix(len = 4): string {
  return Array.from({ length: len }, () =>
    RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)]
  ).join("");
}

export async function generateShortCode(company: string): Promise<string> {
  const slug = slugify(company) || "supplier";
  for (let i = 0; i < 10; i++) {
    const code = `${slug}-${randomSuffix(4)}`;
    const exists = await (prisma as any).sourcingSupplier.findFirst({
      where: { shortCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  // Extremely unlikely fallback
  return `s-${randomSuffix(8)}`;
}
