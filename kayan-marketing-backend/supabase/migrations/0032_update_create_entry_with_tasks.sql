-- Migration 0032: Extend create_entry_with_tasks to accept pattern, theme,
-- and source_topic_id, and to atomically mark the source topic as `used`
-- when one is supplied.
--
-- Postgres requires DROP when a function signature changes (parameter list
-- defines the function identity). Existing edge function callers don't pass
-- the three new params — defaults of NULL keep them working unchanged.
--
-- New behavior:
--   * pattern_id, theme written to calendar_entries (added by migration 0029).
--   * source_topic_id written to calendar_entries (added by migration 0031).
--   * If source_topic_id is provided, the matching topics row is updated in
--     the same transaction:
--       - status      → 'used'
--       - used_at     → now()
--       - used_for_entry_id → the new entry's id
--     The update is best-effort: a missing topic id silently no-ops (the
--     UPDATE matches zero rows). The entry insert is the source of truth.

drop function if exists create_entry_with_tasks(
  uuid, uuid, uuid, text, text, text, date, text, numeric, text, text, jsonb, boolean,
  date, text, int
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
  insert into calendar_entries (
    brand_id, campaign_id, branch_id, type, title, description,
    target_date, assignee, budget_allocated, budget_category, notes,
    shoot_date, production_mode, editor_days_offset,
    pattern_id, theme, source_topic_id
  ) values (
    p_brand_id, p_campaign_id, p_branch_id, p_type, p_title, p_description,
    p_target_date, p_assignee, coalesce(p_budget_allocated, 0), p_budget_category, p_notes,
    p_shoot_date, coalesce(p_production_mode, 'batch'), coalesce(p_editor_days_offset, 2),
    p_pattern_id, p_theme, p_source_topic_id
  )
  returning id into v_entry_id;

  select * into v_entry from calendar_entries where id = v_entry_id;

  -- Mark the originating topic as used. Same transaction → entry + topic
  -- consistency is guaranteed. Silently no-ops if topic id is null or stale.
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
