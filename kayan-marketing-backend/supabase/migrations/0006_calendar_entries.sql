create table calendar_entries (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  type text not null check (type in (
    'tiktok_video', 'instagram_reel', 'instagram_story',
    'snapchat_story', 'shop_activity', 'influencer_collab',
    'offer', 'general'
  )),
  title text not null check (length(title) >= 3),
  description text,
  target_date date not null,
  assignee text not null check (assignee in ('junaid', 'ammar')),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'live', 'done', 'cancelled')),
  budget_allocated numeric(12,2) not null default 0,
  budget_spent numeric(12,2) not null default 0,
  budget_category text check (budget_category in (
    'ad_spend_tiktok', 'ad_spend_snap', 'ad_spend_ig',
    'influencer', 'shop_materials', 'production', 'other'
  )),
  video_url text,
  post_url text,
  attachments jsonb not null default '[]'::jsonb,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_calendar_entries_target_date on calendar_entries(target_date);
create index idx_calendar_entries_assignee_date on calendar_entries(assignee, target_date);
create index idx_calendar_entries_campaign_id on calendar_entries(campaign_id);
create index idx_calendar_entries_brand_id on calendar_entries(brand_id);
create index idx_calendar_entries_status on calendar_entries(status);

create trigger calendar_entries_set_updated_at before update on calendar_entries
  for each row execute function set_updated_at();

alter table calendar_entries enable row level security;
create policy "authenticated_full_access" on calendar_entries
  for all to authenticated using (true) with check (true);
