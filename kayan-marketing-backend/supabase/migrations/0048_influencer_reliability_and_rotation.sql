-- Migration 0048: Influencer reliability score + portal-token rotation.
--
-- Two functions:
--   get_influencer_reliability(p_influencer_id)
--     Three-metric reliability JSONB:
--       post_rate    = submissions / eligible_collabs (past target, not cancelled), %
--       tag_rate     = submissions tagged_kayan=true / submissions, %
--       on_time_rate = submissions within target_date + 1 day / submissions, %
--     Plus total_collabs (= eligible_collabs in this calc — the
--     denominator the rates are scored against), total_submissions,
--     computed_at. NULL percentages when the denominator is 0.
--
--   rotate_influencer_token(p_influencer_id, p_user_id)
--     Generates a fresh portal token, stamps portal_activated_at = now.
--     Returns the new token. p_user_id is captured for the future audit
--     log (V2 follow-up — not stored on the row yet, just received as
--     a parameter so callers don't need to change when audit lands).
--
-- Idempotent — both functions are `create or replace`.

create or replace function get_influencer_reliability(p_influencer_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_eligible_collabs integer;
  v_total_submissions integer;
  v_tagged integer;
  v_on_time integer;
  v_post_rate integer;
  v_tag_rate integer;
  v_on_time_rate integer;
begin
  -- Eligible collabs: influencer_collab entries linked to this influencer,
  -- past target_date, not cancelled. This is BOTH the post-rate
  -- denominator AND the "total_collabs" surfaced in the response — the
  -- response value reflects "collabs that count toward the score".
  select count(*) into v_eligible_collabs
    from calendar_entries
   where type = 'influencer_collab'
     and influencer_id = p_influencer_id
     and status != 'cancelled'
     and target_date <= current_date;

  select count(*) into v_total_submissions
    from influencer_submissions
   where influencer_id = p_influencer_id;

  select count(*) into v_tagged
    from influencer_submissions
   where influencer_id = p_influencer_id
     and tagged_kayan = true;

  -- "On time" = submission landed on or before target_date + 1 day.
  select count(*) into v_on_time
    from influencer_submissions s
    join calendar_entries e on e.id = s.entry_id
   where s.influencer_id = p_influencer_id
     and (s.submitted_at)::date <= (e.target_date + interval '1 day')::date;

  if v_eligible_collabs > 0 then
    -- Cap at 100 — early submissions or out-of-window edge cases can
    -- otherwise inflate the ratio.
    v_post_rate := least(
      100,
      round((v_total_submissions::numeric / v_eligible_collabs::numeric) * 100)::integer
    );
  end if;

  if v_total_submissions > 0 then
    v_tag_rate := round((v_tagged::numeric / v_total_submissions::numeric) * 100)::integer;
    v_on_time_rate := round((v_on_time::numeric / v_total_submissions::numeric) * 100)::integer;
  end if;

  return jsonb_build_object(
    'post_rate', v_post_rate,
    'tag_rate', v_tag_rate,
    'on_time_rate', v_on_time_rate,
    'total_collabs', v_eligible_collabs,
    'total_submissions', v_total_submissions,
    'computed_at', now()
  );
end;
$$;

create or replace function rotate_influencer_token(
  p_influencer_id uuid,
  p_user_id uuid
) returns text
language plpgsql
security definer
as $$
declare
  v_token text;
begin
  -- gen_random_uuid() is uniqueness-by-construction (pgcrypto). The
  -- unique index idx_influencers_portal_token enforces no collision at
  -- the storage layer too.
  v_token := gen_random_uuid()::text;
  update influencers
     set portal_token = v_token,
         portal_activated_at = now(),
         updated_at = now()
   where id = p_influencer_id;

  if not found then
    raise exception 'Influencer not found.';
  end if;

  -- p_user_id is currently received but not persisted — it will be
  -- written to the planned `influencer_token_rotations` audit table in
  -- V2. Callers can already start passing the real auth.userId.
  perform p_user_id;

  return v_token;
end;
$$;
