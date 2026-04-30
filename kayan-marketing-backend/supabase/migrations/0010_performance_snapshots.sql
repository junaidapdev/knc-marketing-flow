create table performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  snapshot_date date not null,
  platform text not null check (platform in ('tiktok', 'instagram', 'snapchat')),
  followers integer,
  total_views integer,
  total_likes integer,
  total_comments integer,
  total_shares integer,
  reach integer,
  notes text,
  created_at timestamptz not null default now(),
  unique(brand_id, snapshot_date, platform)
);

create index idx_snapshots_brand_date_platform on performance_snapshots(brand_id, snapshot_date, platform);

alter table performance_snapshots enable row level security;
create policy "authenticated_full_access" on performance_snapshots
  for all to authenticated using (true) with check (true);
