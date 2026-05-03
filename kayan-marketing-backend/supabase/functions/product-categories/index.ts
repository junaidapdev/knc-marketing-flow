import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

// CRUD for product_categories. Single-tenant V1 — every endpoint resolves
// "the brand" as the first row from `brands` (matches the AI assistant's
// resolution).

const createSchema = z.object({
  name: z.string().min(1).max(200),
  displayOrder: z.number().int().min(0).max(1000).default(0),
  description: z.string().max(1000).nullable().optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

interface BrandRef {
  id: string;
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
  const baseIdx = pathParts.indexOf("product-categories");
  const categoryId = pathParts[baseIdx + 1] ?? null;
  const isCollection = categoryId === null;

  // ───── GET list ─────
  if (req.method === "GET" && isCollection) {
    const { data, error } = await db
      .from("product_categories")
      .select("*")
      .eq("brand_id", brandRef.id)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  // ───── GET detail ─────
  if (req.method === "GET" && categoryId) {
    const { data, error } = await db
      .from("product_categories")
      .select("*")
      .eq("id", categoryId)
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

    const { data, error } = await db
      .from("product_categories")
      .insert({
        brand_id: brandRef.id,
        name: parsed.data.name,
        display_order: parsed.data.displayOrder,
        description: parsed.data.description ?? null,
      })
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data), 201);
  }

  // ───── PATCH update ─────
  if (req.method === "PATCH" && categoryId) {
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
    if (parsed.data.name !== undefined) dbInput.name = parsed.data.name;
    if (parsed.data.displayOrder !== undefined) dbInput.display_order = parsed.data.displayOrder;
    if (parsed.data.description !== undefined) dbInput.description = parsed.data.description;
    if (parsed.data.isActive !== undefined) dbInput.is_active = parsed.data.isActive;

    const { data, error } = await db
      .from("product_categories")
      .update(dbInput)
      .eq("id", categoryId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  // ───── DELETE → soft delete ─────
  // Block if any active products still reference this category — better to
  // surface the conflict than orphan a bunch of dropdowns.
  if (req.method === "DELETE" && categoryId) {
    const { count, error: countErr } = await db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId)
      .eq("is_active", true);
    if (countErr) return jsonError("INTERNAL_ERROR", countErr.message, 500);
    if ((count ?? 0) > 0) {
      return jsonError(
        "VALIDATION_FAILED",
        `Cannot delete: ${count} active product(s) still use this category. Reassign them first.`,
        409,
      );
    }
    const { data, error } = await db
      .from("product_categories")
      .update({ is_active: false })
      .eq("id", categoryId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  return jsonError("NOT_FOUND", "Route not found.", 404);
});
