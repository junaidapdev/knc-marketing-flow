-- Adds branch_id to calendar_entries so a shop_activity (or any future
-- branch-scoped entry) can be tagged to a specific Kayan branch. Nullable at
-- the DB layer; the application enforces "shop_activity requires branch"
-- via Zod, so other entry types continue to work unchanged.

alter table calendar_entries
  add column branch_id uuid references branches(id) on delete set null;

create index idx_calendar_entries_branch_id on calendar_entries(branch_id);
create index idx_calendar_entries_branch_target on calendar_entries(branch_id, target_date);

-- Backfill: any historical shop_activity entry that was auto-spawned from a
-- campaign rollout already has its branch on the rollout row. Copy it.
do $$
declare
  v_updated int;
begin
  with updated as (
    update calendar_entries ce
    set branch_id = cbr.branch_id
    from campaign_branch_rollouts cbr
    where cbr.calendar_entry_id = ce.id
      and ce.type = 'shop_activity'
      and ce.branch_id is null
    returning ce.id
  )
  select count(*) into v_updated from updated;
  raise notice 'backfilled branch_id on % shop_activity entries', v_updated;
end;
$$;

-- Drop and recreate create_entry_with_tasks with the new p_branch_id parameter.
-- Postgres requires a drop when the function signature changes.
drop function if exists create_entry_with_tasks(
  uuid, uuid, text, text, text, date, text, numeric, text, text, jsonb, boolean
);

create or replace function create_entry_with_tasks(
  p_brand_id uuid,
  p_campaign_id uuid,
  p_branch_id uuid,
  p_type text,
  p_title text,
  p_description text,
  p_target_date date,
  p_assignee text,
  p_budget_allocated numeric,
  p_budget_category text,
  p_notes text,
  p_task_chain jsonb,
  p_auto_create_tasks boolean
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
  insert into calendar_entries (
    brand_id, campaign_id, branch_id, type, title, description,
    target_date, assignee, budget_allocated, budget_category, notes
  ) values (
    p_brand_id, p_campaign_id, p_branch_id, p_type, p_title, p_description,
    p_target_date, p_assignee, coalesce(p_budget_allocated, 0), p_budget_category, p_notes
  )
  returning id into v_entry_id;

  select * into v_entry from calendar_entries where id = v_entry_id;

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

-- Update create_campaign_with_artifacts so the auto-spawned shop_activity
-- calendar entries also have their branch_id populated (the rollout JSON
-- already has branchId; we just weren't writing it through). Signature is
-- unchanged so CREATE OR REPLACE is sufficient.
create or replace function create_campaign_with_artifacts(
  p_brand_id uuid,
  p_name text,
  p_campaign_type text,
  p_status text,
  p_start_date date,
  p_end_date date,
  p_total_budget numeric,
  p_offer_trigger text,
  p_offer_reward text,
  p_promo_code text,
  p_custom_fields jsonb,
  p_notes text,
  p_branch_rollouts jsonb,
  p_ad_spend_lines jsonb,
  p_auto_create_entries boolean
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_campaign_id uuid;
  v_campaign record;
  v_rollout jsonb;
  v_ad_line jsonb;
  v_entry_id uuid;
  v_rollouts jsonb := '[]'::jsonb;
  v_ad_lines jsonb := '[]'::jsonb;
  v_inserted_rollout record;
  v_inserted_ad record;
begin
  insert into campaigns (
    brand_id, name, campaign_type, status, start_date, end_date,
    total_budget, offer_trigger, offer_reward, promo_code, custom_fields, notes
  ) values (
    p_brand_id, p_name, p_campaign_type, coalesce(p_status, 'planned'), p_start_date, p_end_date,
    coalesce(p_total_budget, 0), p_offer_trigger, p_offer_reward, p_promo_code,
    coalesce(p_custom_fields, '{}'::jsonb), p_notes
  )
  returning id into v_campaign_id;

  select * into v_campaign from campaigns where id = v_campaign_id;

  if p_branch_rollouts is not null then
    for v_rollout in select * from jsonb_array_elements(p_branch_rollouts) loop
      v_entry_id := null;

      if p_auto_create_entries then
        insert into calendar_entries (
          brand_id, campaign_id, branch_id, type, title, target_date, assignee
        ) values (
          p_brand_id,
          v_campaign_id,
          (v_rollout->>'branchId')::uuid,
          'shop_activity',
          p_name || ' — ' || (v_rollout->>'branchName'),
          (v_rollout->>'rolloutDate')::date,
          v_rollout->>'leadAssignee'
        )
        returning id into v_entry_id;

        insert into tasks (entry_id, title, phase, assignee, due_date, is_standalone)
        values
          (v_entry_id, 'Plan & brief staff', 'plan', v_rollout->>'leadAssignee',
            ((v_rollout->>'rolloutDate')::date - interval '3 days')::date, false),
          (v_entry_id, 'Setup branch', 'setup', v_rollout->>'leadAssignee',
            (v_rollout->>'rolloutDate')::date, false),
          (v_entry_id, 'Wrap & document', 'wrap', v_rollout->>'leadAssignee',
            ((v_rollout->>'rolloutDate')::date + interval '1 day')::date, false);
      end if;

      insert into campaign_branch_rollouts (
        campaign_id, branch_id, rollout_date, lead_assignee, calendar_entry_id, notes
      ) values (
        v_campaign_id,
        (v_rollout->>'branchId')::uuid,
        (v_rollout->>'rolloutDate')::date,
        v_rollout->>'leadAssignee',
        v_entry_id,
        v_rollout->>'notes'
      )
      returning * into v_inserted_rollout;

      v_rollouts := v_rollouts || to_jsonb(v_inserted_rollout);
    end loop;
  end if;

  if p_ad_spend_lines is not null then
    for v_ad_line in select * from jsonb_array_elements(p_ad_spend_lines) loop
      insert into campaign_ad_spend (
        campaign_id, platform, start_date, end_date, budget, objective
      ) values (
        v_campaign_id,
        v_ad_line->>'platform',
        (v_ad_line->>'startDate')::date,
        (v_ad_line->>'endDate')::date,
        (v_ad_line->>'budget')::numeric,
        v_ad_line->>'objective'
      )
      returning * into v_inserted_ad;

      v_ad_lines := v_ad_lines || to_jsonb(v_inserted_ad);
    end loop;
  end if;

  return jsonb_build_object(
    'campaign', to_jsonb(v_campaign),
    'rollouts', v_rollouts,
    'adSpend', v_ad_lines
  );
exception
  when others then
    raise;
end;
$$;

-- Update get_today_summary so each task in today/overdue/radar buckets carries
-- its branch info (if any), surfacing the location to assignees on Today.
create or replace function get_today_summary(p_brand_id uuid, p_today date)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_today_tasks jsonb;
  v_overdue_tasks jsonb;
  v_overdue_count integer;
  v_tomorrow_tasks jsonb;
  v_day_after_tasks jsonb;
  v_day_three_tasks jsonb;
  v_budget_cap numeric;
  v_category_caps jsonb;
  v_budget_spent numeric;
  v_top_categories jsonb;
  v_month_start date := date_trunc('month', p_today)::date;
  v_month_end date := (date_trunc('month', p_today) + interval '1 month - 1 day')::date;
begin
  -- Today's tasks (with branch info per task, if any)
  select coalesce(jsonb_agg(
    to_jsonb(t.*) || jsonb_build_object(
      'branch', case when b.id is not null
        then jsonb_build_object('id', b.id, 'name', b.name, 'city', b.city)
        else null end
    )
    order by t.due_date, t.created_at
  ), '[]'::jsonb)
  into v_today_tasks
  from tasks t
  left join calendar_entries ce on ce.id = t.entry_id
  left join branches b on b.id = ce.branch_id
  where t.due_date = p_today;

  -- Overdue tasks
  select
    count(*),
    coalesce(jsonb_agg(
      to_jsonb(t.*) || jsonb_build_object(
        'branch', case when b.id is not null
          then jsonb_build_object('id', b.id, 'name', b.name, 'city', b.city)
          else null end
      )
      order by t.due_date
    ), '[]'::jsonb)
  into v_overdue_count, v_overdue_tasks
  from tasks t
  left join calendar_entries ce on ce.id = t.entry_id
  left join branches b on b.id = ce.branch_id
  where t.due_date < p_today
    and t.status <> 'completed';

  -- Radar +1
  select coalesce(jsonb_agg(
    to_jsonb(t.*) || jsonb_build_object(
      'branch', case when b.id is not null
        then jsonb_build_object('id', b.id, 'name', b.name, 'city', b.city)
        else null end
    )
    order by t.created_at
  ), '[]'::jsonb)
  into v_tomorrow_tasks
  from tasks t
  left join calendar_entries ce on ce.id = t.entry_id
  left join branches b on b.id = ce.branch_id
  where t.due_date = p_today + 1;

  -- Radar +2
  select coalesce(jsonb_agg(
    to_jsonb(t.*) || jsonb_build_object(
      'branch', case when b.id is not null
        then jsonb_build_object('id', b.id, 'name', b.name, 'city', b.city)
        else null end
    )
    order by t.created_at
  ), '[]'::jsonb)
  into v_day_after_tasks
  from tasks t
  left join calendar_entries ce on ce.id = t.entry_id
  left join branches b on b.id = ce.branch_id
  where t.due_date = p_today + 2;

  -- Radar +3
  select coalesce(jsonb_agg(
    to_jsonb(t.*) || jsonb_build_object(
      'branch', case when b.id is not null
        then jsonb_build_object('id', b.id, 'name', b.name, 'city', b.city)
        else null end
    )
    order by t.created_at
  ), '[]'::jsonb)
  into v_day_three_tasks
  from tasks t
  left join calendar_entries ce on ce.id = t.entry_id
  left join branches b on b.id = ce.branch_id
  where t.due_date = p_today + 3;

  -- Budget cap
  select bc.total_cap, bc.category_caps
  into v_budget_cap, v_category_caps
  from budget_caps bc
  where bc.brand_id = p_brand_id and bc.month = v_month_start;

  v_budget_cap := coalesce(v_budget_cap, 0);
  v_category_caps := coalesce(v_category_caps, '{}'::jsonb);

  select coalesce(sum(ce.budget_spent), 0)
  into v_budget_spent
  from calendar_entries ce
  where ce.brand_id = p_brand_id
    and ce.target_date between v_month_start and v_month_end;

  with category_spend as (
    select
      ce.budget_category as category,
      sum(ce.budget_spent) as spent
    from calendar_entries ce
    where ce.brand_id = p_brand_id
      and ce.target_date between v_month_start and v_month_end
      and ce.budget_category is not null
    group by ce.budget_category
    order by sum(ce.budget_spent) desc
    limit 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'category', cs.category,
    'spent', cs.spent,
    'cap', coalesce((v_category_caps ->> cs.category)::numeric, 0)
  )), '[]'::jsonb)
  into v_top_categories
  from category_spend cs;

  return jsonb_build_object(
    'today', jsonb_build_object('date', p_today, 'tasks', v_today_tasks),
    'overdue', jsonb_build_object('count', v_overdue_count, 'tasks', v_overdue_tasks),
    'radar', jsonb_build_object(
      'tomorrow', v_tomorrow_tasks,
      'dayAfter', v_day_after_tasks,
      'dayThree', v_day_three_tasks
    ),
    'budget', jsonb_build_object(
      'monthCap', v_budget_cap,
      'monthSpent', v_budget_spent,
      'percentUsed', case when v_budget_cap > 0
        then round((v_budget_spent / v_budget_cap * 100)::numeric, 2)
        else 0 end,
      'topCategories', v_top_categories
    )
  );
end;
$$;
