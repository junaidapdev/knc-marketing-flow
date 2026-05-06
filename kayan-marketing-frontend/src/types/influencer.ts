import type {
  Platform,
  ContentCategory,
  Language,
  GccCountry,
  CreatorSearchStatus,
} from "../constants/influencer";

// Filter payload submitted from the FilterForm to /search-creators. Optional
// fields are omitted when not set so the Edge Function's Zod schema sees a
// clean object instead of nulls scattered through.
export interface CreatorSearchFilters {
  platforms: Platform[];
  countries: GccCountry[];
  city?: string;
  ageMin?: number;
  ageMax?: number;
  genderSkew?: "female" | "male" | "balanced";
  audienceCountries?: GccCountry[];
  followerMin?: number;
  followerMax?: number;
  engagementRateMin?: number;
  engagementRateMax?: number;
  avgViewsMin?: number;
  avgLikesMin?: number;
  postingFrequency?: "daily" | "weekly" | "monthly";
  categories: ContentCategory[];
  language?: Language;
}

export interface CreatorSearch {
  id: string;
  brandId: string;
  createdBy: string | null;
  filters: CreatorSearchFilters;
  status: CreatorSearchStatus;
  resultCount: number;
  createdAt: string;
}

// Per-creator audience demographic estimates. Shape varies by platform and
// actor — kept open here, surfaced as estimated in the UI via
// isEstimatedDemographics on CreatorResult.
export interface CreatorAudienceDemographics {
  ageBuckets?: Record<string, number>;
  genderSplit?: { female?: number; male?: number; other?: number };
  topCountries?: Array<{ country: string; share: number }>;
  topCities?: Array<{ city: string; share: number }>;
}

export interface CreatorResult {
  id: string;
  searchId: string;
  platform: Platform;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number;
  engagementRate: number | null;
  language: Language | null;
  country: string | null;
  city: string | null;
  audienceDemographics: CreatorAudienceDemographics;
  fitScore: number | null;
  fitRationale: string | null;
  isEstimatedDemographics: boolean;
  createdAt: string;
}

export interface SavedCreator {
  id: string;
  brandId: string;
  creatorResultId: string;
  savedBy: string | null;
  notes: string | null;
  createdAt: string;
  // Populated by GET /saved-creators (list) + POST /saved-creators
  // responses — the row is joined to the creator_results table so the
  // saved view doesn't need a second round trip.
  creatorResult: CreatorResult;
}

export interface CreatorSearchCost {
  id: string;
  searchId: string;
  apifyCostUsd: number;
  claudeCostUsd: number;
  totalCostUsd: number;
  createdAt: string;
}

// Per-run cost breakdown — present on /search-creators responses (actual
// billed cost) and on /estimate-creator-search responses (predicted).
// Same shape so the UI can render either through the same component.
export interface CreatorSearchCostBreakdown {
  apifyCostUsd: number;
  claudeCostUsd: number;
  totalCostUsd: number;
}

// Wire shape returned by /search-creators. failureReasons holds per-platform
// error strings for partial-failure surfacing in the UI ("Couldn't fetch
// from <platform>"). Empty array on full success.
export interface CreatorSearchResponse {
  searchId: string;
  results: CreatorResult[];
  failureReasons: string[];
  // Actual billed cost for this run. Null only if the cost couldn't be
  // computed for some reason — current backend always returns a number.
  cost: CreatorSearchCostBreakdown | null;
}

// Wire shape returned by /estimate-creator-search. Pure math — no actor
// or model calls were made.
export interface CreatorSearchEstimate extends CreatorSearchCostBreakdown {
  assumptions: string[];
}
