create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_code text unique not null,
  primary_color text,
  voice_config jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_brands_brand_code on brands(brand_code);

-- updated_at trigger
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger brands_set_updated_at before update on brands
  for each row execute function set_updated_at();

alter table brands enable row level security;

-- For V1 single-user, RLS allows authenticated users full access
-- Multi-tenant tightening comes in V2
create policy "authenticated_full_access" on brands
  for all to authenticated using (true) with check (true);
