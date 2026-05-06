// Pre-search cost estimate for the Influencer Search feature.
// Pure math — no Apify, no Anthropic, no DB writes. Used to drive the
// "Estimate cost" modal so the user can preview the spend before
// triggering a paid run.
//
// The estimate intentionally biases high: we use FREE-tier Apify rates
// (worst case) and assume the result-cap (100 creators) for Claude tokens.
// Real costs on paid tiers will land below the estimate.

import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { MAX_PROFILES_PER_ACTOR } from "../_shared/influencer-actors.ts";
import {
  APIFY_PER_RESULT_USD,
  APIFY_ACTOR_START_USD,
  CLAUDE_HAIKU_PRICING,
  roundUsd,
} from "../_shared/influencer-pricing.ts";
import { filtersSchema, type CreatorSearchFilters, type Platform } from "../search-creators/types.ts";

const RESULT_CAP = 100;

// Token assumptions for the Chunk 5 scoring call at the result cap. Tuned
// to be slightly pessimistic so the estimate doesn't under-promise.
const ASSUMED_BRAND_DNA_TOKENS = 2000;
const ASSUMED_RUBRIC_TOKENS = 600;
const ASSUMED_FILTER_TOKENS = 200;
const ASSUMED_PER_CREATOR_INPUT_TOKENS = 55;
const ASSUMED_PER_CREATOR_OUTPUT_TOKENS = 45;

// Filter-breadth heuristic: tighter filters → fewer results returned per
// platform. Bracketed so the estimate is stable across small filter
// tweaks. Caps at MAX_PROFILES_PER_ACTOR (the per-actor budget).
function expectedResultsPerPlatform(filters: CreatorSearchFilters): number {
  let tightness = 0;
  if (filters.categories.length === 1) tightness += 1;
  if (filters.countries.length === 1) tightness += 1;
  if (filters.language && filters.language !== "both") tightness += 1;
  if (tightness >= 3) return Math.min(20, MAX_PROFILES_PER_ACTOR);
  if (tightness === 2) return Math.min(30, MAX_PROFILES_PER_ACTOR);
  if (tightness === 1) return Math.min(MAX_PROFILES_PER_ACTOR, 35);
  return MAX_PROFILES_PER_ACTOR;
}

// YouTube costs more per-result and the platform module pulls 2x raw
// videos before deduping into channels, so its expected raw-result count
// gets doubled relative to TikTok / Instagram.
function rawResultsForPlatform(
  platform: Platform,
  baseExpected: number,
): number {
  if (platform === "youtube") return Math.min(baseExpected * 2, MAX_PROFILES_PER_ACTOR * 2);
  return baseExpected;
}

interface EstimateResponse {
  apifyCostUsd: number;
  claudeCostUsd: number;
  totalCostUsd: number;
  assumptions: string[];
}

function buildEstimate(filters: CreatorSearchFilters): EstimateResponse {
  const baseExpected = expectedResultsPerPlatform(filters);
  let apifyCostUsd = 0;
  const assumptions: string[] = [];

  for (const platform of filters.platforms) {
    const raw = rawResultsForPlatform(platform, baseExpected);
    const perResult = APIFY_PER_RESULT_USD[platform];
    const start = APIFY_ACTOR_START_USD[platform];
    const platformCost = raw * perResult + start;
    apifyCostUsd += platformCost;
    assumptions.push(
      `${platform}: ~${raw} results × $${perResult.toFixed(4)}` +
        (start > 0 ? ` + $${start.toFixed(3)} actor start` : ""),
    );
  }

  // Cap the merged set at the result-cap before computing Claude tokens.
  const cappedCreators = Math.min(
    filters.platforms.length * baseExpected,
    RESULT_CAP,
  );

  const inputTokens =
    ASSUMED_BRAND_DNA_TOKENS +
    ASSUMED_RUBRIC_TOKENS +
    ASSUMED_FILTER_TOKENS +
    cappedCreators * ASSUMED_PER_CREATOR_INPUT_TOKENS;
  const outputTokens = cappedCreators * ASSUMED_PER_CREATOR_OUTPUT_TOKENS;

  const claudeCostUsd =
    (inputTokens * CLAUDE_HAIKU_PRICING.inputPerMillionUsd) / 1_000_000 +
    (outputTokens * CLAUDE_HAIKU_PRICING.outputPerMillionUsd) / 1_000_000;

  assumptions.push(
    `Claude Haiku scoring: ~${cappedCreators} creators (after cap) ≈ ${inputTokens} input + ${outputTokens} output tokens`,
  );
  assumptions.push(
    "Apify rates use the FREE-tier per-result price; paid tiers are cheaper",
  );

  return {
    apifyCostUsd: roundUsd(apifyCostUsd),
    claudeCostUsd: roundUsd(claudeCostUsd),
    totalCostUsd: roundUsd(apifyCostUsd + claudeCostUsd),
    assumptions,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  if (req.method !== "POST") {
    return jsonError("NOT_FOUND", "Method not supported.", 404);
  }

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

  return jsonSuccess(buildEstimate(parsedBody));
});
