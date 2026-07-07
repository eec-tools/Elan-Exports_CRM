import Groq from "groq-sdk";
import type { RawCompany } from "./types.js";

const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

let groq: Groq | null = null;
function getGroq(): Groq | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  if (!groq) groq = new Groq({ apiKey: key });
  return groq;
}

// Per-category config — tightly scoped to match the REAL buyer profile for each product
const CATEGORY_CONFIG: Record<string, {
  whatWeWant: string;
  whatWeAvoid: string;
  goodExamples: string;
  badExamples: string;
}> = {
  "Textiles": {
    whatWeWant:
      "WHOLESALE FABRIC MERCHANTS and TEXTILE MATERIAL IMPORTERS — companies that buy raw fabrics, yarns, lining, or textile materials from Asian mills and resell them to clothing manufacturers",
    whatWeAvoid:
      "fashion brands, luxury houses, garment retailers, clothing chains — they design clothes but do NOT import raw fabric from India",
    goodExamples:
      "regional fabric merchants, yarn importers, technical textile wholesalers, lining/interlining importers, denim fabric distributors",
    badExamples:
      "Balmain, Sonia Rykiel, Ba&sh, SMCP, Cacharel, Jules, Agnes B, Comptoir des Cotonniers — these are fashion labels, not fabric importers",
  },
  "Organic Food": {
    whatWeWant:
      "ORGANIC FOOD IMPORTERS and WHOLESALE DISTRIBUTORS — companies that buy organic produce, bio food, or natural food products from Asian/Indian farms and distribute to retailers or restaurants",
    whatWeAvoid:
      "supermarket chains (Carrefour, Leclerc, Rewe) — they buy from local distributors, not directly from Asian suppliers",
    goodExamples:
      "organic food wholesalers, bio food importers, health food distributors, specialty organic ingredient suppliers",
    badExamples:
      "Carrefour Bio, Leclerc, Metro, Rewe Bio, large supermarket chains",
  },
  "Seafood": {
    whatWeWant:
      "SEAFOOD IMPORTERS and FROZEN FISH WHOLESALERS — companies that import frozen seafood, shrimp, or fish from India/Asia and distribute to restaurants, retailers, or food service",
    whatWeAvoid:
      "restaurant chains, fish processing plants that only process local catch, large retail chains",
    goodExamples:
      "frozen seafood importers, shrimp wholesalers, fish import-export companies, seafood distributors",
    badExamples:
      "McDonald's fish suppliers, large supermarket seafood sections, local fish processors",
  },
  "Rice & Grains": {
    whatWeWant:
      "COMMODITY GRAIN IMPORTERS and RICE WHOLESALERS — companies that import basmati rice, wheat, or commodity grains from India/Asia and distribute to food manufacturers or retailers",
    whatWeAvoid:
      "large commodity trading houses (Louis Dreyfus, Cargill) — too large and have protected procurement",
    goodExamples:
      "rice importers, basmati rice distributors, grain trading companies, cereal import houses",
    badExamples:
      "Cargill, Louis Dreyfus, Nestle, major FMCG brands",
  },
  "Spices & Herbs": {
    whatWeWant:
      "SPICE IMPORTERS and HERB WHOLESALERS — companies that import dried spices, herbs, or seasonings from India/Asia and distribute to food manufacturers or specialty retailers",
    whatWeAvoid:
      "spice brand owners that outsource sourcing (McCormick, etc.), large supermarket private label buyers",
    goodExamples:
      "spice importers, herb wholesalers, ethnic food importers, food ingredient distributors",
    badExamples:
      "McCormick, Schwartz, Ducros, major spice consumer brands",
  },
  "Pulses & Lentils": {
    whatWeWant:
      "PULSE AND LEGUME IMPORTERS — companies that import lentils, chickpeas, or dried beans from India/Canada and distribute to food manufacturers or specialty food retailers",
    whatWeAvoid:
      "large commodity traders, supermarket private label buyers",
    goodExamples:
      "pulse importers, legume wholesalers, health food ingredient importers, dried bean distributors",
    badExamples:
      "Bonduelle, major canned food brands, large commodity traders",
  },
};

export async function discoverCompaniesWithLLM(
  country: string,
  productCategory: string
): Promise<RawCompany[]> {
  const client = getGroq();
  if (!client) {
    console.warn("[LLM Discovery] GROQ_API_KEY not set");
    return [];
  }

  const cfg = CATEGORY_CONFIG[productCategory] ?? {
    whatWeWant:   `${productCategory} importers and wholesale distributors`,
    whatWeAvoid:  "large brand owners, mega-retailers with protected procurement",
    goodExamples: "regional importers, specialty wholesalers, trading companies",
    badExamples:  "major consumer brands, large supermarket chains",
  };

  // Two focused batches — sequential to avoid Groq rate limit
  const batch1 = await queryGroqBatch(client, country, productCategory, cfg, "batch-a");
  const batch2 = await queryGroqBatch(client, country, productCategory, cfg, "batch-b");

  const seen   = new Set<string>();
  const result: RawCompany[] = [];

  for (const c of [...batch1, ...batch2]) {
    const domain = extractDomain(c.website);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    result.push(c);
  }

  console.log(`[LLM Discovery] ${result.length} unique companies — ${country} · ${productCategory}`);
  return result;
}

async function queryGroqBatch(
  client: Groq,
  country: string,
  productCategory: string,
  cfg: { whatWeWant: string; whatWeAvoid: string; goodExamples: string; badExamples: string },
  batchId: string
): Promise<RawCompany[]> {
  const focusExtra = batchId === "batch-a"
    ? "Focus on companies that import raw materials, components, or finished goods from Asia / South Asia / India."
    : "Focus on regional distributors, independent wholesalers, and niche trading companies in the country.";

  const prompt = `You are a global B2B trade expert. A sourcing company in India is looking for buyers.

TASK: List 15 real companies based in ${country} that are buyers of ${productCategory}.

━━━ WHO WE WANT (INCLUDE THESE) ━━━
${cfg.whatWeWant}
Good examples: ${cfg.goodExamples}

━━━ WHO WE DO NOT WANT (EXCLUDE THESE) ━━━
${cfg.whatWeAvoid}
Bad examples: ${cfg.badExamples}

━━━ SIZE & REACHABILITY RULES ━━━
✅ 30–500 employees, €1M–€150M revenue — small enough to have a reachable procurement email
✅ Companies likely to have a contact like: procurement@, sourcing@, buying@, import@, einkauf@, info@
❌ NO household-name mega-brands — they hide behind enterprise firewalls
❌ NO freight forwarders, logistics firms, customs agents
❌ NO companies that EXPORT the product instead of importing it
❌ Do not include any company you are less than 75% confident is real and based in ${country}

${focusExtra}

Return ONLY this JSON (no markdown, no extra text):
{
  "companies": [
    {
      "name": "Full Official Company Name",
      "website": "domain.tld",
      "description": "One sentence: what they import/buy and from where"
    }
  ]
}`;

  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: batchId === "batch-a" ? 0.15 : 0.4,
      max_tokens: 1800,
      response_format: { type: "json_object" },
    });

    const raw  = JSON.parse(res.choices[0].message.content ?? "{}");
    const list: any[] = Array.isArray(raw) ? raw : (raw.companies ?? []);

    const valid = list
      .filter((c) => c?.name?.trim() && c?.website?.trim())
      .map((c) => ({
        name:        c.name.trim(),
        website:     normalizeUrl(c.website),
        description: (c.description ?? "").trim(),
        sourceUrl:   "Groq AI Research",
      }));

    console.log(`[LLM Discovery] ${batchId}: ${valid.length} companies returned`);
    return valid;
  } catch (err: any) {
    console.error(`[LLM Discovery] ${batchId} failed:`, err?.message);
    return [];
  }
}

function normalizeUrl(raw: string): string {
  const stripped = raw.trim().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  return `https://${stripped}`;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
