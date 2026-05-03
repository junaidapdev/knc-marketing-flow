-- Migration 0036: product_branches — many-to-many between products + branches.
--
-- "Which products are stocked at which branches" is the key filter for AI
-- prompt injection: when generating a script for Al Salama, only suggest
-- products actually available at Al Salama (boxed chocolates yes, products
-- not stocked there no).
--
-- is_in_stock: lets the marketer flag a product as temporarily out without
-- breaking the link. The AI prompt loader respects this — only in-stock
-- entries get injected.
--
-- unique(product_id, branch_id) prevents duplicate links and makes the seed
-- migration idempotent (`on conflict do nothing`).

create table if not exists product_branches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  is_in_stock boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique(product_id, branch_id)
);

create index if not exists idx_product_branches_product
  on product_branches(product_id);
create index if not exists idx_product_branches_branch
  on product_branches(branch_id) where is_in_stock = true;

alter table product_branches enable row level security;
drop policy if exists "product_branches_authenticated_full_access" on product_branches;
create policy "product_branches_authenticated_full_access"
  on product_branches for all to authenticated
  using (true) with check (true);
