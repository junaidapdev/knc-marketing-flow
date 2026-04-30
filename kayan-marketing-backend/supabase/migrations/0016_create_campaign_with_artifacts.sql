-- Atomically create a campaign + its branch rollouts (with optional shop_activity
-- calendar entries and 3-task chains each) + ad spend lines. Single transaction;
-- raise on any failure rolls everything back.
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
  p_branch_rollouts jsonb,    -- [{branchId, branchName, rolloutDate, leadAssignee, notes}]
  p_ad_spend_lines jsonb,      -- [{platform, startDate, endDate, budget, objective}]
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
  -- Insert campaign
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

  -- Branch rollouts → optional auto-spawn shop_activity entries with task chain
  if p_branch_rollouts is not null then
    for v_rollout in select * from jsonb_array_elements(p_branch_rollouts) loop
      v_entry_id := null;

      if p_auto_create_entries then
        insert into calendar_entries (
          brand_id, campaign_id, type, title, target_date, assignee
        ) values (
          p_brand_id,
          v_campaign_id,
          'shop_activity',
          p_name || ' — ' || (v_rollout->>'branchName'),
          (v_rollout->>'rolloutDate')::date,
          v_rollout->>'leadAssignee'
        )
        returning id into v_entry_id;

        -- Standard shop_activity task chain (3 tasks: plan -3d, setup 0, wrap +1d)
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

  -- Ad spend lines
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
