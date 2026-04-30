-- Returns a single JSONB with cap (total + per-category), spent (total + per-category),
-- and a flat list of contributing rows (calendar entries with budget_spent > 0,
-- and campaign ad-spend rows with spent > 0). Inner row data uses the names defined
-- here (not raw column names), so the Edge Function can return as-is or via toCamel.
create or replace function get_budget_summary(p_brand_id uuid, p_month date)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_cap_total numeric;
  v_cap_by_category jsonb;
  v_spent_by_category jsonb;
  v_total_spent numeric;
  v_contributing jsonb;
begin
  -- Cap from budget_caps for this month
  select bc.total_cap, coalesce(bc.category_caps, '{}'::jsonb)
  into v_cap_total, v_cap_by_category
  from budget_caps bc
  where bc.brand_id = p_brand_id and bc.month = v_month_start;

  v_cap_total := coalesce(v_cap_total, 0);
  v_cap_by_category := coalesce(v_cap_by_category, '{}'::jsonb);

  -- Spent: combine calendar_entries.budget_spent (categorized) and campaign_ad_spend.spent
  -- (mapped from platform → category)
  with entry_spend as (
    select coalesce(budget_category, 'other') as cat, sum(budget_spent) as amt
    from calendar_entries
    where brand_id = p_brand_id
      and target_date between v_month_start and v_month_end
      and budget_spent > 0
    group by 1
  ),
  ad_spend_per_category as (
    select
      case cas.platform
        when 'tiktok' then 'ad_spend_tiktok'
        when 'snapchat' then 'ad_spend_snap'
        when 'instagram' then 'ad_spend_ig'
        else 'other'
      end as cat,
      sum(cas.spent) as amt
    from campaign_ad_spend cas
    join campaigns c on c.id = cas.campaign_id
    where c.brand_id = p_brand_id
      and (cas.start_date between v_month_start and v_month_end
           or cas.end_date between v_month_start and v_month_end)
      and cas.spent > 0
    group by 1
  ),
  combined as (
    select cat, sum(amt) as amt
    from (
      select * from entry_spend
      union all
      select * from ad_spend_per_category
    ) x
    group by cat
  )
  select
    coalesce(jsonb_object_agg(cat, amt), '{}'::jsonb),
    coalesce(sum(amt), 0)
  into v_spent_by_category, v_total_spent
  from combined;

  -- Flat contributing list, sorted by amount desc
  with contrib as (
    select
      ce.id,
      ce.title,
      coalesce(ce.budget_category, 'other') as category,
      ce.budget_spent as amount,
      'entry'::text as kind
    from calendar_entries ce
    where ce.brand_id = p_brand_id
      and ce.target_date between v_month_start and v_month_end
      and ce.budget_spent > 0
    union all
    select
      cas.id,
      c.name as title,
      case cas.platform
        when 'tiktok' then 'ad_spend_tiktok'
        when 'snapchat' then 'ad_spend_snap'
        when 'instagram' then 'ad_spend_ig'
        else 'other'
      end as category,
      cas.spent as amount,
      'campaign_ad_spend'::text as kind
    from campaign_ad_spend cas
    join campaigns c on c.id = cas.campaign_id
    where c.brand_id = p_brand_id
      and (cas.start_date between v_month_start and v_month_end
           or cas.end_date between v_month_start and v_month_end)
      and cas.spent > 0
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'title', title,
        'category', category,
        'amount', amount,
        'type', kind
      )
      order by amount desc
    ),
    '[]'::jsonb
  )
  into v_contributing
  from contrib;

  return jsonb_build_object(
    'cap', jsonb_build_object('total', v_cap_total, 'byCategory', v_cap_by_category),
    'spent', jsonb_build_object('total', v_total_spent, 'byCategory', v_spent_by_category),
    'contributingEntries', v_contributing
  );
end;
$$;
