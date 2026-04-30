-- Note: Supabase Auth manages auth.users; this is our app-level user profile
-- Keeping table name app_users to avoid collision
create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text not null,
  role text not null default 'admin' check (role in ('admin', 'editor', 'viewer')),
  brand_id uuid references brands(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger app_users_set_updated_at before update on app_users
  for each row execute function set_updated_at();

alter table app_users enable row level security;
create policy "authenticated_read_own" on app_users
  for select to authenticated using (auth.uid() = id);
create policy "authenticated_update_own" on app_users
  for update to authenticated using (auth.uid() = id);
