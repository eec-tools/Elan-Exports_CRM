// ── Apollo search parameters per product category ───────────────────────────

export const APOLLO_BUYER_TITLES: Record<string, string[]> = {
  "Organic Food": [
    "Procurement Manager", "Import Manager", "Purchasing Director",
    "Head of Procurement", "Sourcing Manager", "Buying Manager",
    "Category Manager", "Commercial Director", "Food Buyer",
    "Director of Purchasing", "VP Procurement", "Supply Chain Director",
    "Head of Buying", "Chief Procurement Officer",
  ],
  "Textiles": [
    "Procurement Manager", "Sourcing Manager", "Buying Director",
    "Import Manager", "Textile Buyer", "Fashion Buyer",
    "Head of Sourcing", "Supply Chain Manager", "Category Manager",
    "Merchandise Manager", "VP Sourcing", "Director of Procurement",
    "Head of Merchandising", "Purchasing Director",
  ],
  "Seafood": [
    "Procurement Manager", "Import Manager", "Seafood Buyer",
    "Purchasing Director", "Category Manager", "Sourcing Manager",
    "Head of Procurement", "Commercial Director", "Trading Director",
  ],
  "Rice & Grains": [
    "Commodity Trader", "Procurement Manager", "Import Manager",
    "Grain Buyer", "Trading Manager", "Sourcing Director",
    "Head of Procurement", "Commercial Director", "Commodity Manager",
  ],
  "Spices & Herbs": [
    "Procurement Manager", "Import Manager", "Spice Buyer",
    "Category Manager", "Sourcing Manager", "Head of Procurement",
    "Purchasing Director", "Commercial Manager",
  ],
  "Pulses & Lentils": [
    "Procurement Manager", "Import Manager", "Commodity Buyer",
    "Sourcing Manager", "Purchasing Director", "Head of Procurement",
    "Trading Manager", "Commercial Director",
  ],
};

// Keywords Apollo uses to filter companies by industry/focus area
export const APOLLO_INDUSTRY_KEYWORDS: Record<string, string[]> = {
  "Organic Food": [
    "organic food", "food import", "food wholesale", "food distribution",
    "grocery import", "natural food", "health food distributor",
  ],
  "Textiles": [
    "textile import", "fabric wholesale", "garment import",
    "apparel sourcing", "textile trading", "clothing wholesale",
  ],
  "Seafood": [
    "seafood import", "fish wholesale", "seafood distribution",
    "frozen seafood", "fish import", "marine food",
  ],
  "Rice & Grains": [
    "grain import", "rice wholesale", "commodity trading",
    "cereal import", "basmati rice", "grain distribution",
  ],
  "Spices & Herbs": [
    "spice import", "herb wholesale", "spice trading",
    "dried spices", "spice distribution",
  ],
  "Pulses & Lentils": [
    "pulse import", "lentil wholesale", "legume import",
    "chickpea import", "dal import", "bean wholesale",
  ],
};

// ── Snov.io industry filter codes per category (LinkedIn industry names) ─────

export const SNOV_INDUSTRIES: Record<string, string[]> = {
  "Textiles": [
    "Apparel & Fashion",
    "Textiles",
    "Wholesale",
    "Import and Export",
    "Retail",
  ],
  "Organic Food": [
    "Food & Beverages",
    "Wholesale",
    "Import and Export",
    "Farming",
    "Consumer Goods",
  ],
  "Seafood": [
    "Food & Beverages",
    "Wholesale",
    "Import and Export",
    "Fishery",
  ],
  "Rice & Grains": [
    "Food & Beverages",
    "Wholesale",
    "Import and Export",
    "Farming",
    "Consumer Goods",
  ],
  "Spices & Herbs": [
    "Food & Beverages",
    "Wholesale",
    "Import and Export",
    "Consumer Goods",
  ],
  "Pulses & Lentils": [
    "Food & Beverages",
    "Wholesale",
    "Import and Export",
    "Farming",
  ],
};

// ── Firecrawl fallback search queries (used when Apollo plan doesn't allow search) ──

const CATEGORY_SEARCH_MAP: Record<string, string[]> = {
  "Organic Food": [
    "organic food importer wholesale company",
    "bio food import wholesaler distributor",
    "organic produce distributor sourcing Asia",
    "certified organic food import trading company",
    "natural food wholesale importer B2B",
  ],
  "Textiles": [
    "textile fabric importer wholesale company",
    "fabric wholesale trading importer B2B",
    "garment fabric sourcing import company",
    "yarn fabric lining importer wholesale",
    "textile material trading company importer",
  ],
  "Seafood": [
    "seafood importer wholesale distributor company",
    "frozen shrimp seafood trading company importer",
    "fish seafood import wholesale B2B",
    "prawn shrimp importer wholesale company",
  ],
  "Rice & Grains": [
    "basmati rice importer wholesale company",
    "grain commodity import trading company",
    "rice wholesale importer distributor B2B",
    "cereal grain import wholesale company",
  ],
  "Spices & Herbs": [
    "spice importer wholesale distributor company",
    "herbs dried spices trading company importer",
    "spice ingredient wholesale import B2B",
    "dried spices wholesale import company",
  ],
  "Pulses & Lentils": [
    "lentil pulse importer wholesale company",
    "chickpea bean lentil import trading company",
    "legume pulse importer wholesale B2B",
    "dal lentil import wholesale company",
  ],
};

const DIRECTORY_SITES = ["kompass.com", "europages.eu", "tradekey.com", "exportersindia.com"];

export const SUPPORTED_CATEGORIES = Object.keys(APOLLO_BUYER_TITLES);

export const SUPPORTED_COUNTRIES = [
  "Germany", "France", "Netherlands", "Italy", "Spain", "UK",
  "UAE", "Saudi Arabia", "Qatar", "Kuwait",
  "Japan", "Singapore", "Australia",
];

// ── Validation ────────────────────────────────────────────────────────────────

export interface InputValidationResult {
  valid: boolean;
  error?: string;
  apolloBuyerTitles: string[];
  apolloKeywords: string[];
  snovIndustries: string[];     // Snov.io LinkedIn industry codes
  searchQueries: string[];      // Firecrawl fallback queries
  directoryQueries: string[];   // Firecrawl directory site queries
}

const EMPTY: InputValidationResult = {
  valid: false,
  apolloBuyerTitles: [],
  apolloKeywords: [],
  snovIndustries: [],
  searchQueries: [],
  directoryQueries: [],
};

export function validateInputs(country: string, category: string): InputValidationResult {
  if (!country?.trim())
    return { ...EMPTY, error: "Target country is required." };
  if (!category?.trim())
    return { ...EMPTY, error: "Product category is required." };
  if (!APOLLO_BUYER_TITLES[category])
    return { ...EMPTY, error: `Unsupported product category: "${category}"` };

  const baseQueries = CATEGORY_SEARCH_MAP[category] ?? [];

  return {
    valid: true,
    apolloBuyerTitles:  APOLLO_BUYER_TITLES[category],
    apolloKeywords:     APOLLO_INDUSTRY_KEYWORDS[category] ?? [],
    snovIndustries:     SNOV_INDUSTRIES[category] ?? [],
    searchQueries:      baseQueries.map((q) => `${q} ${country}`),
    directoryQueries:   DIRECTORY_SITES.map((site) => `site:${site} ${baseQueries[0]} ${country}`),
  };
}
