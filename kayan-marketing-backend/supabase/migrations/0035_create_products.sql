-- Migration 0035: products — the marketing catalog.
--
-- This table feeds the AI prompt builder so generated scripts can reference
-- REAL products (Pepero, Tiffany, Fahadah) instead of generic "candy". It is
-- explicitly NOT inventory: no SKU codes, no stock counts, no supplier
-- fields. Only data that changes how the AI writes belongs here.
--
-- price_tier values:
--   anchor      = 11.50 SR fixed-price line (most products)
--   premium     = boxed chocolates, premium imports
--   bulk        = multi-pack bundles (24+4 etc.)
--   open_price  = variable pricing, comparison products
--
-- is_hero_product: AI emphasizes these (Kayan's signature items).
-- is_trending:     timely / viral / new arrivals.
-- tags (text[]):   freeform vocabulary the AI can pattern-match against
--                  the entry's theme (`imported`, `sour`, `kids`, `ramadan`).

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  category_id uuid references product_categories(id) on delete set null,
  name text not null,
  manufacturer text,
  description text,
  price_tier text not null default 'anchor' check (price_tier in (
    'anchor', 'premium', 'bulk', 'open_price'
  )),
  is_trending boolean not null default false,
  is_hero_product boolean not null default false,
  is_active boolean not null default true,
  marketing_notes text,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(brand_id, name)
);

create index if not exists idx_products_brand_active
  on products(brand_id, is_active);
create index if not exists idx_products_category
  on products(category_id);
create index if not exists idx_products_trending
  on products(brand_id) where is_trending = true and is_active = true;
create index if not exists idx_products_hero
  on products(brand_id) where is_hero_product = true and is_active = true;
create index if not exists idx_products_tags
  on products using gin(tags);

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

alter table products enable row level security;
drop policy if exists "products_authenticated_full_access" on products;
create policy "products_authenticated_full_access"
  on products for all to authenticated
  using (true) with check (true);
