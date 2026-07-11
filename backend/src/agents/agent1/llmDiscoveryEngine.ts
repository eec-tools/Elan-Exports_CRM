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
      "RETAIL CHAINS, HOME FURNISHING BRANDS, HOTEL PROCUREMENT COMPANIES, BEDDING BRANDS, DEPARTMENT STORES, TEXTILE IMPORTERS, PROMOTIONAL TEXTILE COMPANIES, CORPORATE UNIFORM COMPANIES, HOSPITALITY SUPPLIERS, and APPAREL STORES — companies that buy finished or semi-finished textile products (garments, home textiles, hotel linen, uniforms, bedding, furnishing fabric) and source from India or Asia",
    whatWeAvoid:
      "SOURCING INTERMEDIARIES AND SOURCING AGENTS — companies whose core business is sourcing garments or textiles from India/Asia ON BEHALF OF brands. These are EEC's direct competitors, not buyers. Identifiable by: 'sourcing partner', 'production partner', 'clothing production partner', 'apparel sourcing', 'garment sourcing', 'sourcing agent', 'manufacturing partner'. Example to avoid: ryzealsourcing.com ('Trusted Clothing Production Partner'). Also avoid: raw yarn traders, textile testing labs, sewing machine sellers, cotton commodity traders",
    goodExamples:
      "retail chains with a clothing or home section (Next, New Look, C&A), home furnishing brands (Dunelm, Linen House), hotel linen and bedding suppliers, corporate workwear and uniform companies, promotional merchandise firms, department stores with Asian buying offices, hospitality linen suppliers, apparel store chains that source from India/Bangladesh",
    badExamples:
      "ryzealsourcing.com (sourcing partner for brands — EEC competitor), yarn spinners, raw cotton traders, textile machinery distributors, fabric testing laboratories",
  },
  "Organic Food": {
    whatWeWant:
      "RETAILERS, SUPERMARKET CHAINS, PRIVATE LABEL FOOD BUYERS, HOSPITALITY GROUPS, DISTRIBUTORS, and BUYING OFFICES — companies that buy, retail, or distribute organic food, bio produce, or natural food products and source from India or Asia. This includes supermarkets with own-brand organic ranges, hotel and restaurant groups buying organic ingredients, health food retail chains, private label organic brands, and food buying offices",
    whatWeAvoid:
      "pure logistics brokers with no buying decisions, small local organic farms that grow their own produce, food testing laboratories",
    goodExamples:
      "supermarket chains with organic own-brand ranges (Waitrose, Aldi Bio, Leclerc Bio, Rewe Bio), health food retail chains, hotel groups sourcing organic ingredients, restaurant chains buying organic produce, private label organic food brands, food distributors supplying supermarkets, ethnic food retail chains",
    badExamples:
      "small local organic farms, food processing test labs, pure freight and logistics companies",
  },
  "Seafood": {
    whatWeWant:
      "RETAILERS, SUPERMARKET CHAINS, PRIVATE LABEL SEAFOOD BUYERS, HOSPITALITY GROUPS, DISTRIBUTORS, and BUYING OFFICES — companies that import, retail, or distribute frozen seafood, shrimp, or fish from India/Asia. Includes supermarkets with seafood departments or own-brand frozen fish, hotel and restaurant groups buying seafood, private label frozen seafood brands, and seafood distributors supplying retail",
    whatWeAvoid:
      "local fish farms and fish processing plants that process only local catch, pure fishing vessels, seafood testing laboratories",
    goodExamples:
      "supermarket chains with seafood private label ranges, hotel chains buying frozen seafood, restaurant groups sourcing shrimp from India, private label frozen seafood brands, seafood distributors supplying retail chains, buying offices for supermarket seafood categories",
    badExamples:
      "local fish farms, aquaculture-only businesses, seafood testing labs, fishing vessels",
  },
  "Rice & Grains": {
    whatWeWant:
      "RETAILERS, SUPERMARKET CHAINS, PRIVATE LABEL RICE BRANDS, HOSPITALITY GROUPS, DISTRIBUTORS, and BUYING OFFICES — companies that buy, retail, or distribute basmati rice, specialty grains, or commodity grains from India/Asia. Includes supermarkets with own-brand rice ranges, ethnic food retail chains, hotel and restaurant procurement groups, private label rice brands, and grain distributors",
    whatWeAvoid:
      "mega commodity trading houses (Cargill, Louis Dreyfus, ADM, Bunge) — too large and vertically integrated with closed procurement, pure grain processing plants with no import buying",
    goodExamples:
      "supermarket chains with own-brand basmati range, ethnic food retail chains, hotel and restaurant buying groups, private label rice and grain brands, rice distributors supplying supermarkets, South Asian grocery retail chains",
    badExamples:
      "Cargill, Louis Dreyfus, ADM, Bunge — mega commodity houses with closed procurement chains",
  },
  "Spices & Herbs": {
    whatWeWant:
      "RETAILERS, SUPERMARKET CHAINS, PRIVATE LABEL SPICE BRANDS, HOSPITALITY GROUPS, DISTRIBUTORS, and BUYING OFFICES — companies that buy, retail, or distribute dried spices, herbs, or seasonings from India/Asia. Includes supermarkets with own-brand spice ranges, ethnic grocery retail chains, hotel and restaurant procurement, private label spice brands, and spice distributors",
    whatWeAvoid:
      "major consumer spice brands with their own locked global sourcing chains (McCormick, Schwartz, Ducros) — they do not open procurement to new suppliers easily",
    goodExamples:
      "supermarkets with own-brand spice ranges, ethnic grocery retail chains, hotel and restaurant buying groups, private label spice brands, spice and herb distributors sourcing from India, food service spice suppliers",
    badExamples:
      "McCormick, Schwartz, Ducros, Verstegen — major consumer brands with closed procurement",
  },
  "Pulses & Lentils": {
    whatWeWant:
      "RETAILERS, SUPERMARKET CHAINS, PRIVATE LABEL PULSE BRANDS, HOSPITALITY GROUPS, DISTRIBUTORS, and BUYING OFFICES — companies that buy, retail, or distribute lentils, chickpeas, or dried beans from India/Asia. Includes supermarkets with own-brand pulse ranges, ethnic food retail chains, health food retail chains, hotel and restaurant procurement, and private label pulse brands",
    whatWeAvoid:
      "mega commodity traders (Cargill, ADM, Bunge) — too large and vertically integrated, pure grain trading desks with no branded or retail output",
    goodExamples:
      "supermarkets with own-brand lentil and pulse ranges, ethnic food retail chains, health food retail chains, South Asian grocery chains, hotel and restaurant groups buying dried pulses, private label pulse and lentil brands, distributors supplying retail",
    badExamples:
      "Cargill, ADM, Bunge, Bonduelle — mega commodity houses or large canned food brands with closed procurement",
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
    ? "Focus on RETAILERS, SUPERMARKET CHAINS, and HOSPITALITY GROUPS (hotel chains, restaurant groups) that buy this product from India / South Asia / Asia — either directly or via a buying office."
    : "Focus on DISTRIBUTORS, BUYING OFFICES, PRIVATE LABEL BRANDS, and IMPORTERS that source this product from India / Asia and supply it to retailers or food service companies.";

  const prompt = `You are a global B2B trade expert. A sourcing company in India is looking for buyers.

TASK: List 15 real companies based in ${country} that are buyers of ${productCategory}.

━━━ WHO WE WANT (INCLUDE THESE) ━━━
${cfg.whatWeWant}
Good examples: ${cfg.goodExamples}

━━━ WHO WE DO NOT WANT (EXCLUDE THESE) ━━━
${cfg.whatWeAvoid}
Bad examples: ${cfg.badExamples}

━━━ SIZE & REACHABILITY RULES ━━━
✅ 30–2000 employees — includes regional retail chains, hotel groups, and department stores
✅ Companies likely to have a contact like: procurement@, sourcing@, buying@, import@, einkauf@, purchasing@
✅ Prefer companies with a buying office, procurement team, or sourcing department
❌ NO freight forwarders, logistics firms, customs agents
❌ NO companies that EXPORT the product instead of importing it
❌ NO sourcing agents or sourcing intermediaries — companies whose business is sourcing FROM India/Asia on behalf of Western brands. These are our competitors. Signs: "sourcing partner", "production partner", "apparel sourcing", "garment sourcing", "manufacturing partner", "sourcing agent". They are NOT buyers — they compete with us.
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
