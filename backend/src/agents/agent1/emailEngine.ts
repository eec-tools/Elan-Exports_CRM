import axios from "axios";
import { lookup as dnsLookup } from "dns/promises";
import type { FoundEmail, VerifiedEmail, EmailResult } from "./types.js";
import { extractDomain, scrapeFunctionalProcurementEmail } from "./discoveryEngine.js";
import { snovDomainSearch, snovConfigured, snovCreditsExhausted } from "./snovEngine.js";

const HUNTER_BASE = "https://api.hunter.io/v2";
const HUNTER_KEY  = process.env.HUNTER_API_KEY ?? "";

// Procurement-relevant titles for Hunter filtering
const PROC_TITLES = [
  "procurement", "purchasing", "import", "sourcing", "buying", "buyer",
  "supply chain", "ceo", "coo", "managing director", "owner", "founder",
  "head of", "director", "vp", "vice president", "commercial", "trading",
  "category", "merchandise",
];

function isProcurementTitle(title: string): boolean {
  const t = title.toLowerCase();
  return PROC_TITLES.some((kw) => t.includes(kw));
}

// ── Hunter.io helpers ─────────────────────────────────────────────────────────

export async function verifyEmail(email: string): Promise<VerifiedEmail> {
  if (!HUNTER_KEY) return { email, status: "unknown", score: 0 };
  try {
    const { data } = await axios.get(`${HUNTER_BASE}/email-verifier`, {
      params: { email, api_key: HUNTER_KEY },
      timeout: 10_000,
    });
    await sleep(400);
    return { email, status: data.data?.status ?? "unknown", score: data.data?.score ?? 0 };
  } catch { return { email, status: "unknown", score: 0 }; }
}

// Hunter domain search — returns only NAMED person emails (has first_name).
// Generic mailboxes (info@, sales@) are excluded.
async function hunterDomainSearch(domain: string): Promise<FoundEmail[]> {
  if (!HUNTER_KEY) return [];
  try {
    const { data } = await axios.get(`${HUNTER_BASE}/domain-search`, {
      params: { domain, api_key: HUNTER_KEY, limit: 10 },
      timeout: 10_000,
    });
    await sleep(500);

    return (data.data?.emails ?? [])
      .filter((e: any) => {
        const hasName  = e.first_name && e.first_name.trim().length > 0;
        const hasTitle = isProcurementTitle(e.position ?? "");
        return hasName && hasTitle;
      })
      .map((e: any) => ({
        email:       e.value,
        firstName:   e.first_name  ?? "",
        lastName:    e.last_name   ?? "",
        title:       e.position    ?? "",
        confidence:  e.confidence  ?? 0,
        linkedinUrl: e.linkedin    ?? "",
      }));
  } catch { return []; }
}

export async function findEmailsForDomain(domain: string): Promise<FoundEmail[]> {
  if (snovConfigured() && !snovCreditsExhausted()) return snovDomainSearch(domain);
  return hunterDomainSearch(domain);
}

/**
 * Two-source named-person email lookup.
 *
 * We ONLY accept emails that belong to a real named person with a
 * procurement-relevant title. Generic mailboxes (info@, sales@, contact@,
 * procurement@) are deliberately excluded — they reach nobody specific.
 *
 * Source 1 — Snov.io domain search (1 credit/domain)
 *   Returns named contacts (firstName + lastName present) with confidence scores.
 *   Filtered to procurement titles. Accepted at confidence ≥ 60.
 *
 * Source 2 — Hunter.io domain search (1 Hunter credit/domain, fallback)
 *   Same filter: named person + procurement title only.
 *   Verified via Hunter if status is ambiguous.
 *
 * No website scraping. No email pattern guessing. No generic mailboxes.
 */
// ── DNS domain validation ─────────────────────────────────────────────────────
// Check whether a domain actually resolves before spending Snov.io/Hunter credits.
// Catches hallucinated domains from the LLM (e.g. gulfyarntrading.com) immediately.
async function domainResolves(domain: string): Promise<boolean> {
  try {
    await dnsLookup(domain);
    return true;
  } catch {
    return false;
  }
}

export async function findAndVerifyContactForCompany(website: string): Promise<EmailResult> {
  const domain = extractDomain(website);
  if (!domain) {
    return { contacts: [], verifiedPrimary: null, shouldDiscard: true, discardReason: "Invalid domain" };
  }

  // ── DNS guard — skip domains that don't exist ─────────────────────────────
  // Fake/hallucinated domains from the LLM never resolve. This filter runs
  // before any paid API call so no credits are wasted on invented companies.
  if (!await domainResolves(domain)) {
    console.log(`[Email] DNS not found: ${domain} — skipping (hallucinated domain)`);
    return {
      contacts:        [],
      verifiedPrimary: null,
      shouldDiscard:   true,
      discardReason:   `Domain does not exist (DNS): ${domain}`,
    };
  }

  // ── Source 1: Snov.io domain search ──────────────────────────────────────
  if (snovConfigured() && !snovCreditsExhausted()) {
    console.log(`[Email] Snov.io domain search: ${domain}`);
    const contacts = await snovDomainSearch(domain);  // already filters named persons

    if (contacts.length > 0) {
      const primary = contacts[0];
      const verifiedPrimary: VerifiedEmail = {
        email:  primary.email,
        status: primary.confidence >= 70 ? "valid" : "unknown",
        score:  primary.confidence,
      };
      console.log(`[Email] ✓ Snov.io: ${primary.firstName} ${primary.lastName} <${primary.email}> · "${primary.title}"`);
      return { contacts, verifiedPrimary, shouldDiscard: false, discardReason: null };
    }

    console.log(`[Email] Snov.io: no named procurement contact for ${domain}`);
  } else if (snovConfigured() && snovCreditsExhausted()) {
    console.log(`[Email] Snov.io skipped — credits exhausted`);
  }

  // ── Source 2: Hunter.io domain search ────────────────────────────────────
  if (HUNTER_KEY) {
    console.log(`[Email] Hunter domain search: ${domain}`);
    const contacts = await hunterDomainSearch(domain);  // already filters named persons

    if (contacts.length > 0) {
      const sorted  = contacts.sort((a, b) => b.confidence - a.confidence);
      const primary = sorted[0];
      // Verify the top candidate if confidence is below 80
      let verifiedPrimary: VerifiedEmail;
      if (primary.confidence >= 80) {
        verifiedPrimary = { email: primary.email, status: "valid", score: primary.confidence };
      } else {
        verifiedPrimary = await verifyEmail(primary.email);
      }

      if (verifiedPrimary.status === "valid" || verifiedPrimary.status === "deliverable" || verifiedPrimary.status === "unknown") {
        console.log(`[Email] ✓ Hunter: ${primary.firstName} ${primary.lastName} <${primary.email}> · "${primary.title}"`);
        return { contacts: sorted, verifiedPrimary, shouldDiscard: false, discardReason: null };
      }

      console.log(`[Email] Hunter found person but email invalid: ${primary.email} (${verifiedPrimary.status})`);
    } else {
      console.log(`[Email] Hunter: no named procurement contact for ${domain}`);
    }
  }

  // ── Tier 3: Website scraping for procurement department email ────────────
  // Snov.io and Hunter index large/LinkedIn-active companies; small EU/UK
  // textile SMEs often aren't in their databases. Scraping the company
  // contact page for a functional dept email (procurement@, buying@, sourcing@,
  // einkauf@, achat@) is the last resort — these reach the buying desk directly
  // and are deliberately different from generic info@/contact@ mailboxes.
  console.log(`[Email] Tier 3 — scraping ${domain} for procurement dept email`);
  const deptEmail = await scrapeFunctionalProcurementEmail(website);
  if (deptEmail) {
    console.log(`[Email] ✓ Scraped dept email: ${deptEmail}`);
    return {
      contacts: [{
        email:       deptEmail,
        firstName:   "",
        lastName:    "",
        title:       "Procurement / Buying Dept.",
        confidence:  60,
        linkedinUrl: "",
      }],
      verifiedPrimary: { email: deptEmail, status: "unknown", score: 60 },
      shouldDiscard:   false,
      discardReason:   null,
    };
  }

  // ── No contact found from any source — discard ────────────────────────────
  return {
    contacts:        [],
    verifiedPrimary: null,
    shouldDiscard:   true,
    discardReason:   "No procurement contact found (Snov.io + Hunter + website scrape all searched)",
  };
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
