import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";
import { runActorSync } from "../_shared/apify.ts";
import { INFLUENCER_ACTORS } from "../_shared/influencer-actors.ts";
import {
  APIFY_PER_RESULT_USD,
  APIFY_ACTOR_START_USD,
  CLAUDE_HAIKU_PRICING,
  roundUsd,
  roundUsd4,
} from "../_shared/influencer-pricing.ts";
import {
  filtersSchema,
  type CreatorSearchFilters,
  type NormalizedCreator,
  type Platform,
  type PlatformHandler,
} from "./types.ts";
import * as tiktok from "./tiktok.ts";
import * as instagram from "./instagram.ts";
import * as youtube from "./youtube.ts";
import { loadBrandDna, scoreCreators, type ScoringOutcome } from "./score.ts";

const RESULT_CAP = 100;

interface PlatformOutcome {
  platform: Platform;
  creators: NormalizedCreator[];
  // Raw item count returned by the actor before normalization/dedup. Used
  // for cost accounting — Apify charges per dataset row, not per creator
  // we end up keeping after the in-memory dedupe pass.
  rawItemCount: number;
}

interface FailureRecord {
  platform: Platform;
  message: string;
}

// Per-platform dispatch table. Adding a new platform = a new entry here +
// a new module file.
const PLATFORM_HANDLERS: Record<Platform, PlatformHandler> = {
  tiktok: {
    buildInput: tiktok.buildInput,
    normalize: tiktok.normalize,
    actorId: INFLUENCER_ACTORS.tiktok,
  },
  instagram: {
    buildInput: instagram.buildInput,
    normalize: instagram.normalize,
    actorId: INFLUENCER_ACTORS.instagram,
  },
  youtube: {
    buildInput: youtube.buildInput,
    normalize: youtube.normalize,
    actorId: INFLUENCER_ACTORS.youtube,
  },
};

async function runPlatform(
  platform: Platform,
  filters: CreatorSearchFilters,
  searchId: string,
  apifyToken: string,
): Promise<PlatformOutcome> {
  const handler = PLATFORM_HANDLERS[platform];
  if (!handler.actorId) {
    throw new Error(`No actor configured for ${platform}.`);
  }
  const input = handler.buildInput(filters);
  const items = await runActorSync<unknown>(handler.actorId, apifyToken, input);
  return {
    platform,
    creators: handler.normalize(items, searchId),
    rawItemCount: Array.isArray(items) ? items.length : 0,
  };
}

function applyFollowerThresholds(
  creators: NormalizedCreator[],
  filters: CreatorSearchFilters,
): NormalizedCreator[] {
  const min = filters.followerMin ?? 0;
  const max = filters.followerMax ?? Number.POSITIVE_INFINITY;
  return creators.filter(
    (c) => c.follower_count >= min && c.follower_count <= max,
  );
}

// Dedupe within the merged result set so the same creator never shows up
// twice for the same platform. (Cross-platform duplicates are intentionally
// kept — a creator with both a TikTok and an Instagram presence is a
// genuinely different opportunity per platform.)
function dedupeByPlatformHandle(
  creators: NormalizedCreator[],
): NormalizedCreator[] {
  const seen = new Map<string, NormalizedCreator>();
  for (const c of creators) {
    const key = `${c.platform}|${c.handle.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return Array.from(seen.values());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  if (req.method !== "POST") {
    return jsonError("NOT_FOUND", "Method not supported.", 404);
  }

  const apifyToken = Deno.env.get("APIFY_API_TOKEN") ?? "";
  if (!apifyToken) {
    return jsonError("INTERNAL_ERROR", "APIFY_API_TOKEN not configured.", 500);
  }

  // Parse + Zod-validate body
  let parsedBody: CreatorSearchFilters;
  try {
    const body = await req.json();
    const result = filtersSchema.safeParse(body);
    if (!result.success) {
      return jsonError("VALIDATION_FAILED", "Invalid filters.", 422, {
        fieldErrors: result.error.flatten().fieldErrors,
      });
    }
    parsedBody = result.data;
  } catch {
    return jsonError("VALIDATION_FAILED", "Invalid JSON body.", 422);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  // V1 single-tenant: first brand by created_at. Mirrors performance-ingest.
  const { data: brand, error: brandErr } = await db
    .from("brands")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (brandErr || !brand) {
    return jsonError("INTERNAL_ERROR", brandErr?.message ?? "Brand not found.", 500);
  }
  const brandId = brand.id as string;

  // Insert the search row up front in 'running' status so partial-failure
  // and full-failure paths both leave a queryable audit trail.
  const { data: searchRow, error: insertSearchErr } = await db
    .from("creator_searches")
    .insert({
      brand_id: brandId,
      created_by: auth.userId,
      filters: parsedBody,
      status: "running",
    })
    .select("id")
    .single();
  if (insertSearchErr || !searchRow) {
    return jsonError(
      "INTERNAL_ERROR",
      insertSearchErr?.message ?? "Failed to create search row.",
      500,
    );
  }
  const searchId = searchRow.id as string;

  // Fan out to selected platforms in parallel. Promise.allSettled so one
  // platform's failure doesn't cancel the others.
  const platforms = parsedBody.platforms;
  const settled = await Promise.allSettled(
    platforms.map((p) => runPlatform(p, parsedBody, searchId, apifyToken)),
  );

  const successes: NormalizedCreator[] = [];
  const failures: FailureRecord[] = [];
  // Per-platform raw counts feed the Apify cost calculation below. We
  // initialize every selected platform to 0 so a failed-platform row
  // contributes the actor-start fee but no per-result charge.
  const rawCountsByPlatform: Record<Platform, number> = {
    tiktok: 0,
    instagram: 0,
    youtube: 0,
  };
  const ranPlatforms = new Set<Platform>();
  settled.forEach((result, idx) => {
    const platform = platforms[idx]!;
    ranPlatforms.add(platform);
    if (result.status === "fulfilled") {
      successes.push(...result.value.creators);
      rawCountsByPlatform[platform] = result.value.rawItemCount;
    } else {
      const message =
        result.reason instanceof Error ? result.reason.message : "Unknown error";
      failures.push({ platform, message: message.slice(0, 200) });
    }
  });

  // Apply follower thresholds → dedupe → sort by follower_count desc → cap.
  // Cap before scoring so the Claude call never exceeds the documented
  // 100-creator budget.
  const filtered = applyFollowerThresholds(successes, parsedBody);
  const deduped = dedupeByPlatformHandle(filtered);
  deduped.sort((a, b) => b.follower_count - a.follower_count);
  const capped = deduped.slice(0, RESULT_CAP);

  // Chunk 5: Claude-based fit scoring. The scoring module handles its own
  // failure modes (HTTP error throws; JSON parse error → all 0s with
  // rationale "AI scoring failed"). HTTP failures we treat the same way
  // here so a transient Anthropic outage never tanks the whole search.
  const failureReasons = failures.map((f) => `${f.platform}: ${f.message}`);
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  let scoring: ScoringOutcome;
  if (capped.length === 0) {
    scoring = {
      scored: [],
      promptTokens: 0,
      completionTokens: 0,
      parseFailed: false,
    };
  } else if (!anthropicKey) {
    scoring = {
      scored: capped.map((c) => ({
        ...c,
        fit_score: 0,
        fit_rationale: "AI scoring not configured",
      })),
      promptTokens: 0,
      completionTokens: 0,
      parseFailed: false,
    };
    failureReasons.push("scoring: ANTHROPIC_API_KEY not configured");
  } else {
    const brandDna = await loadBrandDna(db, brandId);
    try {
      scoring = await scoreCreators(
        capped,
        parsedBody,
        brandDna,
        anthropicKey,
      );
      if (scoring.parseFailed) {
        failureReasons.push("scoring: model returned unparseable JSON");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      failureReasons.push(`scoring: ${msg.slice(0, 200)}`);
      scoring = {
        scored: capped.map((c) => ({
          ...c,
          fit_score: 0,
          fit_rationale: "AI scoring failed",
        })),
        promptTokens: 0,
        completionTokens: 0,
        parseFailed: true,
      };
    }
  }

  // Sort by fit_score desc, ties broken by engagement_rate desc, then
  // follower_count desc. This is the order returned to the frontend; the
  // read-back query below mirrors it so the response is consistent.
  scoring.scored.sort((a, b) => {
    const sDiff = (b.fit_score ?? 0) - (a.fit_score ?? 0);
    if (sDiff !== 0) return sDiff;
    const eDiff = (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0);
    if (eDiff !== 0) return eDiff;
    return b.follower_count - a.follower_count;
  });

  if (scoring.scored.length > 0) {
    const { error: insertResultsErr } = await db
      .from("creator_results")
      .insert(scoring.scored);
    if (insertResultsErr) {
      await db
        .from("creator_searches")
        .update({
          status: "failed",
          failure_reasons: [`db_insert: ${insertResultsErr.message}`],
        })
        .eq("id", searchId);
      return jsonError("INTERNAL_ERROR", "Failed to persist results.", 500);
    }
  }

  const allPlatformsFailed = failures.length === platforms.length;
  const finalStatus = allPlatformsFailed ? "failed" : "completed";

  await db
    .from("creator_searches")
    .update({
      status: finalStatus,
      result_count: scoring.scored.length,
      failure_reasons: failureReasons,
      claude_prompt_tokens: scoring.promptTokens,
      claude_completion_tokens: scoring.completionTokens,
    })
    .eq("id", searchId);

  if (allPlatformsFailed) {
    return jsonError(
      "INTERNAL_ERROR",
      "All platforms failed to fetch creators.",
      500,
      { failureReasons },
    );
  }

  // Compute the run cost from actual Apify result counts + Claude token
  // usage, then persist a creator_search_costs row. Apify per-result
  // pricing means raw_count × unit_price is the exact billed amount;
  // Claude likewise charges per token returned by the API.
  let apifyCostUsd = 0;
  for (const p of ranPlatforms) {
    const raw = rawCountsByPlatform[p];
    apifyCostUsd += raw * APIFY_PER_RESULT_USD[p];
    if (raw > 0) apifyCostUsd += APIFY_ACTOR_START_USD[p];
  }
  const claudeCostUsd =
    (scoring.promptTokens * CLAUDE_HAIKU_PRICING.inputPerMillionUsd) /
      1_000_000 +
    (scoring.completionTokens * CLAUDE_HAIKU_PRICING.outputPerMillionUsd) /
      1_000_000;
  const totalCostUsd = apifyCostUsd + claudeCostUsd;

  await db.from("creator_search_costs").insert({
    search_id: searchId,
    apify_cost_usd: roundUsd4(apifyCostUsd),
    claude_cost_usd: roundUsd4(claudeCostUsd),
    total_cost_usd: roundUsd4(totalCostUsd),
  });

  // Read back inserted rows so the response carries server-generated ids
  // and created_at. Multi-key order mirrors the in-memory sort so callers
  // see the same ranking the scoring pass produced.
  const { data: insertedRows, error: readErr } = await db
    .from("creator_results")
    .select("*")
    .eq("search_id", searchId)
    .order("fit_score", { ascending: false, nullsFirst: false })
    .order("engagement_rate", { ascending: false, nullsFirst: false })
    .order("follower_count", { ascending: false });
  if (readErr) {
    return jsonError("INTERNAL_ERROR", readErr.message, 500);
  }

  return jsonSuccess({
    searchId,
    results: toCamel(insertedRows ?? []),
    failureReasons,
    cost: {
      apifyCostUsd: roundUsd(apifyCostUsd),
      claudeCostUsd: roundUsd(claudeCostUsd),
      totalCostUsd: roundUsd(totalCostUsd),
    },
  });
});
