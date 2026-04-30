import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

const PLATFORM_VALUES = ["tiktok", "instagram", "snapchat"] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const upsertSchema = z.object({
  brandId: z.string().uuid(),
  snapshotDate: z.string().regex(DATE_REGEX),
  platform: z.enum(PLATFORM_VALUES),
  followers: z.number().int().nonnegative().nullable().optional(),
  totalViews: z.number().int().nonnegative().nullable().optional(),
  totalLikes: z.number().int().nonnegative().nullable().optional(),
  totalComments: z.number().int().nonnegative().nullable().optional(),
  totalShares: z.number().int().nonnegative().nullable().optional(),
  reach: z.number().int().nonnegative().nullable().optional(),
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
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const platformFilter = url.searchParams.get("platform");

    if (!brandId) return jsonError("VALIDATION_FAILED", "brandId is required.", 422);

    let q = db
      .from("performance_snapshots")
      .select("*")
      .eq("brand_id", brandId)
      .order("snapshot_date", { ascending: true });
    if (fromDate) q = q.gte("snapshot_date", fromDate);
    if (toDate) q = q.lte("snapshot_date", toDate);
    if (platformFilter) q = q.eq("platform", platformFilter);

    const { data, error } = await q;
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
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

    // UPSERT on (brand_id, snapshot_date, platform); the table has the unique constraint.
    const { data, error } = await db
      .from("performance_snapshots")
      .upsert(
        {
          brand_id: parsed.data.brandId,
          snapshot_date: parsed.data.snapshotDate,
          platform: parsed.data.platform,
          followers: parsed.data.followers ?? null,
          total_views: parsed.data.totalViews ?? null,
          total_likes: parsed.data.totalLikes ?? null,
          total_comments: parsed.data.totalComments ?? null,
          total_shares: parsed.data.totalShares ?? null,
          reach: parsed.data.reach ?? null,
          notes: parsed.data.notes ?? null,
        },
        { onConflict: "brand_id,snapshot_date,platform" },
      )
      .select()
      .single();

    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data), 201);
  }

  return jsonError("NOT_FOUND", "Method not supported.", 404);
});
