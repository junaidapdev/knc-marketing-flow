-- Aggregates everything the Today page needs in a single round-trip.
-- Inner row data uses snake_case (postgres-native); the Edge Function
-- transforms the result to camelCase before returning to clients.
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
  -- Today's tasks
  select coalesce(jsonb_agg(to_jsonb(t.*) order by t.due_date, t.created_at), '[]'::jsonb)
  into v_today_tasks
  from tasks t
  where t.due_date = p_today;

  -- Overdue tasks (not yet completed and due before today)
  select
    count(*),
    coalesce(jsonb_agg(to_jsonb(t.*) order by t.due_date), '[]'::jsonb)
  into v_overdue_count, v_overdue_tasks
  from tasks t
  where t.due_date < p_today
    and t.status <> 'completed';

  -- Radar: +1, +2, +3 days
  select coalesce(jsonb_agg(to_jsonb(t.*) order by t.created_at), '[]'::jsonb)
  into v_tomorrow_tasks
  from tasks t where t.due_date = p_today + 1;

  select coalesce(jsonb_agg(to_jsonb(t.*) order by t.created_at), '[]'::jsonb)
  into v_day_after_tasks
  from tasks t where t.due_date = p_today + 2;

  select coalesce(jsonb_agg(to_jsonb(t.*) order by t.created_at), '[]'::jsonb)
  into v_day_three_tasks
  from tasks t where t.due_date = p_today + 3;

  -- Current month budget cap
  select bc.total_cap, bc.category_caps
  into v_budget_cap, v_category_caps
  from budget_caps bc
  where bc.brand_id = p_brand_id and bc.month = v_month_start;

  v_budget_cap := coalesce(v_budget_cap, 0);
  v_category_caps := coalesce(v_category_caps, '{}'::jsonb);

  -- Total spent this month from calendar entries
  select coalesce(sum(ce.budget_spent), 0)
  into v_budget_spent
  from calendar_entries ce
  where ce.brand_id = p_brand_id
    and ce.target_date between v_month_start and v_month_end;

  -- Top 3 categories by spend this month, with their cap from budget_caps.category_caps
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
