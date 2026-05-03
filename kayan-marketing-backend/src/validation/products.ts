import { z } from "zod";

const PRICE_TIERS = ["anchor", "premium", "bulk", "open_price"] as const;

// ───── Categories ─────

export const createCategorySchema = z.object({
  name: z.string().min(1).max(200),
  displayOrder: z.number().int().min(0).max(1000).default(0),
  description: z.string().max(1000).nullable().optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ───── Products ─────
// `branchIds` is the create/update payload for the product_branches links —
// when provided on PATCH, the existing links for this product are replaced
// (delete then insert) so the user can edit availability in one form save.

export const createProductSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  manufacturer: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  priceTier: z.enum(PRICE_TIERS).default("anchor"),
  isTrending: z.boolean().default(false),
  isHeroProduct: z.boolean().default(false),
  marketingNotes: z.string().max(1000).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  branchIds: z.array(z.string().uuid()).max(50).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
