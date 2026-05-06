# Kayan Marketing Backend — Project Log

## Chunk 1: Scaffolding (DONE)
- Initialized repo with strict TS, Zod, Supabase client
- Standards established: env config, constants, errors, logger, API response shape
- `.gitignore` excludes scratch .md files and `.cursor/`

## Chunk 2: Database Schema (DONE)
- 13 migration files created (extensions → ai_messages)
- All tables have RLS enabled
- Seed data: Kayan brand + 12 branches + default monthly budget cap
- Constants: entry-types, task-chains, budget-categories
- Modular domain types: calendar-entry, task, campaign, performance, budget
- DB types generation script ready (`npm run db:types`)

## Chunk 3: Backend API Foundation (DONE)
- Validation schemas (Zod) for all main domains: calendar-entry, task, campaign, performance, budget
- `src/utils/validate.ts` — reusable Zod-to-ApiError adapter
- Edge Function shared utilities: `_shared/cors.ts`, `_shared/response.ts`, `_shared/auth.ts`
- Health check Edge Function (`/functions/v1/health`)
- Smoke calendar-entries endpoint (GET with from/to filters, POST with validation) — full task-chain comes Chunk 5

## Chunk 4: Frontend Auth + App Shell (DONE — see frontend repo)

## Chunk 5: Calendar Entries + Tasks CRUD (DONE)
- Migration 0014: `create_entry_with_tasks` Postgres function (atomic entry + task-chain insert)
- `_shared/case.ts`: snake_case → camelCase response transformer (clean API boundary)
- `calendar-entries` Edge Function: full CRUD (GET list with from/to, GET detail with tasks, POST via RPC, PATCH, DELETE 204)
- `tasks` Edge Function: full CRUD (GET list with from/to/assignee/status/entryId filters, POST, PATCH with completed_at stamp, DELETE)

## Chunk 6: Today Page (DONE)
- Migration 0015: `get_today_summary(p_brand_id, p_today)` Postgres function — single-roundtrip aggregation (today's tasks, overdue list+count, 3-day radar, current-month budget snapshot with top-3 categories)
- Edge Function `today-summary` — GET with `?brandId&today=`; calls RPC, transforms snake→camel via `_shared/case.ts`

## Chunk 7: Calendar Views (DONE — frontend-only)

## Chunk 8: Campaigns (DONE)
- Migration 0016: `create_campaign_with_artifacts` — atomic campaign + N branch rollouts (each optionally spawning a `shop_activity` calendar entry + 3-task chain) + N ad-spend lines, all in one transaction
- Edge Function `campaigns` — GET list (with `?status` filter), GET detail (joins `campaign_branch_rollouts` + `campaign_ad_spend`), POST via RPC, PATCH partial fields, DELETE 204
- Updated `calendar-entries` Edge Function: GET list now accepts `?campaignId` filter (powers Campaign → Linked Content tab)

## Chunk 9: Performance + Budget (DONE)
- Migration 0017: `get_budget_summary(brand_id, month)` — JSONB roll-up: cap (total + per-category), spent (combines `calendar_entries.budget_spent` and `campaign_ad_spend.spent` mapped via platform→category), and flat contributing rows
- Edge Function `performance-snapshots` — GET list (filters: brandId, from/to, platform), POST upsert by (brand_id, snapshot_date, platform) using table's unique constraint
- Edge Function `top-posts` — full CRUD with sort param (`post_date`/`plays`/`likes`/`engagement_rate`)
- Edge Function `budget-summary` — GET wrapping the SQL function
- Edge Function `budget-caps` — GET single (by brand+month), POST upsert by (brand_id, month)

## Chunk 10: AI Assistant (DONE)
- Edge Function `ai-assistant` — POST proxy: validates Zod request → loads brand voice config + brand DNA → ensures `ai_conversations` row exists → loads prior `ai_messages` → builds system prompt by template (7 templates: generate_script, suggest_hooks, caption_hashtags, content_gap_analysis, trend_brief, monthly_report, freeform) → calls OpenAI `/v1/chat/completions` (model from `OPENAI_MODEL`, default `gpt-5.5`) → persists user + assistant messages with `tokens_used` (prompt + completion)
- `OPENAI_API_KEY` only read via `Deno.env.get` in the Edge Function — never returned in any response, never reaches the client bundle. `OPENAI_MODEL` is an optional override (defaults to `gpt-5.5`)

## V1 COMPLETE
- 17 migrations (extensions → AI conversations → today summary → campaign artifacts → budget summary)
- 11 Edge Functions: `health`, `calendar-entries`, `tasks`, `today-summary`, `campaigns`, `performance-snapshots`, `top-posts`, `budget-summary`, `budget-caps`, `ai-assistant`
- All multi-write operations use Postgres functions for transactional integrity (`create_entry_with_tasks`, `create_campaign_with_artifacts`)
- All endpoints follow common API response shape via `_shared/response.ts`; snake→camel transform via `_shared/case.ts`

## Post-V1: Branch tracking for shop activities (DONE)
- Migration 0018: `calendar_entries.branch_id` (nullable FK → branches, on delete set null) + single-column and composite `(branch_id, target_date)` indexes; backfill copies branch_id from existing campaign_branch_rollouts onto auto-spawned shop_activity entries
- DROP + CREATE `create_entry_with_tasks` with new `p_branch_id` parameter (positioned right after `p_campaign_id`); calendar-entries Edge Function call updated
- `create_campaign_with_artifacts` now writes `branch_id` on the auto-spawned shop_activity entries (signature unchanged; rollout JSON already had `branchId`)
- `get_today_summary` left-joins `tasks → calendar_entries → branches` and embeds `branch: { id, name, city } | null` on each task in today/overdue/radar buckets — surfaces branch on Today page
- `calendar-entries` Edge Function: create schema requires `branchId` when `type === 'shop_activity'` (Zod superRefine, 422 with field-level error); update schema accepts `branchId` without the conditional rule; list GET accepts `?branchId=` filter; detail GET joins `branches` as nested `branch`
- New Edge Function `branches` (12th) — GET, returns active branches sorted by city then name; replaces the prior direct supabase-js query path

## Influencer Search — Chunk 1: Foundation (DONE)
- Migration 0039: four new tables with RLS — `creator_searches` (filters jsonb + status lifecycle), `creator_results` (per-creator row keyed to a search; `audience_demographics` jsonb + `is_estimated_demographics` flag; nullable `fit_score`/`fit_rationale` filled in Chunk 5), `saved_creators` (unique on `(brand_id, creator_result_id)` for idempotent saves), `creator_search_costs` (per-run audit of Apify + Claude spend)
- All four tables follow the V1 single-tenant `authenticated_full_access` RLS stance and cascade on brand/search delete
- Indexes: `creator_results(search_id)`, `saved_creators(brand_id, created_at desc)`, `creator_search_costs(search_id)`, `creator_searches(brand_id, created_at desc)`
- No Edge Functions or Apify integration yet — those start in Chunk 3

## Influencer Search — Chunk 3+4: TikTok + Instagram + YouTube via Apify (DONE)
- Combined Chunk 3 (TikTok) and Chunk 4 (Instagram + YouTube) into one commit since the partial Chunk 3 work (only `_shared/influencer-actors.ts` + `_shared/apify.ts` were written) was never committed before Chunk 4 started.
- Migration 0040: `failure_reasons text[]` on `creator_searches` for partial-failure UX (one platform errors but others succeed).
- New `_shared/apify.ts`: thin wrapper around `/v2/acts/{actor}/run-sync-get-dataset-items`. Token passed as argument (never logged), URL-form actor IDs translated from human `username/name` to Apify's `username~name`. Defensive 200-char truncation on upstream error bodies.
- New `_shared/influencer-actors.ts` pinning all three actor IDs:
  • TikTok → `clockworks/tiktok-scraper` (4.75★ / 276 reviews / 171K users / 11K MAU). Supports keyword search + `proxyCountryCode` covering every GCC country. Same actor performance-ingest already uses for known-profile scraping.
  • Instagram → `apify/instagram-scraper` (official Apify, 4.7★ / 398 reviews / 251K users / 99.9% success). `search` + `searchType: "user"` is the keyword discovery mode.
  • YouTube → `streamers/youtube-scraper` (4.7★ / 154 reviews / 75K users). YouTube on Apify has no native "search channels" actor — this video-search actor returns channel metadata on each video result; the normalizer dedupes by channelId so each creator appears once.
- New Edge Function `search-creators` (the 13th):
  • Per-platform module files: `tiktok.ts`, `instagram.ts`, `youtube.ts`. Each exports `buildInput(filters)` (actor-specific input shape) and `normalize(items, searchId)` (snake_case `creator_results` row inserts).
  • Shared `types.ts` with the `filtersSchema` Zod definition + inferred `CreatorSearchFilters` type. Mirror of the frontend's `CreatorSearchFilters` since Edge Functions can't import from `src/`.
  • Flow: validate body → resolve V1 single-tenant brand → insert `creator_searches` row in `running` status → fan out to selected platforms in parallel via `Promise.allSettled` → collect successes/failures → apply follower min/max thresholds (TikTok and Instagram actors don't natively support them) → dedupe by `(platform, handle)` → sort by `follower_count desc` → cap at 100 → bulk insert `creator_results` → update search row to `completed`/`failed` with `result_count` + `failure_reasons` → read back inserted rows for response.
  • If every platform fails: status `failed` and 500 response with `failureReasons` in details. If some succeed: status `completed`, results returned, `failureReasons` listed in the response body for the UI to surface.
- All env access via `Deno.env.get`. APIFY_API_TOKEN never returned in any response, never logged.

Limitations to revisit:
- TikTok and Instagram actors don't natively support follower min/max — applied client-side after the actors return, so we may filter away most of a small result set. Bumping `MAX_PROFILES_PER_ACTOR` (currently 40) is the lever if recall feels weak.
- YouTube discovery quality depends on video-search relevance scoring; channels with one viral matching video can rank above channels that genuinely match the keyword across their catalog. Acceptable for V1.

## Influencer Search — Chunk 5: Claude-scored creator ranking via Brand DNA (DONE)
- Migration 0041: `claude_prompt_tokens` + `claude_completion_tokens` integer columns on `creator_searches`. Chunk 6 will multiply these by Haiku per-token pricing for the cost audit.
- New `search-creators/score.ts`:
  • `loadBrandDna(db, brandId)` — reads `brands.dna_markdown`, mirrors the loader pattern from `ai-assistant/index.ts`.
  • `buildScoringSystemPrompt(brandDna, filters)` — fixed scoring rubric (audience alignment / category fit / authenticity / brand safety, 0-100 scale) + Brand DNA + filter context. Strict-JSON output rules baked in.
  • `buildScoringUserMessage(creators)` — compact JSON of the merged set (handle, platform, displayName, bio sliced to 200 chars, followers, engagement, language, country). Skips heavy raw payload to keep prompt tokens predictable.
  • `scoreCreators(...)` — calls Anthropic `/v1/messages` directly (model `claude-haiku-4-5-20251001`, version `2023-06-01`, max 6000 output tokens). Parses the response JSON array (regex pulls the first `[…]` if Claude added chatter), validates each item, clamps scores to 0-100 + truncates rationale to 140 chars. On parse failure: every creator gets score 0 + rationale "AI scoring failed".
- `search-creators/index.ts` orchestration (after merge → dedupe → cap):
  • If `ANTHROPIC_API_KEY` not configured → score 0 + rationale "AI scoring not configured", failure_reasons records the gap.
  • If Anthropic HTTP throws → catch + score 0 + rationale "AI scoring failed", failure_reasons records the error.
  • If parse fails → same "AI scoring failed" path, failure_reasons records "scoring: model returned unparseable JSON".
  • In-memory sort by `fit_score desc, engagement_rate desc, follower_count desc`.
  • Insert into creator_results with the scored fields populated.
  • Update creator_searches with `claude_prompt_tokens` + `claude_completion_tokens` from Anthropic's `usage.input_tokens` / `output_tokens`.
  • Read-back query mirrors the in-memory sort so the response order is consistent.
- `NormalizedCreator` type extended with optional `fit_score` + `fit_rationale` so the platform normalizers stay agnostic and only the score module writes them.
- All env access via `Deno.env.get`. ANTHROPIC_API_KEY never returned in any response or logged. Brand DNA never echoed back to the client.

## Influencer Search — Chunk 6: Cost preview + per-run cost audit (DONE)
- New `_shared/influencer-pricing.ts`: single source of truth for pricing — `APIFY_PER_RESULT_USD` (TikTok $0.0037, Instagram $0.0027, YouTube $0.004 — FREE-tier per-result rates from each actor's Apify Store page), `APIFY_ACTOR_START_USD` (TikTok $0.001 flat fee, others 0), `CLAUDE_HAIKU_PRICING` ($1/M input + $5/M output for Haiku 4.5). Plus `roundUsd` (cents, for API surface) + `roundUsd4` (4dp, matches `numeric(10,4)` storage).
- New Edge Function `estimate-creator-search` (the 14th):
  • Input: same Zod-validated filter shape as `search-creators` (imports the schema directly to avoid drift).
  • Output: `{ apifyCostUsd, claudeCostUsd, totalCostUsd, assumptions: string[] }`. Pure math — no Apify calls, no Anthropic calls, no DB writes.
  • Filter-breadth heuristic: tightness++ for each of (single category, single country, single non-"both" language). Tightness ≥3 → 20 results/platform; =2 → 30; =1 → 35; =0 → 40 (`MAX_PROFILES_PER_ACTOR`). YouTube doubled for raw-video count (channels dedupe later).
  • Claude tokens estimated at the result-cap (100): 2000 brand DNA + 600 rubric + 200 filters + 100 × 55 input creators ≈ 8300 input tokens, 100 × 45 ≈ 4500 output tokens. Tuned slightly pessimistic so the modal never under-promises.
  • Assumptions list documents the math + flags FREE-tier pricing so the user knows the estimate biases high.
- `search-creators/index.ts` now:
  • Tracks `rawItemCount` per-platform from the actor responses (Apify charges per dataset row, regardless of dedup/cap).
  • After scoring, computes the actual cost: `Σ raw × per-result + actor-start` for Apify, `(input × $1 + output × $5) / 1M` for Claude.
  • Inserts a `creator_search_costs` row with `apify_cost_usd`, `claude_cost_usd`, `total_cost_usd` (all rounded to 4dp).
  • Embeds the rounded-to-cents cost breakdown in the response body (`cost: { apifyCostUsd, claudeCostUsd, totalCostUsd }`) so the frontend doesn't need a second round trip to render the "this search cost $X.XX" footer.
- Apify run-sync-get-dataset-items doesn't return per-run charge metadata inline, but Apify's per-result pricing means `raw_count × unit_price` IS the billed amount — so no estimated-flag column is needed; the cost row carries actual billed totals.
