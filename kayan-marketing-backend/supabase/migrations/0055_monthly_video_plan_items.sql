-- Migration 0055: Monthly video plan items.
--
-- A simple per-month list of planned video buckets. Each row is one line on
-- the /goals page: a count (or range), a free-text label, and a sort_order
-- for manual reordering. This is intentionally NOT linked to calendar_entries
-- — it is a standalone planning view, not a tracker. The Goals page reads/
-- writes rows directly; nothing else in the system depends on it.

create table if not exists monthly_video_plan_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  month date not null,
  label text not null,
  count integer not null,
  count_max integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_video_plan_items_label_not_blank
    check (length(trim(label)) > 0),
  constraint monthly_video_plan_items_count_positive
    check (count > 0),
  constraint monthly_video_plan_items_count_max_valid
    check (count_max is null or count_max >= count),
  constraint monthly_video_plan_items_month_first_of_month
    check (extract(day from month) = 1)
);

create index if not exists idx_monthly_video_plan_items_brand_month
  on monthly_video_plan_items(brand_id, month, sort_order);

drop trigger if exists monthly_video_plan_items_set_updated_at
  on monthly_video_plan_items;
create trigger monthly_video_plan_items_set_updated_at
  before update on monthly_video_plan_items
  for each row execute function set_updated_at();

alter table monthly_video_plan_items enable row level security;

drop policy if exists "monthly_video_plan_items_authenticated_full_access"
  on monthly_video_plan_items;
create policy "monthly_video_plan_items_authenticated_full_access"
  on monthly_video_plan_items for all to authenticated
  using (true) with check (true);
