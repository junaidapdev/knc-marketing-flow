-- Production rhythm: batch shoot model.
--
-- Kayan's real workflow is "two shoot days per week, 3-4 entries each, hand
-- off to an external editor, then schedule to platforms with a 3-day buffer
-- before the live date." Until now the platform modeled production as
-- per-entry timelines anchored on each entry's target_date — which forced
-- the team to mentally translate every entry into "but really it's part of
-- Tuesday's batch." This migration makes the shoot day a first-class
-- production anchor.
--
-- Schema additions:
--   - calendar_entries.shoot_date             — the shoot day this entry is
--                                               scheduled on (null for ad-hoc)
--   - calendar_entries.production_mode        — 'batch' | 'adhoc'
--                                               batch entries require shoot_date
--                                               and use a chain anchored on it
--                                               adhoc entries skip shoot_date
--                                               and use the legacy per-entry
--                                               chain anchored on target_date
--   - calendar_entries.editor_days_offset     — how many days the editor needs
--                                               (varies by editor; default 2)
--   - brands.default_shoot_capacity           — soft warning threshold (4)
--   - brands.default_editor_offset            — default editor turnaround (2)
--   - brands.default_scheduling_buffer        — days before live date that
--                                               content must be queued in the
--                                               platform scheduler (3)

alter table calendar_entries
  add column if not exists shoot_date date,
  add column if not exists production_mode text not null default 'batch',
  add column if not exists editor_days_offset int not null default 2;

-- Constrain production_mode. Kept as a check rather than an enum so adding
-- new modes later (live/series/etc.) doesn't require a CREATE TYPE migration.
alter table calendar_entries
  drop constraint if exists calendar_entries_production_mode_check;
alter table calendar_entries
  add constraint calendar_entries_production_mode_check
  check (production_mode in ('batch', 'adhoc'));

create index if not exists idx_calendar_entries_shoot_date
  on calendar_entries(shoot_date)
  where shoot_date is not null;

alter table brands
  add column if not exists default_shoot_capacity int not null default 4,
  add column if not exists default_editor_offset int not null default 2,
  add column if not exists default_scheduling_buffer int not null default 3;

-- Recreate create_entry_with_tasks with the three new params. Postgres
-- requires a drop when the signature changes, so we drop the previous
-- 13-arg version first.

drop function if exists create_entry_with_tasks(
  uuid, uuid, uuid, text, text, text, date, text, numeric, text, text, jsonb, boolean
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
  p_auto_create_tasks boolean,
  p_shoot_date date default null,
  p_production_mode text default 'batch',
  p_editor_days_offset int default 2
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
    target_date, assignee, budget_allocated, budget_category, notes,
    shoot_date, production_mode, editor_days_offset
  ) values (
    p_brand_id, p_campaign_id, p_branch_id, p_type, p_title, p_description,
    p_target_date, p_assignee, coalesce(p_budget_allocated, 0), p_budget_category, p_notes,
    p_shoot_date, coalesce(p_production_mode, 'batch'), coalesce(p_editor_days_offset, 2)
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
