import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

// CRUD for the marketing products catalog. The list GET supports filters used
// by the Settings → Products page (category, branch, trending, hero, search).
// PATCH with `branchIds` does a replace-then-insert on product_branches so
// the user can edit "available at" in one form save.

const PRICE_TIERS = ["anchor", "premium", "bulk", "open_price"] as const;

const createSchema = z.object({
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

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

interface BrandRef {
  id: string;
}

// Helper: replace the product_branches set for a product with the given
// branch ids. Two-step: delete-all-then-insert. Acceptable because the row
// counts are small (≤50 branches per product) and it sidesteps the awkward
// "diff and apply" logic that would otherwise be needed.
async function replaceBranchLinks(
  // deno-lint-ignore no-explicit-any
  db: any,
  productId: string,
  branchIds: string[],
): Promise<{ error: { message: string } | null }> {
  const { error: delErr } = await db
    .from("product_branches")
    .delete()
    .eq("product_id", productId);
  if (delErr) return { error: delErr };
  if (branchIds.length === 0) return { error: null };
  const rows = branchIds.map((bid) => ({ product_id: productId, branch_id: bid }));
  const { error: insErr } = await db.from("product_branches").insert(rows);
  if (insErr) return { error: insErr };
  return { error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const { data: brand, error: brandErr } = await db
    .from("brands")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (brandErr || !brand) {
    return jsonError("INTERNAL_ERROR", "Brand row missing.", 500);
  }
  const brandRef = brand as BrandRef;

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const baseIdx = pathParts.indexOf("products");
  const productId = pathParts[baseIdx + 1] ?? null;
  const isCollection = productId === null;

  // ───── GET list ─────
  if (req.method === "GET" && isCollection) {
    const categoryId = url.searchParams.get("categoryId");
    const branchId = url.searchParams.get("branchId");
    const isTrending = url.searchParams.get("isTrending");
    const isHero = url.searchParams.get("isHero");
    const tag = url.searchParams.get("tag");
    const search = url.searchParams.get("search");
    const includeInactiveRaw = url.searchParams.get("includeInactive");
    const includeInactive = includeInactiveRaw === "true" || includeInactiveRaw === "1";

    // Pull every product + its category + every branch link in one query.
    // Branch filtering is done in JS (a `?branchId=...` filter on the
    // joined relation isn't available in the supabase-js select grammar
    // without a server-side view).
    let q = db
      .from("products")
      .select(
        "*, category:product_categories(id, name, display_order), branches:product_branches(branch_id, is_in_stock)",
      )
      .eq("brand_id", brandRef.id)
      .order("name", { ascending: true });

    if (!includeInactive) q = q.eq("is_active", true);
    if (categoryId) q = q.eq("category_id", categoryId);
    if (isTrending === "true") q = q.eq("is_trending", true);
    if (isHero === "true") q = q.eq("is_hero_product", true);
    if (tag) q = q.contains("tags", [tag]);
    if (search && search.trim().length > 0) {
      // Postgres `or` filter — case-insensitive match across the two human
      // fields the user is likely searching by.
      const s = search.trim().replace(/[%_]/g, "");
      q = q.or(`name.ilike.%${s}%,manufacturer.ilike.%${s}%`);
    }

    const { data, error } = await q;
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);

    let rows = data ?? [];
    if (branchId) {
      // deno-lint-ignore no-explicit-any
      rows = rows.filter((p: any) =>
        Array.isArray(p.branches) &&
        p.branches.some((b: { branch_id: string; is_in_stock: boolean }) =>
          b.branch_id === branchId && b.is_in_stock !== false,
        ),
      );
    }

    return jsonSuccess(toCamel(rows));
  }

  // ───── GET detail ─────
  if (req.method === "GET" && productId) {
    const { data, error } = await db
      .from("products")
      .select(
        "*, category:product_categories(id, name, display_order), branches:product_branches(branch_id, is_in_stock, notes)",
      )
      .eq("id", productId)
      .single();
    if (error) return jsonError("NOT_FOUND", error.message, 404);
    return jsonSuccess(toCamel(data));
  }

  // ───── POST create ─────
  if (req.method === "POST" && isCollection) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("VALIDATION_FAILED", "Invalid JSON.", 400);
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const { data: inserted, error: insErr } = await db
      .from("products")
      .insert({
        brand_id: brandRef.id,
        category_id: parsed.data.categoryId ?? null,
        name: parsed.data.name,
        manufacturer: parsed.data.manufacturer ?? null,
        description: parsed.data.description ?? null,
        price_tier: parsed.data.priceTier,
        is_trending: parsed.data.isTrending,
        is_hero_product: parsed.data.isHeroProduct,
        marketing_notes: parsed.data.marketingNotes ?? null,
        tags: parsed.data.tags ?? [],
      })
      .select()
      .single();
    if (insErr) return jsonError("INTERNAL_ERROR", insErr.message, 500);

    if (parsed.data.branchIds && parsed.data.branchIds.length > 0) {
      const rows = parsed.data.branchIds.map((bid) => ({
        product_id: inserted.id,
        branch_id: bid,
      }));
      const { error: linkErr } = await db.from("product_branches").insert(rows);
      if (linkErr) return jsonError("INTERNAL_ERROR", linkErr.message, 500);
    }

    return jsonSuccess(toCamel(inserted), 201);
  }

  // ───── PATCH update ─────
  if (req.method === "PATCH" && productId) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("VALIDATION_FAILED", "Invalid JSON.", 400);
    }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const dbInput: Record<string, unknown> = {};
    if (parsed.data.categoryId !== undefined) dbInput.category_id = parsed.data.categoryId;
    if (parsed.data.name !== undefined) dbInput.name = parsed.data.name;
    if (parsed.data.manufacturer !== undefined) dbInput.manufacturer = parsed.data.manufacturer;
    if (parsed.data.description !== undefined) dbInput.description = parsed.data.description;
    if (parsed.data.priceTier !== undefined) dbInput.price_tier = parsed.data.priceTier;
    if (parsed.data.isTrending !== undefined) dbInput.is_trending = parsed.data.isTrending;
    if (parsed.data.isHeroProduct !== undefined) dbInput.is_hero_product = parsed.data.isHeroProduct;
    if (parsed.data.marketingNotes !== undefined) dbInput.marketing_notes = parsed.data.marketingNotes;
    if (parsed.data.tags !== undefined) dbInput.tags = parsed.data.tags;
    if (parsed.data.isActive !== undefined) dbInput.is_active = parsed.data.isActive;

    if (Object.keys(dbInput).length > 0) {
      const { error: updErr } = await db
        .from("products")
        .update(dbInput)
        .eq("id", productId);
      if (updErr) return jsonError("INTERNAL_ERROR", updErr.message, 500);
    }

    if (parsed.data.branchIds !== undefined) {
      const result = await replaceBranchLinks(db, productId, parsed.data.branchIds);
      if (result.error) return jsonError("INTERNAL_ERROR", result.error.message, 500);
    }

    // Re-read with the joined shape so the caller gets fresh data.
    const { data, error } = await db
      .from("products")
      .select(
        "*, category:product_categories(id, name, display_order), branches:product_branches(branch_id, is_in_stock, notes)",
      )
      .eq("id", productId)
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  // ───── DELETE → soft delete ─────
  if (req.method === "DELETE" && productId) {
    const { data, error } = await db
      .from("products")
      .update({ is_active: false })
      .eq("id", productId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  return jsonError("NOT_FOUND", "Route not found.", 404);
});
