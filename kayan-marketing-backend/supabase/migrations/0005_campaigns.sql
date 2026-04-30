create table campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  campaign_type text not null check (campaign_type in ('offer', 'event', 'reward', 'seasonal', 'awareness', 'other')),
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'cancelled')),
  start_date date not null,
  end_date date not null,
  total_budget numeric(12,2) not null default 0,
  total_spent numeric(12,2) not null default 0,
  offer_trigger text,
  offer_reward text,
  promo_code text,
  custom_fields jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_dates_valid check (end_date >= start_date)
);

create index idx_campaigns_brand_id on campaigns(brand_id);
create index idx_campaigns_status on campaigns(status);
create index idx_campaigns_dates on campaigns(start_date, end_date);

create trigger campaigns_set_updated_at before update on campaigns
  for each row execute function set_updated_at();

alter table campaigns enable row level security;
create policy "authenticated_full_access" on campaigns
  for all to authenticated using (true) with check (true);
