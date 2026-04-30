export const BUDGET_CATEGORIES = {
  AD_SPEND_TIKTOK: "ad_spend_tiktok",
  AD_SPEND_SNAP: "ad_spend_snap",
  AD_SPEND_IG: "ad_spend_ig",
  INFLUENCER: "influencer",
  SHOP_MATERIALS: "shop_materials",
  PRODUCTION: "production",
  OTHER: "other",
} as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[keyof typeof BUDGET_CATEGORIES];

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  ad_spend_tiktok: "Ad Spend — TikTok",
  ad_spend_snap: "Ad Spend — Snapchat",
  ad_spend_ig: "Ad Spend — Instagram",
  influencer: "Influencer",
  shop_materials: "Shop Materials",
  production: "Production",
  other: "Other",
};
