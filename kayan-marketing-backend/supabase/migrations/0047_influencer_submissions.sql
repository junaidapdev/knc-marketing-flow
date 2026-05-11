-- Migration 0047: Influencer submissions and verification workflow.
--
-- Adds the creator submission path, links influencer_collab calendar entries
-- to the influencer database, and keeps creator submission writes atomic via
-- create_influencer_submission().

alter table calendar_entries
  add column if not exists influencer_id uuid references influencers(id) on delete set null;

create index if not exists idx_calendar_entries_influencer_id
  on calendar_entries(influencer_id);

create table if not exists influencer_submissions (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references influencers(id) on delete cascade,
  entry_id uuid not null references calendar_entries(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  tiktok_post_url text,
  instagram_post_url text,
  snapchat_post_url text,
  tagged_kayan boolean,
  used_promo_code boolean,
  notes text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'disputed')),
  verified_at timestamptz,
  verified_by uuid references app_users(id) on delete set null,
  dispute_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint influencer_submissions_at_least_one_post_url check (
    nullif(trim(coalesce(tiktok_post_url, '')), '') is not null or
    nullif(trim(coalesce(instagram_post_url, '')), '') is not null or
    nullif(trim(coalesce(snapchat_post_url, '')), '') is not null
  )
);

create index if not exists idx_influencer_submissions_entry_id
  on influencer_submissions(entry_id);

create index if not exists idx_influencer_submissions_influencer_id
  on influencer_submissions(influencer_id);

create index if not exists idx_influencer_submissions_verification_status
  on influencer_submissions(verification_status);

drop trigger if exists influencer_submissions_set_updated_at on influencer_submissions;
create trigger influencer_submissions_set_updated_at
  before update on influencer_submissions
  for each row execute function set_updated_at();

alter table influencer_submissions enable row level security;

drop policy if exists "influencer_submissions_authenticated_full_access" on influencer_submissions;
create policy "influencer_submissions_authenticated_full_access"
  on influencer_submissions for all to authenticated
  using (true) with check (true);

create table if not exists influencer_performance_logs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references influencer_submissions(id) on delete cascade,
  influencer_id uuid not null references influencers(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram', 'snapchat')),
  views integer,
  likes integer,
  comments integer,
  shares integer,
  reach integer,
  logged_at timestamptz not null default now(),
  notes text,
  constraint influencer_performance_logs_nonnegative check (
    (views is null or views >= 0) and
    (likes is null or likes >= 0) and
    (comments is null or comments >= 0) and
    (shares is null or shares >= 0) and
    (reach is null or reach >= 0)
  )
);

create index if not exists idx_influencer_performance_logs_submission_id
  on influencer_performance_logs(submission_id);

create index if not exists idx_influencer_performance_logs_influencer_id
  on influencer_performance_logs(influencer_id);

alter table influencer_performance_logs enable row level security;

drop policy if exists "influencer_performance_logs_authenticated_full_access" on influencer_performance_logs;
create policy "influencer_performance_logs_authenticated_full_access"
  on influencer_performance_logs for all to authenticated
  using (true) with check (true);

drop function if exists create_entry_with_tasks(
  uuid, uuid, uuid, text, text, text, date, text, numeric, text, text, jsonb, boolean,
  date, text, int, text, text, uuid
);

create or replace function create_entry_with_tasks(
  p_brand_id uuid,
  p_campaign_id uuid,
  p_branch_id uuid,
  p_influencer_id uuid,
  p_type text,
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
begin
  if p_type = 'influencer_collab' and p_influencer_id is null then
    raise exception 'Influencer is required for influencer collaboration entries.';
  end if;

  insert into calendar_entries (
    brand_id, campaign_id, branch_id, influencer_id, type, title, description,
    target_date, assignee, budget_allocated, budget_category, notes,
    shoot_date, production_mode, editor_days_offset,
    pattern_id, theme, source_topic_id
  ) values (
    p_brand_id, p_campaign_id, p_branch_id, p_influencer_id, p_type, p_title, p_description,
    p_target_date, p_assignee, coalesce(p_budget_allocated, 0), p_budget_category, p_notes,
    p_shoot_date, coalesce(p_production_mode, 'batch'), coalesce(p_editor_days_offset, 2),
    p_pattern_id, p_theme, p_source_topic_id
  )
  returning id into v_entry_id;

  select * into v_entry from calendar_entries where id = v_entry_id;

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

  return jsonb_build_object('entry', to_jsonb(v_entry), 'tasks', v_tasks);
exception
  when others then
    raise;
end;
$$;

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

  if v_entry.type <> 'influencer_collab' then
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

create or replace function update_influencer_submission_verification(
  p_submission_id uuid,
  p_verification_status text,
  p_dispute_reason text default null,
  p_verified_by uuid default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_submission influencer_submissions%rowtype;
  v_updated influencer_submissions%rowtype;
  v_influencer influencers%rowtype;
  v_entry calendar_entries%rowtype;
  v_task tasks%rowtype;
begin
  if p_verification_status not in ('verified', 'disputed') then
    raise exception 'Unsupported verification status.';
  end if;

  if p_verification_status = 'disputed' and nullif(trim(coalesce(p_dispute_reason, '')), '') is null then
    raise exception 'Dispute reason is required.';
  end if;

  select * into v_submission
    from influencer_submissions
   where id = p_submission_id;

  if not found then
    raise exception 'Submission not found.';
  end if;

  select * into v_influencer
    from influencers
   where id = v_submission.influencer_id;

  select * into v_entry
    from calendar_entries
   where id = v_submission.entry_id;

  if p_verification_status = 'verified' then
    update influencer_submissions
       set verification_status = 'verified',
           verified_at = now(),
           verified_by = p_verified_by,
           dispute_reason = null
     where id = p_submission_id
     returning * into v_updated;

    insert into tasks (entry_id, title, phase, assignee, due_date, status, is_standalone, notes)
    values (
      v_submission.entry_id,
      'Log performance for ' || v_influencer.display_name || ' submission',
      'track',
      'junaid',
      current_date + 5,
      'pending',
      false,
      'influencer_submission_id=' || v_submission.id::text
    )
    returning * into v_task;
  else
    update influencer_submissions
       set verification_status = 'disputed',
           verified_at = null,
           verified_by = null,
           dispute_reason = nullif(trim(coalesce(p_dispute_reason, '')), '')
     where id = p_submission_id
     returning * into v_updated;
  end if;

  return jsonb_build_object(
    'submission', to_jsonb(v_updated),
    'entry', to_jsonb(v_entry),
    'influencer', to_jsonb(v_influencer),
    'task', case when p_verification_status = 'verified' then to_jsonb(v_task) else null end
  );
exception
  when others then
    raise;
end;
$$;
