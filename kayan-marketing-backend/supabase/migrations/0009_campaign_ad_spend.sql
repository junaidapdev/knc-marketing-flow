create table campaign_ad_spend (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'snapchat', 'instagram')),
  start_date date not null,
  end_date date not null,
  budget numeric(12,2) not null default 0,
  spent numeric(12,2) not null default 0,
  objective text check (objective in ('awareness', 'conversion', 'traffic')),
  impressions integer,
  clicks integer,
  conversions integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_spend_dates_valid check (end_date >= start_date)
);

create index idx_ad_spend_campaign_id on campaign_ad_spend(campaign_id);
create index idx_ad_spend_platform_dates on campaign_ad_spend(platform, start_date, end_date);

create trigger ad_spend_set_updated_at before update on campaign_ad_spend
  for each row execute function set_updated_at();

alter table campaign_ad_spend enable row level security;
create policy "authenticated_full_access" on campaign_ad_spend
  for all to authenticated using (true) with check (true);
