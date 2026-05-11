-- Migration 0049: report summary RPC.
--
-- Generates an on-demand marketing activity summary for an inclusive date
-- range. The Edge Function computes comparison periods by calling this RPC
-- twice; the RPC itself returns the primary summary without comparison.

create or replace function get_report_summary(
  p_brand_id uuid,
  p_from date,
  p_to date,
  p_campaign_id uuid default null,
  p_branch_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
as $$
declare
  v_threshold int := 50;
  v_days_count int;
  v_label text;
  v_content record;
  v_activities record;
  v_campaigns record;
  v_top_campaign jsonb;
  v_influencers record;
  v_perf record;
  v_perf_totals jsonb;
  v_top_platform text;
begin
  v_days_count := (p_to - p_from) + 1;

  if p_from = date_trunc('month', p_from)::date
     and p_to = (date_trunc('month', p_from)::date + interval '1 month - 1 day')::date then
    v_label := to_char(p_from, 'FMMonth YYYY');
  elsif p_from = date_trunc('quarter', p_from)::date
     and p_to = (date_trunc('quarter', p_from)::date + interval '3 months - 1 day')::date then
    v_label := 'Q' || extract(quarter from p_from)::int::text || ' ' || extract(year from p_from)::int::text;
  elsif extract(year from p_from) = extract(year from p_to) then
    v_label := to_char(p_from, 'FMMon FMDD') || ' - ' || to_char(p_to, 'FMMon FMDD, YYYY');
  else
    v_label := to_char(p_from, 'FMMon FMDD, YYYY') || ' - ' || to_char(p_to, 'FMMon FMDD, YYYY');
  end if;

  select
    count(*)::int as total_posted,
    (count(*) filter (where type = 'tiktok_video'))::int as tiktok_video,
    (count(*) filter (where type = 'instagram_reel'))::int as instagram_reel,
    (count(*) filter (where type = 'instagram_story'))::int as instagram_story,
    (count(*) filter (where type = 'snapchat_story'))::int as snapchat_story
  into v_content
  from calendar_entries
  where brand_id = p_brand_id
    and target_date between p_from and p_to
    and status in ('live', 'done')
    and type in ('tiktok_video', 'instagram_reel', 'instagram_story', 'snapchat_story')
    and (p_campaign_id is null or campaign_id = p_campaign_id)
    and (p_branch_id is null or branch_id = p_branch_id);

  select
    (count(*) filter (where type = 'shop_activity'))::int as shop_activities,
    (count(*) filter (where type = 'offer'))::int as offers,
    (count(*) filter (where type = 'influencer_collab'))::int as influencer_collabs,
    (count(*) filter (where type = 'general'))::int as general_tasks
  into v_activities
  from calendar_entries
  where brand_id = p_brand_id
    and target_date between p_from and p_to
    and status in ('live', 'done')
    and type in ('shop_activity', 'offer', 'influencer_collab', 'general')
    and (p_campaign_id is null or campaign_id = p_campaign_id)
    and (p_branch_id is null or branch_id = p_branch_id);

  select
    (count(*) filter (
      where c.status <> 'cancelled'
        and c.start_date <= p_to
        and c.end_date >= p_from
    ))::int as active_during_period,
    (count(*) filter (
      where c.status = 'completed'
        and c.end_date between p_from and p_to
    ))::int as completed_during_period
  into v_campaigns
  from campaigns c
  where c.brand_id = p_brand_id
    and (p_campaign_id is null or c.id = p_campaign_id)
    and (
      p_branch_id is null
      or exists (
        select 1
        from calendar_entries e
        where e.campaign_id = c.id
          and e.brand_id = p_brand_id
          and e.branch_id = p_branch_id
          and e.target_date between p_from and p_to
          and e.status <> 'cancelled'
      )
    );

  select jsonb_build_object(
    'id', ranked.id,
    'name', ranked.name,
    'entries_count', ranked.entries_count
  )
  into v_top_campaign
  from (
    select
      c.id,
      c.name,
      count(e.id)::int as entries_count
    from calendar_entries e
    join campaigns c on c.id = e.campaign_id
    where e.brand_id = p_brand_id
      and e.target_date between p_from and p_to
      and e.status <> 'cancelled'
      and (p_campaign_id is null or e.campaign_id = p_campaign_id)
      and (p_branch_id is null or e.branch_id = p_branch_id)
    group by c.id, c.name
    order by count(e.id) desc, c.name asc
    limit 1
  ) ranked;

  with scoped_collabs as (
    select id, target_date
    from calendar_entries
    where brand_id = p_brand_id
      and type = 'influencer_collab'
      and target_date between p_from and p_to
      and status <> 'cancelled'
      and (p_campaign_id is null or campaign_id = p_campaign_id)
      and (p_branch_id is null or branch_id = p_branch_id)
  ),
  scoped_submissions as (
    select s.*
    from influencer_submissions s
    join scoped_collabs c on c.id = s.entry_id
  )
  select
    (select count(*)::int from scoped_collabs) as total_collabs,
    (select count(*)::int from scoped_submissions) as submissions_received,
    (select (count(*) filter (where verification_status = 'verified'))::int from scoped_submissions) as verified,
    (select (count(*) filter (where verification_status = 'pending'))::int from scoped_submissions) as pending,
    (select (count(*) filter (where verification_status = 'disputed'))::int from scoped_submissions) as disputed,
    (
      select count(*)::int
      from scoped_collabs c
      where c.target_date < current_date
        and not exists (
          select 1
          from influencer_submissions s
          where s.entry_id = c.id
        )
    ) as not_submitted_yet
  into v_influencers;

  with scoped_submissions as (
    select s.id
    from influencer_submissions s
    join calendar_entries e on e.id = s.entry_id
    where e.brand_id = p_brand_id
      and e.target_date between p_from and p_to
      and e.status <> 'cancelled'
      and (p_campaign_id is null or e.campaign_id = p_campaign_id)
      and (p_branch_id is null or e.branch_id = p_branch_id)
  ),
  logged_submissions as (
    select distinct s.id
    from scoped_submissions s
    join influencer_performance_logs l on l.submission_id = s.id
  ),
  scoped_logs as (
    select l.*
    from influencer_performance_logs l
    join scoped_submissions s on s.id = l.submission_id
  )
  select
    (select count(*)::int from logged_submissions) as with_performance_logged,
    case
      when coalesce(v_content.total_posted, 0) = 0 then 0
      else least(
        100,
        round(
          ((select count(*) from logged_submissions)::numeric * 100)
          / nullif(v_content.total_posted, 0)
        )::int
      )
    end as percentage,
    case
      when coalesce(v_content.total_posted, 0) = 0 then true
      else (
        least(
          100,
          round(
            ((select count(*) from logged_submissions)::numeric * 100)
            / nullif(v_content.total_posted, 0)
          )::int
        ) < v_threshold
      )
    end as below_threshold,
    coalesce((select sum(coalesce(views, 0)) from scoped_logs), 0)::bigint as views,
    coalesce((select sum(coalesce(likes, 0)) from scoped_logs), 0)::bigint as likes,
    coalesce((select sum(coalesce(comments, 0)) from scoped_logs), 0)::bigint as comments,
    coalesce((select sum(coalesce(shares, 0)) from scoped_logs), 0)::bigint as shares,
    coalesce((select sum(coalesce(reach, 0)) from scoped_logs), 0)::bigint as reach
  into v_perf;

  if v_perf.below_threshold then
    v_perf_totals := null;
    v_top_platform := null;
  else
    v_perf_totals := jsonb_build_object(
      'views', v_perf.views,
      'likes', v_perf.likes,
      'comments', v_perf.comments,
      'shares', v_perf.shares,
      'reach', v_perf.reach
    );

    with scoped_submissions as (
      select s.id
      from influencer_submissions s
      join calendar_entries e on e.id = s.entry_id
      where e.brand_id = p_brand_id
        and e.target_date between p_from and p_to
        and e.status <> 'cancelled'
        and (p_campaign_id is null or e.campaign_id = p_campaign_id)
        and (p_branch_id is null or e.branch_id = p_branch_id)
    )
    select ranked.platform
    into v_top_platform
    from (
      select
        l.platform,
        sum(coalesce(l.views, 0)) as total_views
      from influencer_performance_logs l
      join scoped_submissions s on s.id = l.submission_id
      group by l.platform
      order by sum(coalesce(l.views, 0)) desc, l.platform asc
      limit 1
    ) ranked
    where ranked.total_views > 0;
  end if;

  return jsonb_build_object(
    'period', jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'label', v_label,
      'days_count', v_days_count
    ),
    'generated_at', now(),
    'content', jsonb_build_object(
      'total_posted', coalesce(v_content.total_posted, 0),
      'by_type', jsonb_build_object(
        'tiktok_video', coalesce(v_content.tiktok_video, 0),
        'instagram_reel', coalesce(v_content.instagram_reel, 0),
        'instagram_story', coalesce(v_content.instagram_story, 0),
        'snapchat_story', coalesce(v_content.snapchat_story, 0)
      ),
      'videos_total', coalesce(v_content.tiktok_video, 0) + coalesce(v_content.instagram_reel, 0),
      'stories_total', coalesce(v_content.instagram_story, 0) + coalesce(v_content.snapchat_story, 0)
    ),
    'activities', jsonb_build_object(
      'shop_activities', coalesce(v_activities.shop_activities, 0),
      'offers', coalesce(v_activities.offers, 0),
      'influencer_collabs', coalesce(v_activities.influencer_collabs, 0),
      'general_tasks', coalesce(v_activities.general_tasks, 0)
    ),
    'campaigns', jsonb_build_object(
      'active_during_period', coalesce(v_campaigns.active_during_period, 0),
      'completed_during_period', coalesce(v_campaigns.completed_during_period, 0),
      'top_campaign', v_top_campaign
    ),
    'influencers', jsonb_build_object(
      'total_collabs', coalesce(v_influencers.total_collabs, 0),
      'submissions_received', coalesce(v_influencers.submissions_received, 0),
      'verified', coalesce(v_influencers.verified, 0),
      'pending', coalesce(v_influencers.pending, 0),
      'disputed', coalesce(v_influencers.disputed, 0),
      'not_submitted_yet', coalesce(v_influencers.not_submitted_yet, 0)
    ),
    'performance', jsonb_build_object(
      'coverage', jsonb_build_object(
        'total_posted', coalesce(v_content.total_posted, 0),
        'with_performance_logged', coalesce(v_perf.with_performance_logged, 0),
        'percentage', coalesce(v_perf.percentage, 0),
        'below_threshold', coalesce(v_perf.below_threshold, true)
      ),
      'totals', v_perf_totals,
      'top_platform', v_top_platform
    )
  );
end;
$$;
