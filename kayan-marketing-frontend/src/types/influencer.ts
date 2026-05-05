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
}

export interface CreatorSearchCost {
  id: string;
  searchId: string;
  apifyCostUsd: number;
  claudeCostUsd: number;
  totalCostUsd: number;
  createdAt: string;
}
