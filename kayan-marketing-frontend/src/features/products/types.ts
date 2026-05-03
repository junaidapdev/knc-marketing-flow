// Marketing catalog types — mirror of the products + product_categories +
// product_branches DB tables (migrations 0034–0036). Camel-cased; snake →
// camel transform happens at the API boundary.

export const PRICE_TIERS = ["anchor", "premium", "bulk", "open_price"] as const;
export type PriceTier = (typeof PRICE_TIERS)[number];

export const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  anchor: "Anchor (11.50 SR)",
  premium: "Premium",
  bulk: "Bulk bundle",
  open_price: "Open price",
};

export interface ProductCategory {
  id: string;
  brandId: string;
  name: string;
  displayOrder: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Slim category embedded in the joined product GET (only id + name +
// display order — full descriptions land via the dedicated category list).
export interface ProductCategorySlim {
  id: string;
  name: string;
  displayOrder?: number;
}

export interface ProductBranchLink {
  branchId: string;
  isInStock?: boolean;
  notes?: string | null;
}

export interface Product {
  id: string;
  brandId: string;
  categoryId: string | null;
  name: string;
  manufacturer: string | null;
  description: string | null;
  priceTier: PriceTier;
  isTrending: boolean;
  isHeroProduct: boolean;
  isActive: boolean;
  marketingNotes: string | null;
  tags: string[];
  // Joined on GET — null when the relation isn't included.
  category?: ProductCategorySlim | null;
  branches?: ProductBranchLink[];
  createdAt: string;
  updatedAt: string;
}

// ───── Inputs ─────

export interface CreateProductInput {
  categoryId?: string | null;
  name: string;
  manufacturer?: string | null;
  description?: string | null;
  priceTier?: PriceTier;
  isTrending?: boolean;
  isHeroProduct?: boolean;
  marketingNotes?: string | null;
  tags?: string[];
  branchIds?: string[];
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  isActive?: boolean;
}

export interface CreateCategoryInput {
  name: string;
  displayOrder?: number;
  description?: string | null;
}

export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {
  isActive?: boolean;
}

// List filters consumed by useProducts.
export interface ProductFilters {
  categoryId?: string;
  branchId?: string;
  isTrending?: boolean;
  isHero?: boolean;
  tag?: string;
  search?: string;
  includeInactive?: boolean;
}
