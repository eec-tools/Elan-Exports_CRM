import axios from "axios";
import type { RawCompany, EnrichedCompanyProfile } from "./types.js";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

function getFirecrawlKey(): string | null {
  return process.env.FIRECRAWL_API_KEY ?? null;
}

// Domains to skip — not real company homepages
const SKIP_DOMAINS = new Set([
  // Social / video
  "wikipedia.org", "linkedin.com", "facebook.com", "twitter.com", "x.com",
  "instagram.com", "youtube.com", "reddit.com", "tiktok.com", "pinterest.com",
  // E-commerce platforms (not importers)
  "amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "ebay.com", "etsy.com", "shopify.com",
  // B2B trade marketplaces / directories — these return list/category pages, not company pages
  "alibaba.com", "aliexpress.com", "dhgate.com", "made-in-china.com",
  "kompass.com", "europages.co.uk", "europages.eu", "tradekey.com",
  "exportersindia.com", "esources.co.uk", "trademo.com", "ec21.com",
  "globalsources.com", "thomasnet.com", "indiamart.com",
  // Review / trust / job sites
  "trustpilot.com", "glassdoor.com", "yelp.com", "g2.com", "capterra.com", "clutch.co",
  "indeed.com", "jobs.com",
  // News / media / market research
  "bloomberg.com", "reuters.com", "ft.com", "forbes.com", "wsj.com",
  "ibisworld.com", "statista.com", "mordorintelligence.com",
  "businesswire.com", "prnewswire.com", "globenewswire.com",
  // Document sharing
  "scribd.com", "slideshare.net", "issuu.com", "academia.edu", "docplayer.net",
  // Lead gen / enrichment tools (not target companies)
  "lusha.com", "zoominfo.com", "apollo.io", "hunter.io", "clearbit.com",
  "rocketreach.co", "seamless.ai",
  // Logistics / freight blogs (wrong company type)
  "docshipper.com",
  // Trade associations / membership bodies
  "ukft.org", "wearetex.org",
  // Industry info portals / listing aggregators
  "textileinfomedia.com", "thesewingdirectory.co.uk",
  // Craft / hobby communities
  "theweaveshed.org",
  // Article / how-to sites
  "knitseek.com",
]);

// Returns true if domain OR any parent domain is in SKIP_DOMAINS
// e.g. lu.kompass.com is caught by kompass.com
function shouldSkipDomain(domain: string): boolean {
  if (SKIP_DOMAINS.has(domain)) return true;
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    if (SKIP_DOMAINS.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

const ASIA_KEYWORDS = [
  "china", "india", "vietnam", "bangladesh", "thailand",
  "indonesia", "asia", "south asia", "far east", "indian subcontinent",
];
const INDIA_KEYWORDS = ["india", "indian", "subcontinent", "south asia"];

// ── Firecrawl search → returns [{url, title, description}, ...] ──────────────
async function firecrawlSearch(query: string, limit = 10): Promise<any[]> {
  const key = getFirecrawlKey();
  if (!key) return [];

  try {
    const { data } = await axios.post(
      `${FIRECRAWL_BASE}/search`,
      { query, limit },
      {
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        timeout: 30000,
      }
    );
    if (!data.success) return [];
    return Array.isArray(data.data) ? data.data : [];
  } catch (err: any) {
    console.error(`[Agent1] Firecrawl search error for "${query}":`, err?.response?.data ?? err?.message);
    return [];
  }
}

// ── Firecrawl scrape → returns markdown string ────────────────────────────────
export async function firecrawlScrape(url: string): Promise<string> {
  const key = getFirecrawlKey();
  if (!key) return "";

  try {
    const { data } = await axios.post(
      `${FIRECRAWL_BASE}/scrape`,
      { url, formats: ["markdown"], onlyMainContent: true },
      {
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        timeout: 15000,
      }
    );
    if (!data.success) return "";
    return data.data?.markdown ?? "";
  } catch (err: any) {
    console.error(`[Agent1] Firecrawl scrape error for ${url}:`, err?.response?.data ?? err?.message);
    return "";
  }
}

export async function searchCompanies(
  queries: string[],
  maxResults = 50
): Promise<RawCompany[]> {
  if (!getFirecrawlKey()) {
    console.warn("[Agent1] FIRECRAWL_API_KEY not configured; skipping discovery search.");
    return [];
  }

  const seen = new Set<string>();
  const companies: RawCompany[] = [];

  for (const query of queries) {
    if (companies.length >= maxResults) break;

    console.log(`[Agent1] Searching: "${query}"`);
    const results = await firecrawlSearch(query, 10);
    console.log(`[Agent1] "${query}" → ${results.length} raw results`);

    for (const item of results) {
      const url: string = item.url ?? item.link ?? "";
      const domain = extractDomain(url);
      if (!domain || seen.has(domain) || shouldSkipDomain(domain)) continue;
      if (isArticleOrListPage(item)) {
        console.log(`[Agent1] Skipped (article/list): "${item.title?.slice(0, 60)}"`);
        continue;
      }
      if (isSourcingCompetitor(item)) {
        console.log(`[Agent1] Skipped (sourcing competitor): "${item.title?.slice(0, 60)}"`);
        continue;
      }
      seen.add(domain);

      const company = extractCompanyFromResult(item);
      if (company) {
        companies.push(company);
        console.log(`[Agent1] Found: ${company.name} (${domain})`);
      }
      if (companies.length >= maxResults) break;
    }

    await sleep(800);
  }

  console.log(`[Agent1] Discovery complete — ${companies.length} unique companies`);
  return companies.slice(0, maxResults);
}

export async function enrichCompanyFromWebsite(
  company: RawCompany,
  targetCountry: string
): Promise<EnrichedCompanyProfile> {
  if (!company.website) return fallbackProfile(company, targetCountry);

  const content = (await firecrawlScrape(company.website)).slice(0, 3000);
  const lower = content.toLowerCase();

  return {
    ...company,
    description: content || company.description,
    products: extractProductMentions(lower),
    employeeRange: extractEmployeeRange(content),
    revenueRange: "",
    asiaConnection: ASIA_KEYWORDS.some((kw) => lower.includes(kw)),
    indiaConnection: INDIA_KEYWORDS.some((kw) => lower.includes(kw)),
    country: targetCountry,
  };
}

function fallbackProfile(company: RawCompany, targetCountry: string): EnrichedCompanyProfile {
  return {
    ...company,
    description: company.description,
    products: "",
    employeeRange: "",
    revenueRange: "",
    asiaConnection: false,
    indiaConnection: false,
    country: targetCountry,
  };
}

// Signals that identify a SOURCING INTERMEDIARY — a company whose business is
// sourcing from India/Asia ON BEHALF OF brands. This makes them EEC's competitors,
// not buyers. e.g. ryzealsourcing.com — "Apparel Manufacturer UK Trusted Clothing
// Production Partner" sources garments from Asia for UK brands, exactly like EEC does.
const COMPETITOR_SIGNALS = [
  "sourcing partner", "production partner", "sourcing agent",
  "sourcing consultancy", "sourcing consultants", "sourcing service",
  "garment sourcing", "apparel sourcing", "textile sourcing agent",
  "clothing production partner", "manufacturing partner",
  "we source for", "source on behalf", "sourcing solutions",
  "ethical sourcing partner", "sourcing intermediary",
  "supply chain partner", "factory sourcing", "product sourcing agent",
];

function isSourcingCompetitor(result: any): boolean {
  const title = (result.title ?? "").toLowerCase();
  const desc  = (result.description ?? result.snippet ?? "").toLowerCase();
  return COMPETITOR_SIGNALS.some((sig) => title.includes(sig) || desc.includes(sig));
}

// Detects article/guide/list pages that Google ranks for commercial queries
// but are NOT actual company websites — e.g. "Top 10 fabric importers",
// "How to source fabric", "Industry analysis 2026".
const ARTICLE_TITLE_SIGNALS = [
  "top 10", "top 5", "top 15", "top 20",
  "how to", "how do", "guide to", "a guide",
  "what is", "what are", "why ",
  "industry analysis", "industry report", "market report", "market size",
  "best practices", "tips for", "strategies for",
  "2024 report", "2025 report", "2026 report", "2027 report",
  "directory of", "list of", "companies list", "companies in",
  "buyers & importers", "buyers and importers",
  "vs ", " vs.", "comparison",
  "manufacturing in", "manufacturers in",
  " explained", " overview",
];

function isArticleOrListPage(result: any): boolean {
  const title = (result.title ?? "").toLowerCase();
  const desc  = (result.description ?? result.snippet ?? "").toLowerCase();
  return ARTICLE_TITLE_SIGNALS.some((sig) => title.includes(sig) || desc.startsWith(sig));
}

function extractCompanyFromResult(result: any): RawCompany | null {
  const url: string = result.url ?? result.link ?? "";
  const domain = extractDomain(url);
  if (!domain) return null;

  // Clean up the page title → company name.
  // Titles often look like "Whaleys Bradford – Wholesale Fabric UK | Since 1891"
  // We want just "Whaleys Bradford".
  const raw = result.title ?? "";
  const name = raw
    .split(/[|–—]/)[0]          // take text before first pipe / dash
    .replace(/\s*-\s*.*$/, "")  // remove "- subtitle" suffixes
    .replace(/\b(wholesale|supplier|suppliers|company|ltd|limited|inc|llc|gmbh|bv|sas|srl)\b/gi, "")
    .trim() || domain;

  return {
    name,
    website: `https://${domain}`,
    description: result.description ?? result.snippet ?? "",
    sourceUrl: url,
  };
}

function extractProductMentions(text: string): string {
  const keywords = [
    "organic", "food", "textile", "fabric", "seafood", "spice",
    "rice", "grain", "pulse", "lentil", "import", "export",
    "wholesale", "distribute", "source", "supply", "trade",
  ];
  return keywords.filter((kw) => text.includes(kw)).slice(0, 10).join(", ");
}

function extractEmployeeRange(text: string): string {
  const patterns = [
    /(\d+)\s*[-–]\s*(\d+)\s*employees/i,
    /(\d+)\+?\s*employees/i,
    /team of (\d+)/i,
    /(\d{2,})\s*staff/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return "";
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

// ── Email regex — matches most real email patterns ────────────────────────────
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Prefixes ordered by procurement relevance (highest first)
const EMAIL_PREFIX_SCORE: Record<string, number> = {
  procurement: 10, sourcing: 10, purchasing: 10, buying: 10,
  einkauf: 10,  // German: purchasing
  achat: 10,    // French: purchasing
  import: 9,
  trading: 8,
  supply: 7,
  commercial: 6,
  sales: 5,
  export: 4,
  contact: 3,
  info: 2,
  hello: 1,
};

const SKIP_PREFIXES = new Set([
  "noreply", "no-reply", "donotreply", "do-not-reply",
  "support", "help", "abuse", "spam", "webmaster",
  "privacy", "legal", "unsubscribe", "newsletter",
  "notifications", "bounce",
]);

// Contact page paths to try (most companies have one of these)
const CONTACT_PATHS = ["/contact", "/contact-us", "/kontakt", "/nous-contacter", "/impressum", "/about", "/about-us"];

function scoreProcurementEmail(email: string): number {
  const prefix = email.split("@")[0].toLowerCase().replace(/[.\-_+]/g, "");
  if (SKIP_PREFIXES.has(prefix)) return -1;
  for (const [key, score] of Object.entries(EMAIL_PREFIX_SCORE)) {
    if (prefix.includes(key)) return score;
  }
  return 0;
}

function extractBestEmailFromText(text: string, ownDomain: string): string | null {
  const matches = text.match(EMAIL_RE) ?? [];
  const candidates = matches
    .filter((e) => {
      const domain = e.split("@")[1]?.toLowerCase() ?? "";
      // Only accept emails on the company's own domain (avoids picking up Gmail etc.)
      return domain === ownDomain || domain.endsWith(`.${ownDomain}`);
    })
    .filter((e) => scoreProcurementEmail(e) >= 0)
    .sort((a, b) => scoreProcurementEmail(b) - scoreProcurementEmail(a));

  return candidates[0] ?? null;
}

/**
 * Scrape the company website (homepage + contact page) with Firecrawl and
 * extract the best procurement-relevant email address without spending any
 * Hunter.io domain-search credits.
 */
export async function scrapeEmailFromWebsite(website: string): Promise<string | null> {
  const domain = extractDomain(website);
  if (!domain) return null;

  // Scrape homepage once — reused for both the quick-win check and last-pass fallback
  const homepageContent = await firecrawlScrape(website);

  // Quick win: high-quality procurement email on homepage (score >= 2 = info or better)
  if (homepageContent) {
    const email = extractBestEmailFromText(homepageContent, domain);
    if (email && scoreProcurementEmail(email) >= 2) {
      console.log(`[EmailScrape] Found on homepage: ${email}`);
      return email;
    }
  }

  // Try contact/impressum pages — accept score >= 1 (any named contact/hello/sales)
  const base = website.replace(/\/+$/, "");
  for (const path of CONTACT_PATHS) {
    await sleep(300);
    const content = await firecrawlScrape(`${base}${path}`);
    if (!content) continue;

    const email = extractBestEmailFromText(content, domain);
    if (email && scoreProcurementEmail(email) >= 1) {
      console.log(`[EmailScrape] Found on ${path}: ${email}`);
      return email;
    }
  }

  // Last-pass: accept ANY non-skip email from homepage (score >= 0, not in SKIP_PREFIXES)
  if (homepageContent) {
    const email = extractBestEmailFromText(homepageContent, domain);
    if (email && scoreProcurementEmail(email) >= 0) {
      console.log(`[EmailScrape] Fallback email from homepage: ${email}`);
      return email;
    }
  }

  console.log(`[EmailScrape] No email found on website for ${domain}`);
  return null;
}

/**
 * Scrape the company website for a FUNCTIONAL PROCUREMENT DEPARTMENT email only.
 *
 * Accepted prefixes (strict allowlist): procurement@, buying@, sourcing@, import@,
 * purchasing@, einkauf@ (German), achat@ (French), inkoop@ (Dutch), acquisti@ (Italian).
 *
 * Rejected: info@, contact@, sales@, hello@, and everything else not in the allowlist.
 * These department emails reach the buying desk directly — unlike info@ which goes
 * to a general inbox and is typically ignored for B2B sourcing outreach.
 */
const FUNCTIONAL_PROC_PREFIXES = [
  "procurement", "purchasing", "buying", "sourcing", "import", "imports",
  "einkauf",          // German: purchasing
  "achat", "achats",  // French: purchasing
  "inkoop",           // Dutch: purchasing
  "acquisti",         // Italian: purchasing
  "compras",          // Spanish/Portuguese: purchases
];

function isFunctionalProcurementEmail(email: string): boolean {
  const prefix = email.split("@")[0].toLowerCase().replace(/[._\-+]/g, "");
  return FUNCTIONAL_PROC_PREFIXES.some((p) => prefix === p || prefix.startsWith(p));
}

export async function scrapeFunctionalProcurementEmail(website: string): Promise<string | null> {
  const key = getFirecrawlKey();
  if (!key) return null;

  const domain = extractDomain(website);
  if (!domain) return null;

  const checkText = (text: string): string | null => {
    const matches = text.match(EMAIL_RE) ?? [];
    return matches.find((e) => {
      const emailDomain = e.split("@")[1]?.toLowerCase() ?? "";
      const onOwnDomain = emailDomain === domain || emailDomain.endsWith(`.${domain}`);
      return onOwnDomain && isFunctionalProcurementEmail(e);
    }) ?? null;
  };

  const homepageContent = await firecrawlScrape(website);
  if (homepageContent) {
    const found = checkText(homepageContent);
    if (found) {
      console.log(`[EmailScrape] Procurement dept email on homepage: ${found}`);
      return found;
    }
  }

  const base = website.replace(/\/+$/, "");
  for (const path of CONTACT_PATHS) {
    await sleep(300);
    const content = await firecrawlScrape(`${base}${path}`);
    if (!content) continue;
    const found = checkText(content);
    if (found) {
      console.log(`[EmailScrape] Procurement dept email on ${path}: ${found}`);
      return found;
    }
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
