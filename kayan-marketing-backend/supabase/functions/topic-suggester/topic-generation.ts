// Function-local copy of src/constants/topic-generation.ts.
//
// Every other Edge Function in this codebase inlines its constants because
// the Supabase bundle is rooted at `supabase/functions/` — cross-imports
// into `../../../src/` can fail at deploy time depending on the bundler
// behavior. To keep the convention consistent (see calendar-entries
// /index.ts: "Deno cannot import from the TS source tree directly.") we
// keep a verbatim mirror here.
//
// IMPORTANT: keep this file in lock-step with:
//   kayan-marketing-backend/src/constants/topic-generation.ts
//   kayan-marketing-frontend/src/constants/topic-generation.ts
// If you change one, change the other two.

export const TOPIC_GENERATION_MODES = {
  BALANCED: "balanced",
  SEASONAL: "seasonal",
  PRODUCT_PUSH: "product_push",
  BRANCH_TRAFFIC: "branch_traffic",
  PREMIUM_GIFTS: "premium_gifts",
  FUNNY_CHALLENGE: "funny_challenge",
  EXPERIMENTAL: "experimental",
} as const;

export type TopicGenerationMode =
  (typeof TOPIC_GENERATION_MODES)[keyof typeof TOPIC_GENERATION_MODES];

export const TOPIC_GENERATION_MODE_VALUES = [
  "balanced",
  "seasonal",
  "product_push",
  "branch_traffic",
  "premium_gifts",
  "funny_challenge",
  "experimental",
] as const;

export const TOPIC_GENERATION_MODE_CONFIG: Record<
  TopicGenerationMode,
  {
    label: string;
    description: string;
    instruction: string;
  }
> = {
  balanced: {
    label: "Balanced",
    description: "A varied mix across products, seasons, branches, audiences, and formats.",
    instruction:
      "Create a balanced planning batch. Spread ideas across product-led, seasonal, branch-led, audience-led, and format-led lanes.",
  },
  seasonal: {
    label: "Seasonal",
    description: "Ideas tied to holidays, school moments, weather, and shopping seasons.",
    instruction:
      "Prioritize timely seasonal hooks while keeping every topic useful for Kayan products and store traffic.",
  },
  product_push: {
    label: "Product Push",
    description: "Move attention toward products, hero items, new arrivals, and value stacks.",
    instruction:
      "Generate product-first topics that make a specific product/category feel worth visiting Kayan for.",
  },
  branch_traffic: {
    label: "Branch Traffic",
    description: "Ideas designed to send customers to specific branches.",
    instruction:
      "Create branch-led topics that make a store visit feel urgent, local, and easy to act on.",
  },
  premium_gifts: {
    label: "Premium Gifts",
    description: "Gifting, chocolate boxes, guest-hosting, and premium presentation ideas.",
    instruction:
      "Focus on premium gifting, presentation, guest-hosting, and products that make Kayan feel giftable.",
  },
  funny_challenge: {
    label: "Funny / Challenge",
    description: "Playable creator ideas, reactions, games, and light competition.",
    instruction:
      "Prioritize creator-led games, funny challenges, reactions, and participatory ideas that are still easy to shoot.",
  },
  experimental: {
    label: "Experimental",
    description: "Bolder concepts for testing new formats without drifting away from the brand.",
    instruction:
      "Explore fresh formats and unexpected angles, but keep every idea practical, brand-safe, and relevant to Kayan Sweets.",
  },
};

export const TOPIC_GENERATION_LANES = {
  SEASONAL: "seasonal",
  PRODUCT_LED: "product_led",
  BRANCH_LED: "branch_led",
  AUDIENCE_LED: "audience_led",
  FORMAT_LED: "format_led",
  OFFER_LED: "offer_led",
  INFLUENCER_LED: "influencer_led",
  PREMIUM_GIFT: "premium_gift",
  FUNNY_CHALLENGE: "funny_challenge",
  EXPERIMENTAL: "experimental",
} as const;

export type TopicGenerationLane =
  (typeof TOPIC_GENERATION_LANES)[keyof typeof TOPIC_GENERATION_LANES];

export const TOPIC_GENERATION_LANE_VALUES = [
  "seasonal",
  "product_led",
  "branch_led",
  "audience_led",
  "format_led",
  "offer_led",
  "influencer_led",
  "premium_gift",
  "funny_challenge",
  "experimental",
] as const;

export const TOPIC_GENERATION_MODE_LANES: Record<
  TopicGenerationMode,
  TopicGenerationLane[]
> = {
  balanced: ["product_led", "seasonal", "branch_led", "audience_led", "format_led"],
  seasonal: ["seasonal", "product_led", "premium_gift", "audience_led"],
  product_push: ["product_led", "offer_led", "premium_gift", "format_led"],
  branch_traffic: ["branch_led", "offer_led", "funny_challenge", "audience_led"],
  premium_gifts: ["premium_gift", "seasonal", "product_led", "audience_led"],
  funny_challenge: ["funny_challenge", "format_led", "audience_led", "branch_led"],
  experimental: ["experimental", "format_led", "funny_challenge", "influencer_led"],
};

export const TOPIC_SCORE_DIMENSIONS = {
  BRAND_FIT: "brand_fit",
  NOVELTY: "novelty",
  SEASONAL_RELEVANCE: "seasonal_relevance",
  PRODUCTION_EASE: "production_ease",
  SALES_USEFULNESS: "sales_usefulness",
  CREATOR_ENERGY: "creator_energy",
} as const;

export type TopicScoreDimension =
  (typeof TOPIC_SCORE_DIMENSIONS)[keyof typeof TOPIC_SCORE_DIMENSIONS];

export const TOPIC_SCORE_DIMENSION_VALUES = [
  "brand_fit",
  "novelty",
  "seasonal_relevance",
  "production_ease",
  "sales_usefulness",
  "creator_energy",
] as const;

export const TOPIC_SCORE_LABELS: Record<TopicScoreDimension, string> = {
  brand_fit: "Brand fit",
  novelty: "Novelty",
  seasonal_relevance: "Seasonal relevance",
  production_ease: "Production ease",
  sales_usefulness: "Sales usefulness",
  creator_energy: "Creator energy",
};

export const TOPIC_SCORE_MIN = 1;
export const TOPIC_SCORE_MAX = 10;
export const TOPIC_MIN_OVERALL_SAVE_SCORE = 7;
export const TOPIC_OVERGENERATION_MULTIPLIER = 2;
export const TOPIC_OVERGENERATION_EXTRA = 3;
export const TOPIC_MAX_GENERATED_IDEAS = 24;
export const TOPIC_MAX_CRITIC_ATTEMPTS = 1;
export const TOPIC_RAW_GENERATION_MAX_COMPLETION_TOKENS = 6500;
export const TOPIC_CRITIC_MAX_COMPLETION_TOKENS = 5000;
