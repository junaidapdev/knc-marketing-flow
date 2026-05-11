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

## Influencer Search — REMOVED
Built across Chunks 1–8 (commits `214b87b` through `4510ee4`) and removed
on 2026-05-06. Pulled because TikTok user search via Apify proved too
slow to fit inside Supabase's gateway IDLE_TIMEOUT (~150s) without an
async-polling refactor — even with `MAX_PROFILES_PER_ACTOR=10` and
`resultsPerPage=1`, the actor's session/proxy overhead burned the budget.
Migration 0042 drops the four feature tables; migrations 0039–0041 stay
in the repo for historical record. See git history if you ever want to
revive the implementation.

## Influencer Management Chunk 1: Internal Admin CRUD (DONE)
- Migration 0046 creates the `influencers` table for the manual internal creator database: profile/contact fields, TikTok/Instagram/Snapchat handles and follower counts, commercial terms, niche/language arrays, notes, status, future `portal_token`, timestamps, updated_at trigger, RLS, and the at-least-one-platform check constraint.
- Indexes: `idx_influencers_brand_id`, `idx_influencers_status`, unique `idx_influencers_portal_token`, and GIN `idx_influencers_niche_tags`.
- Constants added for influencer statuses, niche tags, and languages; `Influencer` domain type and Zod create/update schemas added with WhatsApp sanity validation and handle refinement.
- Edge Function `influencers`: `GET /influencers`, `GET /influencers/:id`, `POST /influencers`, `PATCH /influencers/:id`, and `DELETE /influencers/:id`. List supports `status`, `q`, and `niche` filters; create generates a portal token and activation timestamp server-side.

## Influencer Management Chunk 2: Creator Portal Read-Only (DONE)
- Added `_shared/portal-auth.ts` for unauthenticated token authorization. It reads `/portal/:token`, uses the token as the authorization secret, returns 401 for invalid/deactivated links, and applies a V1 in-memory per-IP rate limit of 10 requests/minute.
- Added `_shared/portal-types.ts` with `PortalInfluencerView`, intentionally excluding internal IDs, brand IDs, portal tokens, full names, notes, rates, and statuses from public responses.
- Added Edge Function `portal`: `GET /portal/:token` returns the safe creator profile view with display name, city, platform handles/URLs/follower counts, niche tags, and languages.
- Follow-up: replace the in-memory Edge Function rate limiter with a durable/shared limiter before production traffic or multi-region rollout.

## Influencer Management Chunk 3: Post Submission + Verification Queue (DONE)
- Migration 0047: `calendar_entries.influencer_id` FK; `influencer_submissions` (per-platform post URLs, tagged_kayan, used_promo_code, verification_status with check pending/verified/disputed, verified_at/by, dispute_reason); `influencer_performance_logs` (per-submission per-platform views/likes/comments/shares/reach). At-least-one-post-URL constraint, set_updated_at trigger, RLS authenticated_full_access on both.
- RPCs (security definer):
  • `create_entry_with_tasks` re-signed with `p_influencer_id` (raises when `influencer_collab` entries are missing it).
  • `create_influencer_submission(token, entry_id, urls, tagged_kayan, used_promo_code, notes)` — validates the entry belongs to an `influencer_collab` and to the same influencer the token resolves to; inserts the submission as `pending`; flips entry status `planned`/`in_progress` → `live`; auto-creates a `phase=review` task "Verify {name}'s submission for {entry title}" assigned to junaid, due today.
  • `update_influencer_submission_verification(submission_id, status, dispute_reason, verified_by)` — verifies or disputes; on verify, auto-creates a `phase=track` task "Log performance for {name} submission" assigned to junaid, due in 5 days; on dispute, requires a non-empty reason.
- New Edge Functions:
  • `portal/` extended with `GET /portal/:token/collaborations` (active influencer_collab entries linked to this influencer, joined with any existing submission) and `POST /portal/:token/submissions` (Zod validates URLs, requires at-least-one, enforces platform-handle match, calls the RPC).
  • `influencer-submissions/` admin endpoint — `GET /influencer-submissions` with filters status / influencerId / from / to (joined influencer, entry, **and now performance_logs** so the Influencer Detail page can aggregate client-side without N+1); `GET /:id`; `PATCH /:id` for verify/dispute.
  • `influencer-performance/` — list by submissionId, POST (derives influencer_id from the submission), PATCH, DELETE.
- Calendar entries Edge Function: `?influencerId=` list filter; create + update schemas require `influencerId` when `type === 'influencer_collab'`; positional RPC call updated for the new `p_influencer_id` slot.
- Operational follow-up: `supabase db push` to land 0047; `supabase functions deploy portal influencer-submissions influencer-performance calendar-entries`.

## Influencer Management Chunk 4: Reliability Score + Portal Management (DONE)
- Migration 0048: two security-definer RPCs.
  • `get_influencer_reliability(p_influencer_id)` returns a JSONB with `post_rate`, `tag_rate`, `on_time_rate` (each 0–100 integer or null when the denominator is 0), `total_collabs` (eligible — past target, not cancelled), `total_submissions`, `computed_at`. Post-rate is capped at 100 to absorb early-submission edge cases. On-time = `submitted_at::date <= target_date + 1 day`.
  • `rotate_influencer_token(p_influencer_id, p_user_id)` generates a fresh portal token, stamps `portal_activated_at = now()`, returns the new token. `p_user_id` is accepted now for the planned `influencer_token_rotations` audit table (V2 follow-up — currently unused but stable).
- `influencers` Edge Function: GET detail now merges `reliability` into the response. GET list accepts `?includeReliability=true` (opt-in to avoid the per-row RPC cost on the default load). New action routes:
  • `POST /influencers/:id/rotate-token` — calls the RPC, returns the influencer row plus the fresh portalToken so the UI can render the new URL + WhatsApp message in one shot.
  • `PATCH /influencers/:id/status` — narrow `{ status }` body, validates against the three-status enum, returns the updated row with reliability.
  • Existing PATCH / DELETE guarded by `!subAction` so the sub-action paths can't fall through.
- `portal` Edge Function: GET response now includes `reliability` — either the available shape with the three percentages + `totalCollabs`, or `{ available: false, reason: "complete_3_collabs", totalCollabs }` when below 3 collabs. Gating threshold mirrored in the frontend.
- `_shared/portal-auth.ts`: now reads `status` from the influencers row and returns the same opaque 401 when status is anything other than `active`. Paused or blacklisted creators are gated out without leaking *why*.

## V1 Influencer Management COMPLETE
- 3 migrations (0046 influencers, 0047 submissions + performance logs + first RPC re-sign, 0048 reliability + rotation).
- 4 Edge Functions (`influencers`, `portal`, `influencer-submissions`, `influencer-performance`).
- 5 RPCs (security definer): `create_entry_with_tasks` re-signed with `p_influencer_id`, `create_influencer_submission`, `update_influencer_submission_verification`, `rotate_influencer_token`, `get_influencer_reliability`.
- All endpoints follow the common ApiResponse shape; snake → camel via `_shared/case.ts`; portal routes gated by `_shared/portal-auth.ts` (token + active-status + per-IP rate limit). Operational follow-up tracked in the frontend log.

## Reports Module Chunk 1: Backend Summary API (DONE)
- Added report constants (`REPORT_GRANULARITY`, `PERFORMANCE_COVERAGE_THRESHOLD = 50`, `REPORT_CACHE_TTL_SECONDS = 300`, max 365-day range), `ReportSummary` domain types, and `reportSummaryQuerySchema` validation.
- Migration 0049 adds `get_report_summary(p_brand_id, p_from, p_to, p_campaign_id, p_branch_id)`, returning a JSONB summary for the period: content counts, activity counts, campaign overlap/top campaign, influencer submissions, and performance coverage/totals. Performance totals are null when coverage is below 50%.
- New authenticated Edge Function `reports`: `GET /reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&compareToPrevious=false&campaignId=&branchId=`. It validates the range, calls the RPC, optionally computes the previous-period comparison, and returns the standard ApiResponse shape.
- Added a V1 in-memory per-instance report cache with 300s TTL; response meta includes `cached` and `cacheTtlSeconds`.
- Maintenance fixes made while verifying Chunk 1: `src/validation/calendar-entry.ts` now derives update validation from the base object schema instead of calling `.partial()` on a `superRefine()` result, and `topics/use` now passes `p_influencer_id: null` to the re-signed `create_entry_with_tasks` RPC.
- Follow-ups: replace the in-memory reports cache with Redis-equivalent/shared durable cache before production traffic; add a server-side image rendering path for scheduled reports.
