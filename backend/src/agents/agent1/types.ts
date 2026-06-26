// Shared TypeScript interfaces for Agent 1: Discover & Rank

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
