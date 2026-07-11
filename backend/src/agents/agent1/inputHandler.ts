// ── Apollo search parameters per product category ───────────────────────────

export const APOLLO_BUYER_TITLES: Record<string, string[]> = {
  "Organic Food": [
    "Food Buyer", "Head of Buying", "Procurement Manager",
    "Category Buyer", "Private Label Manager", "Head of Own Brand",
    "Retail Buyer", "Import Manager", "Sourcing Manager",
    "Hotel Food & Beverage Manager", "F&B Procurement Manager",
    "Restaurant Procurement Manager", "Head of Procurement",
    "Buying Director", "Purchasing Director",
  ],
  "Textiles": [
    "Textile Buyer", "Head of Buying", "Procurement Manager",
    "Sourcing Manager", "Import Manager", "Category Manager",
    "Home Furnishing Buyer", "Bedding Buyer", "Hospitality Procurement Manager",
    "Uniform Procurement Manager", "Merchandise Manager", "Buying Director",
    "Head of Sourcing", "Director of Procurement", "Purchasing Director",
  ],
  "Seafood": [
    "Seafood Buyer", "Head of Buying", "Category Buyer",
    "Retail Buyer", "Private Label Manager", "Procurement Manager",
    "Import Manager", "F&B Procurement Manager", "Hotel Procurement Manager",
    "Sourcing Manager", "Head of Procurement", "Commercial Director",
  ],
  "Rice & Grains": [
    "Food Buyer", "Retail Buyer", "Head of Buying",
    "Category Buyer", "Private Label Manager", "Head of Own Brand",
    "Import Manager", "Procurement Manager", "Sourcing Manager",
    "F&B Procurement Manager", "Head of Procurement", "Buying Director",
  ],
  "Spices & Herbs": [
    "Spice Buyer", "Food Buyer", "Retail Buyer",
    "Category Buyer", "Private Label Manager", "Head of Own Brand",
    "Import Manager", "Procurement Manager", "Sourcing Manager",
    "Head of Buying", "Buying Director", "Purchasing Director",
  ],
  "Pulses & Lentils": [
    "Food Buyer", "Retail Buyer", "Category Buyer",
    "Private Label Manager", "Head of Own Brand", "Head of Buying",
    "Import Manager", "Procurement Manager", "Sourcing Manager",
    "F&B Procurement Manager", "Buying Director", "Purchasing Director",
  ],
};

// Keywords Apollo uses to filter companies by industry/focus area
export const APOLLO_INDUSTRY_KEYWORDS: Record<string, string[]> = {
  "Organic Food": [
    "organic food retail", "supermarket private label organic",
    "organic food distributor", "health food retail chain",
    "hospitality organic food procurement", "organic food buying office",
    "private label organic brand importer", "organic food wholesale",
  ],
  "Textiles": [
    "retail chain textile buyer", "home furnishing brand importer",
    "hotel linen bedding procurement", "department store textile sourcing",
    "corporate uniform supplier", "promotional textile company",
    "hospitality textile supplier", "apparel store importer",
    "bedding brand wholesale buyer", "furnishing brand textile import",
  ],
  "Seafood": [
    "seafood retail chain buyer", "supermarket seafood private label",
    "hospitality seafood procurement", "frozen seafood distributor retail",
    "private label frozen seafood brand", "seafood buying office importer",
  ],
  "Rice & Grains": [
    "supermarket private label rice buyer", "retail chain rice grain buyer",
    "hospitality rice procurement", "private label rice brand importer",
    "ethnic food retailer grain buyer", "rice distributor retail supplier",
  ],
  "Spices & Herbs": [
    "supermarket own brand spice buyer", "retail chain spice herb buyer",
    "private label spice brand importer", "hospitality spice procurement",
    "ethnic grocery retail chain spice", "spice distributor retail supplier",
  ],
  "Pulses & Lentils": [
    "supermarket private label lentil buyer", "retail chain pulse lentil buyer",
    "ethnic food retailer lentil chickpea", "hospitality pulse procurement",
    "private label pulse brand importer", "health food retail chain lentil",
  ],
};

// ── Snov.io industry filter codes per category (LinkedIn industry names) ─────

export const SNOV_INDUSTRIES: Record<string, string[]> = {
  "Textiles": [
    "Retail",
    "Apparel & Fashion",
    "Textiles",
    "Hospitality",
    "Import and Export",
    "Wholesale",
    "Consumer Goods",
  ],
  "Organic Food": [
    "Retail",
    "Food & Beverages",
    "Hospitality",
    "Wholesale",
    "Import and Export",
    "Consumer Goods",
  ],
  "Seafood": [
    "Retail",
    "Food & Beverages",
    "Hospitality",
    "Wholesale",
    "Import and Export",
    "Fishery",
  ],
  "Rice & Grains": [
    "Retail",
    "Food & Beverages",
    "Hospitality",
    "Wholesale",
    "Import and Export",
    "Consumer Goods",
  ],
  "Spices & Herbs": [
    "Retail",
    "Food & Beverages",
    "Hospitality",
    "Wholesale",
    "Import and Export",
    "Consumer Goods",
  ],
  "Pulses & Lentils": [
    "Retail",
    "Food & Beverages",
    "Hospitality",
    "Wholesale",
    "Import and Export",
    "Consumer Goods",
  ],
};

// ── Firecrawl fallback search queries (used when Apollo plan doesn't allow search) ──

const CATEGORY_SEARCH_MAP: Record<string, string[]> = {
  "Organic Food": [
    "supermarket chain organic food private label buyer India",
    "organic food retailer buying office importer",
    "hospitality group organic food procurement sourcing India",
    "private label organic food brand wholesale importer",
    "health food retail chain buyer importer Asia",
    "supermarket own brand organic produce buyer India sourcing",
    "organic food distributor retail chain supplier",
    "restaurant chain organic ingredient procurement buyer",
  ],
  "Textiles": [
    "retail chain textile clothing buyer sourcing Asia",
    "home furnishing brand textile importer wholesale",
    "hotel linen bedding procurement company buyer",
    "department store textile buying office importer",
    "corporate uniform workwear supplier textile buyer",
    "promotional merchandise textile company wholesale buyer",
    "bedding brand textile wholesale sourcing India",
    "hospitality supplier hotel textile linen procurement",
    "apparel store clothing textile buyer importer",
    "furnishing brand upholstery fabric wholesale importer",
  ],
  "Seafood": [
    "supermarket chain frozen seafood private label buyer India",
    "retail chain seafood buyer importer sourcing Asia",
    "hospitality group hotel restaurant seafood procurement",
    "private label frozen seafood brand wholesale importer",
    "seafood distributor retail supermarket supplier India",
    "buying office frozen seafood importer distributor",
  ],
  "Rice & Grains": [
    "supermarket private label basmati rice buyer India",
    "retail chain rice grain buyer importer Asia sourcing",
    "hospitality group hotel restaurant rice procurement",
    "private label rice brand wholesale importer India",
    "ethnic food retailer grain buyer India sourcing",
    "buying office rice grain importer distributor",
  ],
  "Spices & Herbs": [
    "supermarket own brand spice buyer India sourcing",
    "retail chain spice herb buyer importer Asia",
    "private label spice brand wholesale India",
    "hospitality hotel restaurant spice procurement buyer",
    "ethnic grocery retail chain spice buyer India",
    "buying office spice herb distributor importer India",
  ],
  "Pulses & Lentils": [
    "supermarket private label lentil chickpea buyer India",
    "retail chain pulse lentil buyer importer Asia",
    "ethnic food retailer lentil chickpea buyer India sourcing",
    "hospitality group hotel restaurant pulse procurement",
    "private label pulse brand wholesale importer India",
    "health food retail chain lentil buyer India",
  ],
};

const DIRECTORY_SITES = ["kompass.com", "europages.eu"];

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
