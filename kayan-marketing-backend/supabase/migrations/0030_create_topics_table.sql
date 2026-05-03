-- Migration 0030: Create the `topics` table — the queue of pre-planned
-- content ideas that solves the blank-title problem.
--
-- Workflow: Junaid (or AI suggestions) drop ideas into the queue. When it's
-- time to schedule, the marketer "uses" a topic — that creates a calendar
-- entry pre-filled with the topic's pattern, theme, branch, and notes, and
-- marks the topic row as `used`. See migration 0032 for the RPC change that
-- ties topic → entry atomically.
--
-- entry_type uses the same allowed values as calendar_entries.type so a topic
-- can declare "this idea is for an Instagram Reel" (etc). Kept as a CHECK
-- rather than an enum so adding a new entry type means one alter, not two.
--
-- Idempotent: `create table if not exists` + `if not exists` indexes/policies.

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  title text not null check (length(title) >= 3),
  description text,
  pattern_id text,
  branch_id uuid references branches(id) on delete set null,
  theme text,
  occasion text,
  entry_type text not null check (entry_type in (
    'tiktok_video', 'instagram_reel', 'instagram_story',
    'snapchat_story', 'shop_activity', 'influencer_collab',
    'offer', 'general'
  )),
  status text not null default 'queued' check (status in (
    'queued', 'in_progress', 'used', 'archived'
  )),
  priority int not null default 0,
  created_by uuid references app_users(id) on delete set null,
  used_at timestamptz,
  used_for_entry_id uuid references calendar_entries(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Queue view ("show me everything still queued for this brand, highest
-- priority first") — composite index covers the common WHERE + ORDER BY.
create index if not exists idx_topics_brand_status
  on topics(brand_id, status, priority desc, created_at desc);

-- Per-brand traceability: "what entries came from this topic?" supported by
-- used_for_entry_id; the inverse "what topic produced this entry?" lives on
-- calendar_entries.source_topic_id (added in migration 0031).
create index if not exists idx_topics_used_for_entry_id
  on topics(used_for_entry_id)
  where used_for_entry_id is not null;

-- updated_at trigger — mirrors every other table's pattern.
drop trigger if exists topics_set_updated_at on topics;
create trigger topics_set_updated_at before update on topics
  for each row execute function set_updated_at();

-- RLS: same single-tenant V1 stance as every other table.
alter table topics enable row level security;
drop policy if exists "topics_authenticated_full_access" on topics;
create policy "topics_authenticated_full_access" on topics
  for all to authenticated using (true) with check (true);
