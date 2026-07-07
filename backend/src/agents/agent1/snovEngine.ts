import axios from "axios";
import type { FoundEmail, VerifiedEmail } from "./types.js";

const SNOV_BASE = "https://api.snov.io/v1";

// ── OAuth token — cached, auto-refreshes 60s before expiry ───────────────────

let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getToken(): Promise<string | null> {
  const clientId     = process.env.SNOV_CLIENT_ID;
  const clientSecret = process.env.SNOV_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  try {
    const body = new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     clientId,
      client_secret: clientSecret,
    });

    const { data } = await axios.post(`${SNOV_BASE}/oauth/access_token`, body.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10_000,
    });

    _cachedToken = data.access_token as string;
    _tokenExpiry = Date.now() + ((data.expires_in as number) - 60) * 1000;
    console.log("[Snov] Token refreshed");
    return _cachedToken;
  } catch (err: any) {
    console.error("[Snov] Auth failed:", err?.response?.data ?? err?.message);
    return null;
  }
}

export function snovConfigured(): boolean {
  return !!(process.env.SNOV_CLIENT_ID && process.env.SNOV_CLIENT_SECRET);
}

// ── Credit-exhaustion guard ───────────────────────────────────────────────────
// Set to true when Snov.io returns "ran out of credits". All subsequent calls
// skip the API immediately to avoid hammering a depleted account.
let _creditsExhausted = false;

export function snovCreditsExhausted(): boolean { return _creditsExhausted; }

function checkForExhaustion(data: any): boolean {
  const msg: string = (data?.message ?? data?.errors?.title ?? "").toLowerCase();
  if (msg.includes("ran out of credits") || msg.includes("out of credits") || msg.includes("no credits")) {
    if (!_creditsExhausted) {
      console.warn("[Snov] ⚠️  Credits exhausted — suspending all Snov.io calls for this run");
      _creditsExhausted = true;
    }
    return true;
  }
  return false;
}

/** Reset the exhaustion flag (call at the start of each new agent run). */
export function resetSnovCredits(): void { _creditsExhausted = false; }

// ── Prospect search types ─────────────────────────────────────────────────────

export interface SnovProspect {
  firstName:       string;
  lastName:        string;
  fullName:        string;
  title:           string;
  email:           string | null;
  emailConfidence: number;
  companyName:     string;
  companyDomain:   string;
  companyWebsite:  string;
  linkedinUrl:     string;
  industry:        string;
  country:         string;
}

// Procurement-relevant job title keywords (used for domain-search filtering)
const PROCUREMENT_KW = [
  "procurement", "purchasing", "import", "sourcing", "buying", "buyer",
  "supply chain", "ceo", "coo", "managing director", "owner", "founder",
  "head of", "director", "vp ", "vice president", "commercial", "trading",
  "category", "merchandise", "merchandis",
];

export function isProcurementTitle(title: string): boolean {
  const t = title.toLowerCase();
  return PROCUREMENT_KW.some((kw) => t.includes(kw));
}

// ── 1. PROSPECT SEARCH — finds procurement contacts at importing companies ─────
//
// Hits Snov.io's prospect/lead search API filtered by job titles + country +
// industry. Gracefully returns [] if the endpoint isn't on the current plan.
//
// Credit cost: ~1 credit per result returned.

export async function snovProspectSearch(
  country: string,
  titles: string[],
  industries: string[],
  limit = 20,
): Promise<SnovProspect[]> {
  if (_creditsExhausted) return [];
  const token = await getToken();
  if (!token) return [];

  try {
    const { data } = await axios.post(
      `${SNOV_BASE}/get-prospects-with-target`,
      {
        access_token: token,
        position:    titles.slice(0, 6),      // top-6 most specific titles
        country,
        industry:    industries,
        companySize: ["11-50", "51-100", "101-200", "201-500"],
        rows:        limit,
      },
      { timeout: 25_000 },
    );

    if (checkForExhaustion(data) || !data.success) {
      if (!_creditsExhausted) console.warn("[Snov] Prospect search returned success=false:", data.message);
      return [];
    }

    const raw: any[] = Array.isArray(data.data) ? data.data : (data.data?.prospects ?? []);
    console.log(`[Snov] Prospect search: ${raw.length} raw results (${country})`);

    return raw
      .filter((p) => (p.companyName || p.company) && (p.email || p.emails?.length > 0))
      .map((p) => {
        const domain = p.companyDomain ?? extractDomainFromUrl(p.companyUrl ?? p.companyWebsite ?? "");
        return {
          firstName:       p.firstName ?? "",
          lastName:        p.lastName  ?? "",
          fullName:        p.name ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
          title:           p.position ?? p.title ?? "",
          email:           p.email ?? p.emails?.[0]?.email ?? null,
          emailConfidence: p.emailConfidence ?? p.emails?.[0]?.confidence ?? 60,
          companyName:     p.companyName ?? p.company ?? "",
          companyDomain:   domain,
          companyWebsite:  domain ? `https://${domain}` : (p.companyUrl ?? ""),
          linkedinUrl:     p.linkedinUrl ?? p.linkedin ?? "",
          industry:        p.industry ?? "",
          country:         p.country ?? country,
        };
      });
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 402 || status === 403 || status === 404) {
      console.log(`[Snov] Prospect search unavailable on current plan (HTTP ${status})`);
    } else {
      console.error("[Snov] Prospect search error:", err?.response?.data ?? err?.message);
    }
    return [];
  }
}

// ── 2. DOMAIN EMAIL SEARCH — find all emails known for a company domain ───────
//
// Returns procurement-relevant contacts sorted by confidence (highest first).
// No verification call needed — Snov.io's confidence score ≥ 70 is reliable.
//
// Credit cost: 1 credit per domain searched.

export async function snovDomainSearch(domain: string): Promise<FoundEmail[]> {
  if (_creditsExhausted) return [];
  const token = await getToken();
  if (!token) return [];

  try {
    const { data } = await axios.post(
      `${SNOV_BASE}/get-domain-emails`,
      { access_token: token, domain, type: "all", limit: 10 },
      { timeout: 15_000 },
    );

    if (checkForExhaustion(data)) return [];
    if (!data.success) return [];

    const emails: any[] = data.data?.emails ?? [];
    console.log(`[Snov] Domain search ${domain}: ${emails.length} emails found`);

    const filtered = emails
      .filter((e) => (e.confidence ?? 0) >= 60)
      .filter((e) => !e.position || isProcurementTitle(e.position));

    // Sort: procurement-titled contacts first, then by confidence
    filtered.sort((a, b) => {
      const aProc = a.position ? (isProcurementTitle(a.position) ? 1 : 0) : 0;
      const bProc = b.position ? (isProcurementTitle(b.position) ? 1 : 0) : 0;
      if (bProc !== aProc) return bProc - aProc;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });

    // Only keep emails belonging to a real named person — reject generic mailboxes
    // like info@, sales@, contact@ that have no firstName in Snov.io's database.
    return filtered
      .filter((e) => e.firstName && e.firstName.trim().length > 0)
      .map((e) => ({
        email:       e.email,
        firstName:   e.firstName  ?? "",
        lastName:    e.lastName   ?? "",
        title:       e.position   ?? "Contact",
        confidence:  e.confidence ?? 60,
        linkedinUrl: e.linkedinUrl ?? "",
      }));
  } catch (err: any) {
    console.error(`[Snov] Domain search failed for ${domain}:`, err?.response?.data ?? err?.message);
    return [];
  }
}

// ── 3. EMAIL VERIFICATION — async two-step: submit → poll ────────────────────
//
// Credit cost: 0.5 credits per email.
// Snov.io verification is queued — we poll up to 4×2s = 8s for a result.
// If still pending, we return "unknown" (email address is still usable).

export async function snovVerifyEmail(email: string): Promise<VerifiedEmail> {
  if (_creditsExhausted) return { email, status: "unknown", score: 0 };
  const token = await getToken();
  if (!token) return { email, status: "unknown", score: 0 };

  try {
    // Step 1 — submit email for verification
    await axios.post(
      `${SNOV_BASE}/add-emails-to-verification`,
      { access_token: token, emails: [email] },
      { timeout: 10_000 },
    );

    // Step 2 — poll until result is ready (max 4 attempts × 2s = 8s)
    for (let i = 0; i < 4; i++) {
      await sleep(2000);
      const { data } = await axios.post(
        `${SNOV_BASE}/get-emails-verification-status`,
        { access_token: token, emails: [email] },
        { timeout: 10_000 },
      );

      if (checkForExhaustion(data) || !data.success) break;

      const result: any = (data.data ?? [])[0];
      if (!result) break;

      const isDone =
        result.verificationStatus === "completed" ||
        (result.status && result.status !== "in_progress");

      if (isDone) {
        const status = mapSnovVerifyStatus(result.status);
        console.log(`[Snov] Verify ${email}: ${status}`);
        return { email, status, score: statusToScore(status) };
      }
    }

    // Timed out — treat as unknown (don't discard; address may still be real)
    return { email, status: "unknown", score: 40 };
  } catch (err: any) {
    console.error(`[Snov] Verify failed for ${email}:`, err?.response?.data ?? err?.message);
    return { email, status: "unknown", score: 0 };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapSnovVerifyStatus(s: string): VerifiedEmail["status"] {
  switch ((s ?? "").toLowerCase()) {
    case "valid":
    case "accept_all": return "valid";
    case "deliverable": return "deliverable";
    case "invalid":
    case "disposable": return "invalid";
    case "risky":      return "risky";
    default:           return "unknown";
  }
}

function statusToScore(s: VerifiedEmail["status"]): number {
  return { valid: 90, deliverable: 80, unknown: 40, risky: 20, invalid: 0 }[s] ?? 0;
}

function extractDomainFromUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
