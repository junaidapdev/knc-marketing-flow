import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

// Field bounds. Kept inline (Edge Functions can't import from src/).
const LABEL_MAX = 120;
const COUNT_MIN = 1;
const COUNT_MAX = 999;
const SORT_GAP = 10;
const MONTH_DATE_REGEX = /^\d{4}-\d{2}-01$/;

const labelSchema = z.string().trim().min(1).max(LABEL_MAX);
const countSchema = z.number().int().min(COUNT_MIN).max(COUNT_MAX);
const countMaxSchema = countSchema.nullable();

const createSchema = z
  .object({
    brandId: z.string().uuid(),
    month: z.string().regex(MONTH_DATE_REGEX),
    label: labelSchema,
    count: countSchema,
    countMax: countMaxSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.countMax != null && data.countMax < data.count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["countMax"],
        message: "Max count must be >= count.",
      });
    }
  });

const updateSchema = z
  .object({
    label: labelSchema.optional(),
    count: countSchema.optional(),
    countMax: countMaxSchema.optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.countMax != null &&
      data.count != null &&
      data.countMax < data.count
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["countMax"],
        message: "Max count must be >= count.",
      });
    }
  });

const copySchema = z.object({
  brandId: z.string().uuid(),
  targetMonth: z.string().regex(MONTH_DATE_REGEX),
  sourceMonth: z.string().regex(MONTH_DATE_REGEX),
});

interface PlanItemRow {
  id: string;
  brand_id: string;
  month: string;
  label: string;
  count: number;
  count_max: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  // Drop the function-name prefix so sub-routes parse cleanly.
  const path = url.pathname.replace(/^.*\/monthly-video-plan/, "");
  const segments = path.split("/").filter(Boolean);
  const firstSegment = segments[0];

  // ── POST /monthly-video-plan/copy-from-previous ─────────────────────────
  if (req.method === "POST" && firstSegment === "copy-from-previous") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("VALIDATION_FAILED", "Invalid JSON.", 400);
    }
    const parsed = copySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const { data: sourceRows, error: sourceErr } = await db
      .from("monthly_video_plan_items")
      .select("label, count, count_max, sort_order")
      .eq("brand_id", parsed.data.brandId)
      .eq("month", parsed.data.sourceMonth)
      .order("sort_order", { ascending: true });
    if (sourceErr) return jsonError("INTERNAL_ERROR", sourceErr.message, 500);

    if (!sourceRows || sourceRows.length === 0) {
      return jsonSuccess<PlanItemRow[]>([], 200, { copied: 0 });
    }

    const toInsert = sourceRows.map((row) => ({
      brand_id: parsed.data.brandId,
      month: parsed.data.targetMonth,
      label: row.label,
      count: row.count,
      count_max: row.count_max,
      sort_order: row.sort_order,
    }));

    const { data: inserted, error: insertErr } = await db
      .from("monthly_video_plan_items")
      .insert(toInsert)
      .select("*")
      .order("sort_order", { ascending: true });
    if (insertErr) return jsonError("INTERNAL_ERROR", insertErr.message, 500);

    return jsonSuccess(toCamel(inserted ?? []), 201, {
      copied: inserted?.length ?? 0,
    });
  }

  // ── GET /monthly-video-plan?brandId=&month= ─────────────────────────────
  if (req.method === "GET" && segments.length === 0) {
    const brandId = url.searchParams.get("brandId");
    const month = url.searchParams.get("month");
    if (!brandId || !month) {
      return jsonError(
        "VALIDATION_FAILED",
        "brandId and month are required.",
        422,
      );
    }
    if (!MONTH_DATE_REGEX.test(month)) {
      return jsonError(
        "VALIDATION_FAILED",
        "month must be YYYY-MM-01.",
        422,
      );
    }

    const { data, error } = await db
      .from("monthly_video_plan_items")
      .select("*")
      .eq("brand_id", brandId)
      .eq("month", month)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);

    return jsonSuccess(toCamel(data ?? []));
  }

  // ── POST /monthly-video-plan (create) ───────────────────────────────────
  if (req.method === "POST" && segments.length === 0) {
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

    // Compute next sort_order for this brand+month so new rows go at the end.
    const { data: maxRow, error: maxErr } = await db
      .from("monthly_video_plan_items")
      .select("sort_order")
      .eq("brand_id", parsed.data.brandId)
      .eq("month", parsed.data.month)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) return jsonError("INTERNAL_ERROR", maxErr.message, 500);

    const nextSort = (maxRow?.sort_order ?? 0) + SORT_GAP;

    const { data, error } = await db
      .from("monthly_video_plan_items")
      .insert({
        brand_id: parsed.data.brandId,
        month: parsed.data.month,
        label: parsed.data.label,
        count: parsed.data.count,
        count_max: parsed.data.countMax ?? null,
        sort_order: nextSort,
      })
      .select("*")
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);

    return jsonSuccess(toCamel(data), 201);
  }

  // ── PATCH /monthly-video-plan/:id ───────────────────────────────────────
  if (req.method === "PATCH" && segments.length === 1) {
    const id = segments[0];
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

    const patch: Record<string, unknown> = {};
    if (parsed.data.label !== undefined) patch.label = parsed.data.label;
    if (parsed.data.count !== undefined) patch.count = parsed.data.count;
    if (parsed.data.countMax !== undefined) {
      patch.count_max = parsed.data.countMax;
    }
    if (parsed.data.sortOrder !== undefined) {
      patch.sort_order = parsed.data.sortOrder;
    }

    if (Object.keys(patch).length === 0) {
      return jsonError("VALIDATION_FAILED", "No fields to update.", 422);
    }

    const { data, error } = await db
      .from("monthly_video_plan_items")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    if (!data) return jsonError("NOT_FOUND", "Item not found.", 404);

    return jsonSuccess(toCamel(data));
  }

  // ── DELETE /monthly-video-plan/:id ──────────────────────────────────────
  if (req.method === "DELETE" && segments.length === 1) {
    const id = segments[0];
    const { error } = await db
      .from("monthly_video_plan_items")
      .delete()
      .eq("id", id);
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return jsonError("NOT_FOUND", "Route not supported.", 404);
});
