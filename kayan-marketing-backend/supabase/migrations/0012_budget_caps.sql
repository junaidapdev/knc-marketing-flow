create table budget_caps (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  month date not null,
  total_cap numeric(12,2) not null,
  category_caps jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(brand_id, month)
);

create trigger budget_caps_set_updated_at before update on budget_caps
  for each row execute function set_updated_at();

alter table budget_caps enable row level security;
create policy "authenticated_full_access" on budget_caps
  for all to authenticated using (true) with check (true);
