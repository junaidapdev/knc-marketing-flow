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
