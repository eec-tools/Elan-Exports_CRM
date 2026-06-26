import axios from "axios";
import type { FoundEmail, VerifiedEmail, EmailResult } from "./types.js";
import { extractDomain } from "./discoveryEngine.js";

const HUNTER_BASE = "https://api.hunter.io/v2";
const HUNTER_KEY = process.env.HUNTER_API_KEY ?? "";

const PROCUREMENT_TITLES = [
  "procurement", "purchasing", "import", "sourcing", "buying",
  "supply chain", "ceo", "coo", "md", "managing director",
  "owner", "founder", "head of", "director", "manager",
];

export async function findEmailsForDomain(domain: string): Promise<FoundEmail[]> {
  if (!HUNTER_KEY) return [];

  try {
    const { data } = await axios.get(`${HUNTER_BASE}/domain-search`, {
      params: { domain, api_key: HUNTER_KEY, limit: 10 },
      timeout: 10000,
    });

    await sleep(500);

    return (data.data?.emails ?? [])
      .filter((e: any) => {
        const title = (e.position ?? "").toLowerCase();
        return PROCUREMENT_TITLES.some((t) => title.includes(t));
      })
      .map((e: any) => ({
        email: e.value,
        firstName: e.first_name ?? "",
        lastName: e.last_name ?? "",
        title: e.position ?? "",
        confidence: e.confidence ?? 0,
        linkedinUrl: e.linkedin ?? "",
      }));
  } catch {
    return [];
  }
}

export async function verifyEmail(email: string): Promise<VerifiedEmail> {
  if (!HUNTER_KEY) return { email, status: "unknown", score: 0 };

  try {
    const { data } = await axios.get(`${HUNTER_BASE}/email-verifier`, {
      params: { email, api_key: HUNTER_KEY },
      timeout: 10000,
    });
    await sleep(500);
    return {
      email,
      status: data.data?.status ?? "unknown",
      score: data.data?.score ?? 0,
    };
  } catch {
    return { email, status: "unknown", score: 0 };
  }
}

export async function findAndVerifyContactForCompany(website: string): Promise<EmailResult> {
  // If Hunter key not configured, treat as no-email (discard gate)
  if (!HUNTER_KEY) {
    return {
      contacts: [],
      verifiedPrimary: null,
      shouldDiscard: true,
      discardReason: "Hunter.io API key not configured",
    };
  }

  const domain = extractDomain(website);
  if (!domain) {
    return { contacts: [], verifiedPrimary: null, shouldDiscard: true, discardReason: "Invalid domain" };
  }

  const found = await findEmailsForDomain(domain);
  if (found.length === 0) {
    return {
      contacts: [],
      verifiedPrimary: null,
      shouldDiscard: true,
      discardReason: "No email found on domain via Hunter.io",
    };
  }

  const sorted = found.sort((a, b) => b.confidence - a.confidence);

  for (const candidate of sorted.slice(0, 2)) {
    const verified = await verifyEmail(candidate.email);
    if (verified.status === "valid" || verified.status === "deliverable") {
      return { contacts: sorted, verifiedPrimary: verified, shouldDiscard: false, discardReason: null };
    }
  }

  return {
    contacts: sorted,
    verifiedPrimary: null,
    shouldDiscard: true,
    discardReason: "Email found but verification failed (risky/invalid)",
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
