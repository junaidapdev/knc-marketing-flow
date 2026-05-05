// Influencer Search domain constants. Mirrors the CHECK constraints used by
// migration 0039 (creator_searches, creator_results). Keep these in sync with
// the backend if the platform set, language set, or content category set ever
// changes.

export const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

// Used for the multi-select content category filter. Curated to the buckets
// Kayan cares about for fit scoring; not a free-text field.
export const CONTENT_CATEGORIES = [
  "dessert",
  "food",
  "family",
  "gifting",
  "lifestyle",
] as const;
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export const CONTENT_CATEGORY_LABELS: Record<ContentCategory, string> = {
  dessert: "Dessert",
  food: "Food",
  family: "Family",
  gifting: "Gifting",
  lifestyle: "Lifestyle",
};

export const LANGUAGES = ["arabic", "english", "both"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  arabic: "Arabic",
  english: "English",
  both: "Both",
};

// GCC ISO 3166-1 alpha-2 country codes. Lowercased to match what the platform
// scrapers typically emit. Saudi Arabia is the primary market — keep it first
// in iteration order so default-selected filters land on it.
export const GCC_COUNTRIES = ["sa", "ae", "kw", "bh", "qa", "om"] as const;
export type GccCountry = (typeof GCC_COUNTRIES)[number];

export const GCC_COUNTRY_LABELS: Record<GccCountry, string> = {
  sa: "Saudi Arabia",
  ae: "United Arab Emirates",
  kw: "Kuwait",
  bh: "Bahrain",
  qa: "Qatar",
  om: "Oman",
};

// Search lifecycle — mirrors the CHECK on creator_searches.status.
export const CREATOR_SEARCH_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;
export type CreatorSearchStatus = (typeof CREATOR_SEARCH_STATUSES)[number];
