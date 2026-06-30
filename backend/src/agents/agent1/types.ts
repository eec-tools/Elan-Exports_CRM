// Shared TypeScript interfaces for Agent 1: Discover & Rank

// ── Apollo-specific types ────────────────────────────────────────────────────

export interface ApolloContact {
  firstName: string;
  lastName: string;
  name: string;
  title: string;
  email: string | null;          // verified in Apollo's DB; null on basic plans
  emailStatus: string | null;    // "verified" | "likely to engage" | "unavailable" | null
  linkedinUrl: string | null;
}

export interface ApolloOrganization {
  name: string;                  // MANDATORY — discard if absent
  domain: string;
  website: string;
  industry: string;
  employeeCount: number | null;
  annualRevenue: number | null;
  description: string;
  keywords: string[];
  linkedinUrl: string | null;
}

export interface ApolloLead {
  contact: ApolloContact;
  organization: ApolloOrganization;
}

// ── Normalized contact used for DB save (source-agnostic) ───────────────────

export interface NormalizedContact {
  email: string;                 // MANDATORY
  emailStatus: string;           // "valid" | "deliverable" | "verified"
  emailConfidence: number;
  firstName: string;
  lastName: string;
  title: string;
  linkedinUrl: string;
  isPrimary: boolean;
}

// ────────────────────────────────────────────────────────────────────────────

export interface RawCompany {
  name: string;
  website: string;
  description: string;
  sourceUrl: string;
}

export interface EnrichedCompanyProfile extends RawCompany {
  products: string;
  employeeRange: string;
  revenueRange: string;
  asiaConnection: boolean;
  indiaConnection: boolean;
  country: string;
}

export interface FoundEmail {
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  confidence: number;
  linkedinUrl: string;
}

export interface VerifiedEmail {
  email: string;
  status: "valid" | "deliverable" | "risky" | "invalid" | "unknown";
  score: number;
}

export interface EmailResult {
  contacts: FoundEmail[];
  verifiedPrimary: VerifiedEmail | null;
  shouldDiscard: boolean;
  discardReason: string | null;
}

export interface ScoreResult {
  fitScore: number;
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  d5: number;
  priorityTier: "High" | "Medium" | "Low" | "Discard";
  rationale: string;
}
