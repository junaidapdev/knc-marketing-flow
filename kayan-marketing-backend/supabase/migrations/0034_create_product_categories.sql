-- Migration 0034: product_categories — top-level groupings of the catalog
-- (e.g. Gummies & Jellies, Boxed Chocolates, Ülker Aisle).
--
-- Marketing-focused: this exists to feed the AI prompt builder, NOT to drive
-- inventory/POS. Keep it small and curated.
--
-- unique(brand_id, name) means re-running the seed (migration 0037) is safe
-- — each category exists at most once per brand.
--
-- Idempotent: `if not exists` everywhere.

create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  display_order int not null default 0,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(brand_id, name)
);

create index if not exists idx_product_categories_brand_order
  on product_categories(brand_id, display_order);

drop trigger if exists product_categories_set_updated_at on product_categories;
create trigger product_categories_set_updated_at
  before update on product_categories
  for each row execute function set_updated_at();

alter table product_categories enable row level security;
drop policy if exists "product_categories_authenticated_full_access" on product_categories;
create policy "product_categories_authenticated_full_access"
  on product_categories for all to authenticated
  using (true) with check (true);
