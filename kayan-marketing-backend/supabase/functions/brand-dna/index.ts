import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

// Brand DNA admin API. Single-tenant V1: every endpoint resolves "the brand"
// as the first row from `brands` (matches the AI assistant's resolution).
//
// Routes (after /functions/v1/brand-dna):
//   GET  /                      → current dna_markdown + voice_config
//   PATCH /                     → atomic update via update_brand_dna RPC
//   GET  /history?limit=N       → metadata-only list (no full content)
//   GET  /history/:id           → single history row with full content
//   POST /restore/:id           → restore that historical version

const updateSchema = z.object({
  // Hard upper bound — even the longest Recipe Book V2 is well under 50k.
  // 100k catches accidents (paste of huge file) without artificially blocking
  // legitimate growth.
  dnaMarkdown: z.string().min(1).max(100000),
  // voice_config is freeform JSON; the chunk-3 prompt builder reads specific
  // keys (anchor_price, branches, patterns) but tolerates extras.
  voiceConfig: z.record(z.unknown()),
  changeNote: z.string().max(500).nullable().optional(),
});

const HISTORY_DEFAULT_LIMIT = 20;
const HISTORY_MAX_LIMIT = 100;

interface BrandRow {
  id: string;
  dna_markdown: string | null;
  voice_config: Record<string, unknown> | null;
  updated_at: string;
}

interface HistoryRow {
  id: string;
  brand_id: string;
  edited_by: string | null;
  change_note: string | null;
  created_at: string;
  // Optional — only present on detail GET, not the list.
  dna_markdown?: string | null;
  voice_config?: Record<string, unknown> | null;
  // Joined (optional — only on list).
  app_users?: { display_name: string | null; email: string | null } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  // V1 single-tenant: resolve "the brand" once per request.
  const { data: brand, error: brandErr } = await db
    .from("brands")
    .select("id, dna_markdown, voice_config, updated_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (brandErr || !brand) {
    return jsonError("INTERNAL_ERROR", "Brand row missing.", 500);
  }
  const brandRow = brand as BrandRow;

  // Routing
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // pathParts[i] === "brand-dna" anchors us. Anything after is sub-routing.
  const baseIdx = pathParts.indexOf("brand-dna");
  const subA = pathParts[baseIdx + 1] ?? null; // "history" | "restore" | null
  const subB = pathParts[baseIdx + 2] ?? null; // history id, or restore id
  const isRoot = subA === null;
  const isHistoryList = subA === "history" && subB === null;
  const isHistoryDetail = subA === "history" && subB !== null;
  const isRestore = subA === "restore" && subB !== null;

  // ───── GET / → current DNA ─────
  if (req.method === "GET" && isRoot) {
    return jsonSuccess({
      brandId: brandRow.id,
      dnaMarkdown: brandRow.dna_markdown ?? "",
      voiceConfig: brandRow.voice_config ?? {},
      updatedAt: brandRow.updated_at,
    });
  }

  // ───── PATCH / → atomic update via RPC ─────
  if (req.method === "PATCH" && isRoot) {
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

    const { data: updated, error: rpcErr } = await db.rpc("update_brand_dna", {
      p_brand_id: brandRow.id,
      p_dna_markdown: parsed.data.dnaMarkdown,
      p_voice_config: parsed.data.voiceConfig,
      p_edited_by: auth.userId,
      p_change_note: parsed.data.changeNote ?? null,
    });
    if (rpcErr) return jsonError("INTERNAL_ERROR", rpcErr.message, 500);
    return jsonSuccess(toCamel(updated));
  }

  // ───── GET /history → metadata-only list ─────
  // Joins app_users for editor display name. Excludes dna_markdown +
  // voice_config to keep the response small (a year of edits could
  // easily run into MBs if every snapshot was inlined).
  if (req.method === "GET" && isHistoryList) {
    const limitRaw = Number(url.searchParams.get("limit") ?? HISTORY_DEFAULT_LIMIT);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(1, Math.floor(limitRaw)), HISTORY_MAX_LIMIT)
      : HISTORY_DEFAULT_LIMIT;

    const { data, error } = await db
      .from("brand_dna_history")
      .select(
        "id, brand_id, edited_by, change_note, created_at, app_users:edited_by(display_name, email)",
      )
      .eq("brand_id", brandRow.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);

    // Flatten the joined editor name so the frontend doesn't need to dig
    // through nested objects.
    const rows = (data as HistoryRow[]).map((r) => ({
      id: r.id,
      brandId: r.brand_id,
      editedBy: r.edited_by,
      editorName: r.app_users?.display_name ?? r.app_users?.email ?? null,
      changeNote: r.change_note,
      createdAt: r.created_at,
    }));
    return jsonSuccess(rows);
  }

  // ───── GET /history/:id → full content for one snapshot ─────
  if (req.method === "GET" && isHistoryDetail) {
    const { data, error } = await db
      .from("brand_dna_history")
      .select(
        "id, brand_id, edited_by, change_note, created_at, dna_markdown, voice_config, app_users:edited_by(display_name, email)",
      )
      .eq("id", subB)
      .single();
    if (error || !data) return jsonError("NOT_FOUND", "History entry not found.", 404);
    const row = data as HistoryRow;
    if (row.brand_id !== brandRow.id) {
      // Defensive: history belongs to a different brand. RLS allows reads in
      // V1, but we still hide cross-brand rows from the API surface.
      return jsonError("NOT_FOUND", "History entry not found.", 404);
    }
    return jsonSuccess({
      id: row.id,
      brandId: row.brand_id,
      editedBy: row.edited_by,
      editorName: row.app_users?.display_name ?? row.app_users?.email ?? null,
      changeNote: row.change_note,
      createdAt: row.created_at,
      dnaMarkdown: row.dna_markdown ?? "",
      voiceConfig: row.voice_config ?? {},
    });
  }

  // ───── POST /restore/:id → snapshot current → write historical → return new ─────
  // Same RPC as PATCH; just sources the inputs from a history row instead of
  // the request body. The historical row stays in history (we never mutate
  // it); the *current* row's old state gets a fresh history entry too.
  if (req.method === "POST" && isRestore) {
    const { data: histRow, error: histErr } = await db
      .from("brand_dna_history")
      .select("id, brand_id, dna_markdown, voice_config")
      .eq("id", subB)
      .single();
    if (histErr || !histRow) {
      return jsonError("NOT_FOUND", "History entry not found.", 404);
    }
    if (histRow.brand_id !== brandRow.id) {
      return jsonError("NOT_FOUND", "History entry not found.", 404);
    }

    const { data: updated, error: rpcErr } = await db.rpc("update_brand_dna", {
      p_brand_id: brandRow.id,
      p_dna_markdown: histRow.dna_markdown ?? "",
      p_voice_config: histRow.voice_config ?? {},
      p_edited_by: auth.userId,
      p_change_note: `Restored from history (entry ${subB})`,
    });
    if (rpcErr) return jsonError("INTERNAL_ERROR", rpcErr.message, 500);
    return jsonSuccess(toCamel(updated));
  }

  return jsonError("NOT_FOUND", "Route not found.", 404);
});
