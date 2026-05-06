import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

// Saved creators — the team's persistent shortlist of creators flagged
// from search results. CRUD for the V1 single-tenant brand.
//
// Routes (the function gets called as /functions/v1/saved-creators[/:id]):
//   GET    /saved-creators?platform=tiktok    list, joined with creator_results
//   POST   /saved-creators                    insert (idempotent on (brand, creator_result))
//   DELETE /saved-creators/:id                hard delete, 204
//
// Idempotency: a duplicate POST returns 200 with the existing row instead
// of erroring on the (brand_id, creator_result_id) unique constraint, so
// the frontend can fire-and-forget on Save without race-condition checks.

const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;

const createSchema = z.object({
  creatorResultId: z.string().uuid(),
  notes: z.string().max(2000).nullable().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const baseIdx = pathParts.indexOf("saved-creators");
  const savedId = pathParts[baseIdx + 1] ?? null;
  const isCollection = savedId === null;

  // V1 single-tenant brand resolution. Mirrors search-creators.
  async function resolveBrandId(): Promise<string | Response> {
    const { data: brand, error } = await db
      .from("brands")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    if (error || !brand) {
      return jsonError("INTERNAL_ERROR", error?.message ?? "Brand not found.", 500);
    }
    return brand.id as string;
  }

  // GET /saved-creators?platform=tiktok  — list, joined with creator_results
  if (req.method === "GET" && isCollection) {
    const platformParam = url.searchParams.get("platform");
    if (platformParam && !PLATFORMS.includes(platformParam as typeof PLATFORMS[number])) {
      return jsonError("VALIDATION_FAILED", "Invalid platform.", 422);
    }
    const brandIdOrErr = await resolveBrandId();
    if (typeof brandIdOrErr !== "string") return brandIdOrErr;
    const brandId = brandIdOrErr;

    let q = db
      .from("saved_creators")
      .select("*, creator_result:creator_results(*)")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    const { data, error } = await q;
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);

    // Optional client-side platform filter on the joined relation. Postgres
    // can't filter on a 1:1 nested relation in a single supabase-js query
    // without RPC, so we filter in JS — list size is bounded by the user's
    // total saved count, so this is cheap.
    let rows = (data ?? []) as Array<Record<string, unknown>>;
    if (platformParam) {
      rows = rows.filter((r) => {
        const cr = r.creator_result as { platform?: string } | null;
        return cr?.platform === platformParam;
      });
    }
    return jsonSuccess(toCamel(rows));
  }

  // POST /saved-creators  — idempotent on (brand_id, creator_result_id)
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

    const brandIdOrErr = await resolveBrandId();
    if (typeof brandIdOrErr !== "string") return brandIdOrErr;
    const brandId = brandIdOrErr;

    // Check for an existing row first so we can return 200 (already saved)
    // instead of erroring on the unique constraint. The check + insert is
    // not atomic, but the unique index makes the race-condition fallback
    // safe — we catch the duplicate-key error below and re-fetch.
    const { data: existing } = await db
      .from("saved_creators")
      .select("*, creator_result:creator_results(*)")
      .eq("brand_id", brandId)
      .eq("creator_result_id", parsed.data.creatorResultId)
      .maybeSingle();
    if (existing) return jsonSuccess(toCamel(existing));

    const { data, error } = await db
      .from("saved_creators")
      .insert({
        brand_id: brandId,
        creator_result_id: parsed.data.creatorResultId,
        saved_by: auth.userId,
        notes: parsed.data.notes ?? null,
      })
      .select("*, creator_result:creator_results(*)")
      .single();

    // Postgres unique-constraint violation = 23505. If the user double-
    // clicked Save and we lost the check-vs-insert race, re-fetch and
    // return the existing row.
    if (error?.code === "23505") {
      const { data: existed } = await db
        .from("saved_creators")
        .select("*, creator_result:creator_results(*)")
        .eq("brand_id", brandId)
        .eq("creator_result_id", parsed.data.creatorResultId)
        .single();
      if (existed) return jsonSuccess(toCamel(existed));
    }
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data), 201);
  }

  // DELETE /saved-creators/:id — hard delete, 204
  if (req.method === "DELETE" && savedId) {
    const { error } = await db
      .from("saved_creators")
      .delete()
      .eq("id", savedId);
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return jsonError("NOT_FOUND", "Route not found.", 404);
});
