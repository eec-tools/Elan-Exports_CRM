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

// ── Firecrawl fallback search queries (used when Apollo plan doesn't allow search) ──

const CATEGORY_SEARCH_MAP: Record<string, string[]> = {
  "Organic Food": [
    "organic food importer wholesale",
    "organic produce distributor import",
    "certified organic food buyer sourcing Asia",
    "bio food import wholesaler",
    "natural organic food trading company",
  ],
  "Textiles": [
    "textile fabric importer wholesale",
    "garment clothing importer sourcing India",
    "textile buyer manufacturer India supplier",
    "fabric wholesale importer trading",
    "apparel sourcing company importer",
  ],
  "Seafood": [
    "seafood importer wholesale distributor",
    "frozen fish seafood trading company",
    "seafood buyer India supplier",
    "shrimp prawn importer wholesale",
  ],
  "Rice & Grains": [
    "rice importer wholesale basmati",
    "grain commodity importer trading",
    "basmati rice buyer India export",
    "cereal grain import wholesale company",
  ],
  "Spices & Herbs": [
    "spice importer wholesale distributor",
    "herbs spices trading company importer",
    "spice buyer India origin supplier",
    "dried spices wholesale import",
  ],
  "Pulses & Lentils": [
    "pulse lentil importer wholesale",
    "chickpea lentil bean importer trading",
    "legume pulse food importer company",
    "dal lentil importer India sourcing",
  ],
};

const DIRECTORY_SITES = ["europages.co.uk", "kompass.com", "tradekey.com"];

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
  searchQueries: string[];      // Firecrawl fallback queries
  directoryQueries: string[];   // Firecrawl directory site queries
}

const EMPTY: InputValidationResult = {
  valid: false,
  apolloBuyerTitles: [],
  apolloKeywords: [],
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
    searchQueries:      baseQueries.map((q) => `${q} ${country}`),
    directoryQueries:   DIRECTORY_SITES.map((site) => `site:${site} ${baseQueries[0]} ${country}`),
  };
}
