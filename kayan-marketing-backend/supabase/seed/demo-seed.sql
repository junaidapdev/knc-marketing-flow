-- Demo seed for Kayan Marketing OS
-- Purpose: rich, realistic data for the recording demo.
-- Run AFTER seed.sql (depends on the brand + 12 branches existing).
-- Idempotent: wipes prior demo rows for this brand on every run.
-- All dates are relative to current_date so the demo always feels "now".

begin;

-- =========================================================
-- 1. WIPE prior demo data (preserves brand, branches, auth)
-- =========================================================
delete from tasks
  where is_standalone = true
     or entry_id in (select id from calendar_entries where brand_id = '11111111-1111-1111-1111-111111111111')
     or campaign_id in (select id from campaigns where brand_id = '11111111-1111-1111-1111-111111111111');
delete from campaign_ad_spend
  where campaign_id in (select id from campaigns where brand_id = '11111111-1111-1111-1111-111111111111');
delete from campaign_branch_rollouts
  where campaign_id in (select id from campaigns where brand_id = '11111111-1111-1111-1111-111111111111');
delete from calendar_entries where brand_id = '11111111-1111-1111-1111-111111111111';
delete from campaigns where brand_id = '11111111-1111-1111-1111-111111111111';
-- NOTE: top_posts and performance_snapshots are intentionally NOT wiped or seeded.
-- The Performance tab should reflect real ingested data, not demo numbers.

-- =========================================================
-- 2. Campaign + rollouts + entries + tasks + ad-spend
-- =========================================================
do $$
declare
  brand uuid := '11111111-1111-1111-1111-111111111111';
  campaign uuid;
  branch_rusaifah uuid;
  branch_awali uuid;
  branch_salama uuid;
  shop_1 uuid; shop_2 uuid; shop_3 uuid;
  vid_1 uuid; vid_2 uuid; reel_1 uuid; offer_1 uuid; story_1 uuid; brief_1 uuid;
begin
  select id into branch_rusaifah from branches where name = 'Al Rusaifah' and brand_id = brand;
  select id into branch_awali     from branches where name = 'Al Awali'     and brand_id = brand;
  select id into branch_salama    from branches where name = 'Al Salama'    and brand_id = brand;

  -- ---------- CAMPAIGN: Ramadan Family Bundle ----------
  insert into campaigns (brand_id, name, campaign_type, status, start_date, end_date,
                         total_budget, total_spent, offer_trigger, offer_reward, promo_code, notes)
  values (brand, 'Ramadan Family Bundle', 'offer', 'active',
          current_date - 5, current_date + 14,
          8000, 3200,
          'Spend 50 SAR or more',
          'Free dates box (250g)',
          'RAMADAN26',
          'Multi-branch push for Ramadan; centerpiece offer for the month.')
  returning id into campaign;

  -- ---------- shop_activity entries (one per rollout) ----------
  insert into calendar_entries (brand_id, campaign_id, format, title, target_date, assignee, status, branch_id, budget_allocated, budget_spent, budget_category)
  values (brand, campaign, 'shop_activity', 'Setup Ramadan display — Al Rusaifah',
          current_date + 1, 'ammar', 'planned', branch_rusaifah, 400, 0, 'shop_materials')
  returning id into shop_1;

  insert into calendar_entries (brand_id, campaign_id, format, title, target_date, assignee, status, branch_id, budget_allocated, budget_spent, budget_category)
  values (brand, campaign, 'shop_activity', 'Setup Ramadan display — Al Awali',
          current_date + 2, 'ammar', 'planned', branch_awali, 400, 0, 'shop_materials')
  returning id into shop_2;

  insert into calendar_entries (brand_id, campaign_id, format, title, target_date, assignee, status, branch_id, budget_allocated, budget_spent, budget_category)
  values (brand, campaign, 'shop_activity', 'Setup Ramadan display — Al Salama',
          current_date - 2, 'junaid', 'live', branch_salama, 400, 380, 'shop_materials')
  returning id into shop_3;

  -- ---------- branch rollouts ----------
  insert into campaign_branch_rollouts (campaign_id, branch_id, rollout_date, lead_assignee, status, calendar_entry_id) values
    (campaign, branch_rusaifah, current_date + 1, 'ammar',  'planned', shop_1),
    (campaign, branch_awali,    current_date + 2, 'ammar',  'planned', shop_2),
    (campaign, branch_salama,   current_date - 2, 'junaid', 'active',  shop_3);

  -- ---------- 3-task chain per shop_activity (plan → setup → wrap) ----------
  insert into tasks (entry_id, title, phase, assignee, due_date, status) values
    (shop_1, 'Plan Ramadan display layout',     'plan',  'ammar', current_date - 1, 'completed'),
    (shop_1, 'Setup display at Al Rusaifah',    'setup', 'ammar', current_date + 1, 'pending'),
    (shop_1, 'Wrap up — photo + cleanup',       'wrap',  'ammar', current_date + 1, 'pending'),
    (shop_2, 'Plan Ramadan display layout',     'plan',  'ammar', current_date,     'in_progress'),
    (shop_2, 'Setup display at Al Awali',       'setup', 'ammar', current_date + 2, 'pending'),
    (shop_2, 'Wrap up — photo + cleanup',       'wrap',  'ammar', current_date + 2, 'pending'),
    (shop_3, 'Plan Ramadan display layout',     'plan',  'junaid', current_date - 4, 'completed'),
    (shop_3, 'Setup display at Al Salama',      'setup', 'junaid', current_date - 2, 'completed'),
    (shop_3, 'Wrap up — photo + cleanup',       'wrap',  'junaid', current_date - 2, 'completed');

  -- ---------- ad-spend lines ----------
  insert into campaign_ad_spend (campaign_id, platform, start_date, end_date, budget, spent, objective, impressions, clicks, conversions) values
    (campaign, 'tiktok',    current_date - 5, current_date + 14, 4000, 1800, 'awareness',  215000, 4200, 380),
    (campaign, 'instagram', current_date - 3, current_date + 14, 2500,  950, 'conversion',  88000, 1900, 210);

  -- =========================================================
  -- 3. Standalone calendar entries (variety for the calendar)
  -- =========================================================
  -- After migration 0050, content rows use format=video|story and per-platform
  -- publication rows hang off entry_publications. Each video shoot goes to
  -- all three platforms by default.

  insert into calendar_entries (brand_id, format, title, target_date, assignee, status, budget_allocated, budget_spent, budget_category)
  values (brand, 'video', 'New flavors arrival — taste-test reel',
          current_date, 'ammar', 'in_progress', 200, 50, 'production')
  returning id into vid_1;
  insert into entry_publications (entry_id, platform) values
    (vid_1, 'tiktok'), (vid_1, 'instagram'), (vid_1, 'snapchat');

  insert into calendar_entries (brand_id, format, title, target_date, assignee, status, budget_allocated, budget_spent, budget_category)
  values (brand, 'video', '11.50 SR fixed-price challenge',
          current_date + 3, 'both', 'planned', 250, 0, 'production')
  returning id into vid_2;
  insert into entry_publications (entry_id, platform) values
    (vid_2, 'tiktok'), (vid_2, 'instagram'), (vid_2, 'snapchat');

  insert into calendar_entries (brand_id, format, title, target_date, assignee, status)
  values (brand, 'video', 'Boxed chocolates B-roll',
          current_date + 1, 'junaid', 'planned')
  returning id into reel_1;
  -- Reel-style content historically went to IG only; reflect that here.
  insert into entry_publications (entry_id, platform) values
    (reel_1, 'instagram');

  insert into calendar_entries (brand_id, format, title, target_date, assignee, status, budget_allocated, budget_spent, budget_category)
  values (brand, 'offer', 'Eid pre-launch teaser',
          current_date + 8, 'junaid', 'planned', 1500, 0, 'ad_spend_ig')
  returning id into offer_1;

  insert into calendar_entries (brand_id, format, title, target_date, assignee, status)
  values (brand, 'story', 'Behind-the-counter day in Jeddah',
          current_date - 1, 'ammar', 'live')
  returning id into story_1;
  insert into entry_publications (entry_id, platform, posted_at) values
    (story_1, 'instagram', now()),
    (story_1, 'snapchat', now());

  insert into calendar_entries (brand_id, format, title, target_date, assignee, status)
  values (brand, 'general', 'Monthly content brief review',
          current_date + 2, 'both', 'planned')
  returning id into brief_1;

  -- A few more "done" entries to fill earlier days of the month
  declare
    e_id uuid;
  begin
    -- Past video collab
    insert into calendar_entries (brand_id, format, title, target_date, assignee, status)
    values (brand, 'video', 'Influencer collab — @sweetyy', current_date - 8, 'junaid', 'done')
    returning id into e_id;
    insert into entry_publications (entry_id, platform, posted_at) values
      (e_id, 'tiktok', now()), (e_id, 'instagram', now()), (e_id, 'snapchat', now());

    -- Past story
    insert into calendar_entries (brand_id, format, title, target_date, assignee, status)
    values (brand, 'story', 'Customer reaction reposts', current_date - 4, 'ammar', 'done')
    returning id into e_id;
    insert into entry_publications (entry_id, platform, posted_at) values
      (e_id, 'instagram', now());

    -- Past video
    insert into calendar_entries (brand_id, format, title, target_date, assignee, status)
    values (brand, 'video', 'Top-3 candy ranking', current_date - 11, 'junaid', 'done')
    returning id into e_id;
    insert into entry_publications (entry_id, platform, posted_at) values
      (e_id, 'tiktok', now()), (e_id, 'instagram', now()), (e_id, 'snapchat', now());

    -- Past video — family bundle unboxing
    insert into calendar_entries (brand_id, format, title, target_date, assignee, status)
    values (brand, 'video', 'Family bundle unboxing', current_date - 6, 'both', 'done')
    returning id into e_id;
    insert into entry_publications (entry_id, platform, posted_at) values
      (e_id, 'tiktok', now()), (e_id, 'instagram', now()), (e_id, 'snapchat', now());

    -- Upcoming offer
    insert into calendar_entries (brand_id, format, title, target_date, assignee, status)
    values (brand, 'offer', 'Friday flash deal', current_date + 5, 'junaid', 'planned')
    returning id into e_id;
  end;

  -- =========================================================
  -- 4. Task chains for the standalone video / reel entries
  -- =========================================================
  insert into tasks (entry_id, title, phase, assignee, due_date, status) values
    -- vid_1 (today, in progress)
    (vid_1,  'Write script',    'script', 'ammar',  current_date,     'pending'),
    (vid_1,  'Shoot footage',   'shoot',  'ammar',  current_date,     'pending'),
    (vid_1,  'Edit + post',     'edit',   'junaid', current_date,     'pending'),
    -- vid_2 (in 3 days)
    (vid_2,  'Write script',    'script', 'ammar',  current_date + 1, 'pending'),
    (vid_2,  'Shoot footage',   'shoot',  'both',   current_date + 2, 'pending'),
    (vid_2,  'Edit + post',     'edit',   'junaid', current_date + 3, 'pending'),
    -- reel_1 (tomorrow, mid-flight)
    (reel_1, 'Write script',    'script', 'junaid', current_date - 1, 'completed'),
    (reel_1, 'Shoot footage',   'shoot',  'junaid', current_date,     'in_progress'),
    (reel_1, 'Edit + post',     'edit',   'junaid', current_date + 1, 'pending');

  -- =========================================================
  -- 5. Overdue tasks (Junaid, to populate the Overdue card)
  -- =========================================================
  insert into tasks (entry_id, title, phase, assignee, due_date, status) values
    (offer_1, 'Schedule on TikTok',    'schedule', 'junaid', current_date - 4, 'pending'),
    (offer_1, 'Post to TikTok',        'post',     'junaid', current_date - 3, 'pending'),
    (vid_1,   'Shot list approval',    'review',   'junaid', current_date - 2, 'pending'),
    (vid_1,   'Equipment setup',       'setup',    'junaid', current_date - 3, 'pending');

  -- =========================================================
  -- 6. Standalone tasks (no parent entry)
  -- =========================================================
  insert into tasks (title, phase, assignee, due_date, status, is_standalone, notes) values
    ('Coordinate with branch managers — Eid prep', 'communicate', 'both',  current_date,     'pending', true,
     'Sync with all 12 branch managers about Eid timing'),
    ('Review monthly performance report',           'review',     'junaid', current_date + 2, 'pending', true, null),
    ('Order new packaging — boxed chocolates',      'plan',       'ammar',  current_date + 4, 'pending', true, null);
end $$;

-- =========================================================
-- 7. Budget cap for the current month (upsert)
-- =========================================================
insert into budget_caps (brand_id, month, total_cap, category_caps) values (
  '11111111-1111-1111-1111-111111111111',
  date_trunc('month', current_date)::date,
  20000,
  '{
    "ad_spend_tiktok": 6000,
    "ad_spend_snap":   6000,
    "ad_spend_ig":     3000,
    "influencer":      3000,
    "shop_materials":  1000,
    "production":       500,
    "other":            500
  }'::jsonb
) on conflict (brand_id, month) do update set
  total_cap     = excluded.total_cap,
  category_caps = excluded.category_caps;

commit;
