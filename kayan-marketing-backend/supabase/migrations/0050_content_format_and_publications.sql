-- Migration 0050: Content format + per-platform publications.
--
-- Background
-- ----------
-- The original calendar_entries.type welded "what kind of content" together
-- with "which platform it goes to" (tiktok_video, instagram_reel,
-- instagram_story, snapchat_story). That forced one row per platform per
-- shoot, which is wrong: in practice Kayan films ONE video and posts it to
-- TikTok + Instagram + Snapchat, and the same goes for stories. Reports
-- showed "Instagram only has one video" because the data model required a
-- separate entry per platform, which Junaid was (correctly) not creating.
--
-- What changes
-- ------------
-- 1. `calendar_entries.format` replaces `calendar_entries.type`. Values are
--    platform-agnostic: video | story | shop_activity | influencer_collab |
--    offer | general.
--
-- 2. New `entry_publications` table holds per-platform publication state for
--    a single content piece: (entry_id, platform) → post_url + posted_at.
--    Status remains on the parent entry — "one status for the whole piece"
--    (decided 2026-05-14 with Junaid).
--
-- 3. `topics.format` replaces `topics.entry_type`. New `topics.default_platforms`
--    text[] holds the platforms a topic spawns into when "Use this" is clicked.
--
-- 4. `calendar_entries.post_url` is dropped — per-platform URLs live in
--    entry_publications. `calendar_entries.video_url` (master raw video) is
--    kept; it isn't per-platform.
--
-- 5. `create_entry_with_tasks` is re-signed to accept p_format + p_platforms.
--    The new sig also moves p_pattern_id / p_theme / p_source_topic_id to
--    explicit named params, replaces p_type with p_format, and inserts the
--    publication rows in the same transaction.
--
-- Migration sequence is additive-first (add new columns, backfill, then drop
-- old) so a partial apply leaves the DB consistent.

begin;

-- =========================================================
-- 1. New columns (nullable for backfill)
-- =========================================================

alter table calendar_entries
  add column if not exists format text;

alter table topics
  add column if not exists format text;

alter table topics
  add column if not exists default_platforms text[] not null default '{}'::text[];

-- =========================================================
-- 2. entry_publications table
-- =========================================================

create table if not exists entry_publications (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references calendar_entries(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram', 'snapchat')),
  -- post_url is the platform-specific public URL after publishing. Nullable
  -- until the entry actually goes live.
  post_url text,
  -- posted_at is set when the post lands on this specific platform. Used by
  -- reports to compute per-platform "posted on time" stats later if needed.
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One row per (entry, platform). Prevents accidental duplicate publications.
  unique (entry_id, platform)
);

create index if not exists idx_entry_publications_entry on entry_publications(entry_id);
create index if not exists idx_entry_publications_platform on entry_publications(platform);

drop trigger if exists entry_publications_set_updated_at on entry_publications;
create trigger entry_publications_set_updated_at
  before update on entry_publications
  for each row execute function set_updated_at();

alter table entry_publications enable row level security;

drop policy if exists "entry_publications_authenticated_full_access" on entry_publications;
create policy "entry_publications_authenticated_full_access"
  on entry_publications for all to authenticated
  using (true) with check (true);

-- =========================================================
-- 3. Backfill calendar_entries.format from existing type
-- =========================================================
-- Mapping:
--   tiktok_video    → video
--   instagram_reel  → video
--   instagram_story → story
--   snapchat_story  → story
--   shop_activity   → shop_activity     (no change)
--   influencer_collab → influencer_collab (no change)
--   offer           → offer             (no change)
--   general         → general           (no change)

update calendar_entries
set format = case type
  when 'tiktok_video' then 'video'
  when 'instagram_reel' then 'video'
  when 'instagram_story' then 'story'
  when 'snapchat_story' then 'story'
  else type
end
where format is null;

-- =========================================================
-- 4. Backfill entry_publications from existing rows
-- =========================================================
-- Each old platform-specific entry maps to one publication row. post_url
-- moves into the publication. Idempotent via the unique(entry_id, platform).

insert into entry_publications (entry_id, platform, post_url)
select
  ce.id,
  case ce.type
    when 'tiktok_video' then 'tiktok'
    when 'instagram_reel' then 'instagram'
    when 'instagram_story' then 'instagram'
    when 'snapchat_story' then 'snapchat'
  end,
  ce.post_url
from calendar_entries ce
where ce.type in ('tiktok_video', 'instagram_reel', 'instagram_story', 'snapchat_story')
on conflict (entry_id, platform) do nothing;

-- =========================================================
-- 5. Backfill topics.format + topics.default_platforms
-- =========================================================

update topics
set format = case entry_type
  when 'tiktok_video' then 'video'
  when 'instagram_reel' then 'video'
  when 'instagram_story' then 'story'
  when 'snapchat_story' then 'story'
  else entry_type
end
where format is null;

update topics
set default_platforms = case entry_type
  when 'tiktok_video' then array['tiktok']
  when 'instagram_reel' then array['instagram']
  when 'instagram_story' then array['instagram']
  when 'snapchat_story' then array['snapchat']
  else '{}'::text[]
end
where default_platforms = '{}'::text[];

-- =========================================================
-- 6. Lock new format columns + add CHECK constraints
-- =========================================================

alter table calendar_entries
  alter column format set not null;

alter table calendar_entries
  drop constraint if exists calendar_entries_format_check;
alter table calendar_entries
  add constraint calendar_entries_format_check
  check (format in (
    'video', 'story', 'shop_activity', 'influencer_collab', 'offer', 'general'
  ));

alter table topics
  alter column format set not null;

alter table topics
  drop constraint if exists topics_format_check;
alter table topics
  add constraint topics_format_check
  check (format in (
    'video', 'story', 'shop_activity', 'influencer_collab', 'offer', 'general'
  ));

-- default_platforms must be a subset of known platforms.
alter table topics
  drop constraint if exists topics_default_platforms_valid;
alter table topics
  add constraint topics_default_platforms_valid
  check (default_platforms <@ array['tiktok', 'instagram', 'snapchat']);

-- =========================================================
-- 7. Drop old columns + constraints
-- =========================================================
-- calendar_entries.type → goes away (replaced by format + publications)
-- calendar_entries.post_url → goes away (replaced by entry_publications.post_url)
-- topics.entry_type → goes away (replaced by format + default_platforms)

alter table calendar_entries
  drop constraint if exists calendar_entries_type_check;
alter table calendar_entries
  drop column if exists type;

alter table calendar_entries
  drop column if exists post_url;

alter table topics
  drop constraint if exists topics_entry_type_check;
alter table topics
  drop column if exists entry_type;

-- =========================================================
-- 8. Re-sign create_entry_with_tasks
-- =========================================================
-- The signature changes from p_type/text to p_format/p_platforms. Drop every
-- prior overload first (migrations 0014, 0025, 0032, 0047 each re-signed it).

drop function if exists create_entry_with_tasks(
  uuid, uuid, uuid, text, text, text, date, text, numeric, text, text, jsonb, boolean
);
drop function if exists create_entry_with_tasks(
  uuid, uuid, uuid, text, text, text, date, text, numeric, text, text, jsonb, boolean,
  date, text, int
);
drop function if exists create_entry_with_tasks(
  uuid, uuid, uuid, text, text, text, date, text, numeric, text, text, jsonb, boolean,
  date, text, int, text, text, uuid
);
drop function if exists create_entry_with_tasks(
  uuid, uuid, uuid, uuid, text, text, text, date, text, numeric, text, text, jsonb, boolean,
  date, text, int, text, text, uuid
);

create or replace function create_entry_with_tasks(
  p_brand_id uuid,
  p_campaign_id uuid,
  p_branch_id uuid,
  p_influencer_id uuid,
  p_format text,
  p_platforms text[],
  p_title text,
  p_description text,
  p_target_date date,
  p_assignee text,
  p_budget_allocated numeric,
  p_budget_category text,
  p_notes text,
  p_task_chain jsonb,
  p_auto_create_tasks boolean,
  p_shoot_date date default null,
  p_production_mode text default 'batch',
  p_editor_days_offset int default 2,
  p_pattern_id text default null,
  p_theme text default null,
  p_source_topic_id uuid default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_entry_id uuid;
  v_entry record;
  v_task jsonb;
  v_tasks jsonb := '[]'::jsonb;
  v_inserted_task record;
  v_publications jsonb := '[]'::jsonb;
  v_platform text;
  v_pub record;
  v_platform_count int;
begin
  -- Validate: influencer_collab requires an influencer.
  if p_format = 'influencer_collab' and p_influencer_id is null then
    raise exception 'Influencer is required for influencer collaboration entries.';
  end if;

  v_platform_count := coalesce(array_length(p_platforms, 1), 0);

  -- Validate: video / story must declare at least one platform.
  if p_format in ('video', 'story') and v_platform_count = 0 then
    raise exception 'Content entries (% format) must have at least one platform.', p_format;
  end if;

  -- Validate: non-content formats must NOT carry platforms.
  if p_format not in ('video', 'story') and v_platform_count > 0 then
    raise exception 'Non-content entries (% format) must not have platforms.', p_format;
  end if;

  -- Validate platform values up front so the insert can't half-succeed.
  if v_platform_count > 0 then
    foreach v_platform in array p_platforms loop
      if v_platform not in ('tiktok', 'instagram', 'snapchat') then
        raise exception 'Unknown platform: %', v_platform;
      end if;
    end loop;
  end if;

  insert into calendar_entries (
    brand_id, campaign_id, branch_id, influencer_id, format,
    title, description, target_date, assignee,
    budget_allocated, budget_category, notes,
    shoot_date, production_mode, editor_days_offset,
    pattern_id, theme, source_topic_id
  ) values (
    p_brand_id, p_campaign_id, p_branch_id, p_influencer_id, p_format,
    p_title, p_description, p_target_date, p_assignee,
    coalesce(p_budget_allocated, 0), p_budget_category, p_notes,
    p_shoot_date, coalesce(p_production_mode, 'batch'), coalesce(p_editor_days_offset, 2),
    p_pattern_id, p_theme, p_source_topic_id
  )
  returning id into v_entry_id;

  select * into v_entry from calendar_entries where id = v_entry_id;

  -- Insert one publication row per platform (only for video / story formats).
  if v_platform_count > 0 then
    foreach v_platform in array p_platforms loop
      insert into entry_publications (entry_id, platform)
      values (v_entry_id, v_platform)
      returning * into v_pub;
      v_publications := v_publications || to_jsonb(v_pub);
    end loop;
  end if;

  -- Mark originating topic as used (same transaction → entry + topic stay
  -- consistent). Carried over from migration 0032 behavior.
  if p_source_topic_id is not null then
    update topics
       set status = 'used',
           used_at = now(),
           used_for_entry_id = v_entry_id
     where id = p_source_topic_id;
  end if;

  if p_auto_create_tasks and p_task_chain is not null and jsonb_array_length(p_task_chain) > 0 then
    for v_task in select * from jsonb_array_elements(p_task_chain) loop
      insert into tasks (entry_id, title, phase, assignee, due_date, is_standalone)
      values (
        v_entry_id,
        v_task->>'title',
        v_task->>'phase',
        v_task->>'assignee',
        (v_task->>'dueDate')::date,
        false
      )
      returning * into v_inserted_task;

      v_tasks := v_tasks || to_jsonb(v_inserted_task);
    end loop;
  end if;

  return jsonb_build_object(
    'entry', to_jsonb(v_entry),
    'tasks', v_tasks,
    'publications', v_publications
  );
exception
  when others then
    raise;
end;
$$;

-- =========================================================
-- 9. Update create_influencer_submission to reference format
-- =========================================================
-- The old function checked v_entry.type = 'influencer_collab'. Since type is
-- gone, swap to format.

create or replace function create_influencer_submission(
  p_token text,
  p_entry_id uuid,
  p_tiktok_post_url text default null,
  p_instagram_post_url text default null,
  p_snapchat_post_url text default null,
  p_tagged_kayan boolean default null,
  p_used_promo_code boolean default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_influencer influencers%rowtype;
  v_entry calendar_entries%rowtype;
  v_submission influencer_submissions%rowtype;
  v_task tasks%rowtype;
begin
  select * into v_influencer
    from influencers
   where portal_token = p_token
     and portal_activated_at is not null;

  if not found then
    raise exception 'Invalid portal token.';
  end if;

  select * into v_entry
    from calendar_entries
   where id = p_entry_id;

  if not found then
    raise exception 'Collaboration not found.';
  end if;

  if v_entry.format <> 'influencer_collab' then
    raise exception 'Entry is not an influencer collaboration.';
  end if;

  if v_entry.influencer_id is distinct from v_influencer.id then
    raise exception 'Collaboration does not belong to this influencer.';
  end if;

  insert into influencer_submissions (
    influencer_id,
    entry_id,
    tiktok_post_url,
    instagram_post_url,
    snapchat_post_url,
    tagged_kayan,
    used_promo_code,
    notes,
    verification_status
  ) values (
    v_influencer.id,
    v_entry.id,
    nullif(trim(coalesce(p_tiktok_post_url, '')), ''),
    nullif(trim(coalesce(p_instagram_post_url, '')), ''),
    nullif(trim(coalesce(p_snapchat_post_url, '')), ''),
    p_tagged_kayan,
    p_used_promo_code,
    nullif(trim(coalesce(p_notes, '')), ''),
    'pending'
  )
  returning * into v_submission;

  update calendar_entries
     set status = 'live'
   where id = v_entry.id
     and status in ('planned', 'in_progress');

  insert into tasks (entry_id, title, phase, assignee, due_date, status, is_standalone)
  values (
    v_entry.id,
    'Verify ' || v_influencer.display_name || '''s submission for ' || v_entry.title,
    'review',
    'junaid',
    current_date,
    'pending',
    false
  )
  returning * into v_task;

  return jsonb_build_object(
    'submission', to_jsonb(v_submission),
    'entry_id', v_entry.id,
    'task', to_jsonb(v_task)
  );
exception
  when others then
    raise;
end;
$$;

-- Schema cache reload so PostgREST sees the new function signatures
-- immediately rather than after the next pgrst restart.
notify pgrst, 'reload schema';

commit;
