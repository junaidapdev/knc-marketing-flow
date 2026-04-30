-- Atomically create a calendar entry plus its auto-spawned task chain
create or replace function create_entry_with_tasks(
  p_brand_id uuid,
  p_campaign_id uuid,
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
  -- Insert the entry
  insert into calendar_entries (
    brand_id, campaign_id, type, title, description,
    target_date, assignee, budget_allocated, budget_category, notes
  ) values (
    p_brand_id, p_campaign_id, p_type, p_title, p_description,
    p_target_date, p_assignee, coalesce(p_budget_allocated, 0), p_budget_category, p_notes
  )
  returning id into v_entry_id;

  select * into v_entry from calendar_entries where id = v_entry_id;

  -- If auto-create requested, spawn tasks
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
