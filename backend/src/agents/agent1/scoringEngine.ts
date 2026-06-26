import Groq from "groq-sdk";
import type { EnrichedCompanyProfile, FoundEmail, ScoreResult } from "./types.js";

let groq: Groq | null = null;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  if (!groq) {
    groq = new Groq({ apiKey });
  }
  return groq;
}

const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

// ── PRODUCTION SWAP ──────────────────────────────────────────────────────────
// Replace the 2 lines above with:
//   import Anthropic from "@anthropic-ai/sdk";
//   const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
//   const MODEL  = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
//
// Then replace groq.chat.completions.create(...) call below with:
//   const response = await claude.messages.create({
//     model: MODEL, max_tokens: 400,
//     messages: [{ role: "user", content: prompt }],
//   });
//   const text = (response.content[0] as any).text;
// ─────────────────────────────────────────────────────────────────────────────

export async function scoreCompany(
  profile: EnrichedCompanyProfile,
  contact: FoundEmail | null,
  hasVerifiedEmail: boolean,
  productCategory: string,
  targetCountry: string
): Promise<ScoreResult> {
  const client = getGroqClient();
  if (!client) {
    return {
      fitScore: 0,
      d1: 0,
      d2: 0,
      d3: 0,
      d4: 0,
      d5: 0,
      priorityTier: "Discard",
      rationale: "GROQ_API_KEY not configured.",
    };
  }

  const prompt = buildScoringPrompt(profile, contact, hasVerifiedEmail, productCategory, targetCountry);

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const raw = JSON.parse(response.choices[0].message.content ?? "{}");
    const dims = [raw.d1, raw.d2, raw.d3, raw.d4, raw.d5].map((v) => clamp(Number(v) || 0, 0, 20));
    const total = Math.min(100, dims.reduce((s, v) => s + v, 0));

    return {
      fitScore: total,
      d1: dims[0],
      d2: dims[1],
      d3: dims[2],
      d4: dims[3],
      d5: dims[4],
      priorityTier: total >= 70 ? "High" : total >= 45 ? "Medium" : total >= 30 ? "Low" : "Discard",
      rationale: raw.rationale ?? "Insufficient data to score.",
    };
  } catch (err) {
    console.error("[Agent1] Groq scoring error:", err);
    return {
      fitScore: 0,
      d1: 0, d2: 0, d3: 0, d4: 0, d5: 0,
      priorityTier: "Discard",
      rationale: "Scoring error — insufficient data.",
    };
  }
}

function buildScoringPrompt(
  profile: EnrichedCompanyProfile,
  contact: FoundEmail | null,
  hasVerifiedEmail: boolean,
  productCategory: string,
  targetCountry: string
): string {
  return `You are an expert B2B lead scorer for Elan Exports Company (EEC).
EEC is an India-based commodity and textile sourcing intermediary.

EEC's Ideal Customer Profile (ICP):
- Imports: food / organic produce / textiles / seafood / spices / rice / pulses
- Geography: Europe, Middle East, or Asia
- Size: $10M–$200M revenue OR 50–500 employees
- Signal: sources or is open to sourcing from India / South Asia
- Contact: reachable procurement or buying decision-maker

CURRENT SEARCH TARGET: ${productCategory} importers in ${targetCountry}

COMPANY PROFILE:
  Name:                ${profile.name}
  Website:             ${profile.website}
  Country:             ${profile.country}
  Products Mentioned:  ${profile.products || "—"}
  Employee Range:      ${profile.employeeRange || "unknown"}
  Asia Connection:     ${profile.asiaConnection}
  India Connection:    ${profile.indiaConnection}
  Contact Found:       ${contact ? `${contact.title} <${contact.email}>` : "None"}
  Email Verified:      ${hasVerifiedEmail}
  Description (first 1500 chars):
  ${profile.description.slice(0, 1500)}

Score on EXACTLY 5 dimensions, 0–20 points each:

D1 Product Category Match (0-20)
  Does this company import ${productCategory} or closely related products?
  20=perfect match  10=adjacent/partial  5=possible/unclear  0=no match

D2 Asia/India Sourcing Signal (0-20)
  Evidence of sourcing from India, South Asia, or broader Asia?
  20=confirmed India  15=confirmed Asia  8=possible/partial  0=no signal

D3 Company Size ICP Fit (0-20)
  Revenue $10M–$200M OR 50–500 employees?
  20=clearly in range  12=likely in range  5=unclear  0=clearly out of range

D4 Decision-Maker Reachability (0-20)
  Is a procurement/buying contact reachable with verified email?
  20=verified email of procurement contact  12=verified email title unknown  8=verified email non-procurement  0=none

D5 Geography Alignment (0-20)
  Is this company in EEC's target markets (Europe, Middle East, Asia)?
  20=core market  12=secondary market  5=adjacent  0=wrong geography

Return ONLY valid JSON. No markdown, no extra text.
{
  "d1": <0-20>,
  "d2": <0-20>,
  "d3": <0-20>,
  "d4": <0-20>,
  "d5": <0-20>,
  "total": <sum of d1+d2+d3+d4+d5>,
  "rationale": "<2-3 plain English sentences citing specific signals found>"
}`;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
