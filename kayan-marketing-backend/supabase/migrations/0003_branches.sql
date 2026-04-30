create table branches (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  city text not null,
  is_active boolean not null default true,
  has_boxed_chocolates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_branches_brand_id on branches(brand_id);
create index idx_branches_city on branches(city);

create trigger branches_set_updated_at before update on branches
  for each row execute function set_updated_at();

alter table branches enable row level security;
create policy "authenticated_full_access" on branches
  for all to authenticated using (true) with check (true);
