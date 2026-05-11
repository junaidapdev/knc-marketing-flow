export const INFLUENCER_LANGUAGES = {
  ARABIC: "arabic",
  ENGLISH: "english",
} as const;

export type InfluencerLanguage =
  (typeof INFLUENCER_LANGUAGES)[keyof typeof INFLUENCER_LANGUAGES];

export const INFLUENCER_LANGUAGE_LABELS: Record<InfluencerLanguage, string> = {
  arabic: "Arabic",
  english: "English",
};
