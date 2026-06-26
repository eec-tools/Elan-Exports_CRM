export const CATEGORY_SEARCH_MAP: Record<string, string[]> = {
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
    "fish seafood importer",
  ],
  "Rice & Grains": [
    "rice importer wholesale basmati",
    "grain commodity importer trading",
    "basmati rice buyer India export",
    "cereal grain import wholesale company",
    "commodity trading food grain importer",
  ],
  "Spices & Herbs": [
    "spice importer wholesale distributor",
    "herbs spices trading company importer",
    "spice buyer India origin supplier",
    "dried spices wholesale import",
    "exotic spice importer food company",
  ],
  "Pulses & Lentils": [
    "pulse lentil importer wholesale",
    "chickpea lentil bean importer trading",
    "legume pulse food importer company",
    "dal lentil importer India sourcing",
    "bean pulse wholesale distributor",
  ],
};

export const COUNTRY_LANGUAGE_HINTS: Record<string, { native: string; searchExtra: string }> = {
  "Germany":      { native: "Deutschland", searchExtra: "importeur lebensmittel" },
  "France":       { native: "France",      searchExtra: "importateur alimentaire" },
  "Netherlands":  { native: "Nederland",   searchExtra: "importeur voedsel" },
  "Italy":        { native: "Italia",      searchExtra: "importatore alimentare" },
  "Spain":        { native: "España",      searchExtra: "importador alimentos" },
  "UK":           { native: "United Kingdom", searchExtra: "food importer wholesale" },
  "UAE":          { native: "UAE Dubai",   searchExtra: "food import trading FZCO" },
  "Saudi Arabia": { native: "Saudi Arabia Riyadh", searchExtra: "food trading import company" },
  "Japan":        { native: "Japan",       searchExtra: "food importer trading" },
  "Singapore":    { native: "Singapore",   searchExtra: "food import distributor" },
};

export const DIRECTORY_SITES = ["europages.co.uk", "kompass.com", "tradekey.com"];

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_LANGUAGE_HINTS);
export const SUPPORTED_CATEGORIES = Object.keys(CATEGORY_SEARCH_MAP);

export interface InputValidationResult {
  valid: boolean;
  error?: string;
  searchQueries: string[];
  directoryQueries: string[];
}

export function validateInputs(country: string, category: string): InputValidationResult {
  if (!country?.trim())
    return { valid: false, error: "Target country is required.", searchQueries: [], directoryQueries: [] };
  if (!category?.trim())
    return { valid: false, error: "Product category is required.", searchQueries: [], directoryQueries: [] };
  if (!CATEGORY_SEARCH_MAP[category])
    return { valid: false, error: `Unknown product category: "${category}"`, searchQueries: [], directoryQueries: [] };

  const baseQueries = CATEGORY_SEARCH_MAP[category];
  const hint = COUNTRY_LANGUAGE_HINTS[country] ?? { native: country, searchExtra: "" };

  const searchQueries = baseQueries.map((q) => `${q} ${country}`);
  const directoryQueries = DIRECTORY_SITES.map(
    (site) => `site:${site} ${baseQueries[0]} ${country}`
  );

  if (hint.searchExtra) {
    searchQueries.push(`${hint.native} ${hint.searchExtra}`);
  }

  return { valid: true, searchQueries, directoryQueries };
}
