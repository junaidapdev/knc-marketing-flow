export const INFLUENCER_NICHE_TAGS = [
  "food",
  "lifestyle",
  "family",
  "comedy",
  "beauty",
  "fitness",
  "fashion",
  "travel",
  "parenting",
  "tech",
  "gaming",
  "music",
] as const;

export type InfluencerNicheTag = (typeof INFLUENCER_NICHE_TAGS)[number];

export const INFLUENCER_NICHE_TAG_LABELS: Record<InfluencerNicheTag, string> = {
  food: "Food",
  lifestyle: "Lifestyle",
  family: "Family",
  comedy: "Comedy",
  beauty: "Beauty",
  fitness: "Fitness",
  fashion: "Fashion",
  travel: "Travel",
  parenting: "Parenting",
  tech: "Tech",
  gaming: "Gaming",
  music: "Music",
};
