import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

const BUDGET_CATEGORY_VALUES = [
  "ad_spend_tiktok",
  "ad_spend_snap",
  "ad_spend_ig",
  "influencer",
  "shop_materials",
  "production",
  "other",
] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const upsertSchema = z.object({
  brandId: z.string().uuid(),
  month: z.string().regex(DATE_REGEX),
  totalCap: z.number().positive(),
  categoryCaps: z.record(z.enum(BUDGET_CATEGORY_VALUES), z.number().nonnegative()).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);

  if (req.method === "GET") {
    const brandId = url.searchParams.get("brandId");
    const month = url.searchParams.get("month");
    if (!brandId || !month) {
      return jsonError("VALIDATION_FAILED", "brandId and month are required.", 422);
    }
    const { data, error } = await db
      .from("budget_caps")
      .select("*")
      .eq("brand_id", brandId)
      .eq("month", month)
      .maybeSingle();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(data ? toCamel(data) : null);
  }

  if (req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("VALIDATION_FAILED", "Invalid JSON.", 400);
    }
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    // Upsert by (brand_id, month) — table has unique constraint
    const { data, error } = await db
      .from("budget_caps")
      .upsert(
        {
          brand_id: parsed.data.brandId,
          month: parsed.data.month,
          total_cap: parsed.data.totalCap,
          category_caps: parsed.data.categoryCaps ?? {},
          notes: parsed.data.notes ?? null,
        },
        { onConflict: "brand_id,month" },
      )
      .select()
      .single();

    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data), 201);
  }

  return jsonError("NOT_FOUND", "Method not supported.", 404);
});
