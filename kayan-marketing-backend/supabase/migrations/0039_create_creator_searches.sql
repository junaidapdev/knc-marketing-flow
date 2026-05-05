-- Migration 0039: Influencer Search foundation tables.
--
-- Chunk 1 of the Influencer Search feature. Adds the four tables the search
-- module will write to: search runs, per-creator results, the team's saved
-- shortlist, and a per-run cost audit. No Edge Functions or scoring yet.
--
-- All tables follow the V1 single-tenant RLS stance ("authenticated full
-- access") used by every other table. Foreign keys cascade on delete so a
-- removed brand or search drops its dependents cleanly.
--
-- Idempotent: `create table if not exists` + `if not exists` for indexes.

-- ─────────────────────────────────────────────────────────────────────────
-- creator_searches: one row per search the user runs.
-- `filters` stores the exact filter payload the UI submitted, so the search
-- can be reproduced or shown back later. `status` tracks the run lifecycle.
create table if not exists creator_searches (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  created_by uuid references app_users(id) on delete set null,
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in (
    'pending', 'running', 'completed', 'failed'
  )),
  result_count integer not null default 0 check (result_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_creator_searches_brand_created_at
  on creator_searches(brand_id, created_at desc);

alter table creator_searches enable row level security;
drop policy if exists "creator_searches_authenticated_full_access" on creator_searches;
create policy "creator_searches_authenticated_full_access"
  on creator_searches for all to authenticated
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────
-- creator_results: one row per creator returned by a search.
-- `audience_demographics` is jsonb because the shape varies by platform and
-- by actor; surface its estimated nature in the UI via
-- is_estimated_demographics. `raw` keeps the original actor payload so
-- normalization changes can be revisited without re-scraping.
-- fit_score and fit_rationale are nullable here — Chunk 5 fills them after
-- Claude scoring lands.
create table if not exists creator_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references creator_searches(id) on delete cascade,
  platform text not null check (platform in (
    'tiktok', 'instagram', 'youtube'
  )),
  handle text not null,
  display_name text,
  avatar_url text,
  follower_count bigint not null default 0 check (follower_count >= 0),
  engagement_rate numeric(7, 4) check (engagement_rate is null or engagement_rate >= 0),
  language text check (language is null or language in (
    'arabic', 'english', 'both'
  )),
  country text,
  city text,
  audience_demographics jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  fit_score integer check (fit_score is null or (fit_score between 0 and 100)),
  fit_rationale text,
  is_estimated_demographics boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_creator_results_search_id
  on creator_results(search_id);

alter table creator_results enable row level security;
drop policy if exists "creator_results_authenticated_full_access" on creator_results;
create policy "creator_results_authenticated_full_access"
  on creator_results for all to authenticated
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────
-- saved_creators: the team's shortlist. One row per saved creator per brand.
-- The unique constraint on (brand_id, creator_result_id) lets the Save action
-- be idempotent on retry without duplicating rows.
create table if not exists saved_creators (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  creator_result_id uuid not null references creator_results(id) on delete cascade,
  saved_by uuid references app_users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (brand_id, creator_result_id)
);

create index if not exists idx_saved_creators_brand_id
  on saved_creators(brand_id, created_at desc);

alter table saved_creators enable row level security;
drop policy if exists "saved_creators_authenticated_full_access" on saved_creators;
create policy "saved_creators_authenticated_full_access"
  on saved_creators for all to authenticated
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────
-- creator_search_costs: per-run audit of what the search actually cost.
-- Apify and Claude billing are tracked separately so we can spot which side
-- of the pipeline drives spend. total_cost_usd is stored (not computed) so
-- historical rows stay accurate even if the calculation rule changes later.
create table if not exists creator_search_costs (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references creator_searches(id) on delete cascade,
  apify_cost_usd numeric(10, 4) not null default 0 check (apify_cost_usd >= 0),
  claude_cost_usd numeric(10, 4) not null default 0 check (claude_cost_usd >= 0),
  total_cost_usd numeric(10, 4) not null default 0 check (total_cost_usd >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_creator_search_costs_search_id
  on creator_search_costs(search_id);

alter table creator_search_costs enable row level security;
drop policy if exists "creator_search_costs_authenticated_full_access" on creator_search_costs;
create policy "creator_search_costs_authenticated_full_access"
  on creator_search_costs for all to authenticated
  using (true) with check (true);
