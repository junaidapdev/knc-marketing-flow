create table top_posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  entry_id uuid references calendar_entries(id) on delete set null,
  platform text not null check (platform in ('tiktok', 'instagram', 'snapchat')),
  post_date date not null,
  caption_snippet text,
  plays integer,
  likes integer,
  comments integer,
  shares integer,
  engagement_rate numeric(5,2),
  thumbnail_url text,
  post_url text,
  created_at timestamptz not null default now()
);

create index idx_top_posts_brand_date on top_posts(brand_id, post_date desc);

alter table top_posts enable row level security;
create policy "authenticated_full_access" on top_posts
  for all to authenticated using (true) with check (true);
