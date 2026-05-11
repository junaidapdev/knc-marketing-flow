-- Migration 0046: Influencer management database.
--
-- Internal admin-only influencer database for Kayan. Public creator portal,
-- submissions, reliability scoring, and WhatsApp integrations come in later
-- chunks.

create table if not exists influencers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  display_name text not null,
  full_name text,
  whatsapp text not null,
  city text,
  tiktok_handle text,
  tiktok_url text,
  tiktok_followers integer,
  instagram_handle text,
  instagram_url text,
  instagram_followers integer,
  snapchat_handle text,
  snapchat_url text,
  snapchat_followers integer,
  standard_rate numeric(10,2),
  accepts_barter boolean not null default false,
  niche_tags text[] not null default '{}'::text[],
  languages text[] not null default '{}'::text[],
  notes text,
  status text not null default 'active' check (status in ('active', 'paused', 'blacklisted')),
  portal_token text not null default gen_random_uuid()::text,
  portal_activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint influencers_whatsapp_not_blank check (length(trim(whatsapp)) > 0),
  constraint influencers_display_name_not_blank check (length(trim(display_name)) > 0),
  constraint influencers_followers_nonnegative check (
    (tiktok_followers is null or tiktok_followers >= 0) and
    (instagram_followers is null or instagram_followers >= 0) and
    (snapchat_followers is null or snapchat_followers >= 0)
  ),
  constraint influencers_standard_rate_nonnegative check (
    standard_rate is null or standard_rate >= 0
  ),
  constraint influencers_at_least_one_platform check (
    nullif(trim(coalesce(tiktok_handle, '')), '') is not null or
    nullif(trim(coalesce(instagram_handle, '')), '') is not null or
    nullif(trim(coalesce(snapchat_handle, '')), '') is not null
  )
);

create index if not exists idx_influencers_brand_id
  on influencers(brand_id);

create index if not exists idx_influencers_status
  on influencers(status);

create unique index if not exists idx_influencers_portal_token
  on influencers(portal_token);

create index if not exists idx_influencers_niche_tags
  on influencers using gin(niche_tags);

drop trigger if exists influencers_set_updated_at on influencers;
create trigger influencers_set_updated_at
  before update on influencers
  for each row execute function set_updated_at();

alter table influencers enable row level security;

drop policy if exists "influencers_authenticated_full_access" on influencers;
create policy "influencers_authenticated_full_access"
  on influencers for all to authenticated
  using (true) with check (true);
