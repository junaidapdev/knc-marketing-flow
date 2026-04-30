-- Auto-provision an app_users row whenever a new auth.users row is created,
-- so foreign keys that reference app_users (ai_conversations.user_id, etc.)
-- always resolve. Without this, signing up via Supabase Auth would leave the
-- new account unable to use any feature that writes back to user-scoped tables.

-- We pin every auto-provisioned user to the single V1 brand. If we ever go
-- multi-tenant, this trigger gets replaced with brand-aware logic.

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_brand uuid;
begin
  -- Pick the first brand. V1 is single-tenant — Kayan Sweets.
  select id into default_brand from brands order by created_at asc limit 1;

  insert into app_users (id, email, display_name, brand_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    default_brand
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- Backfill: any auth user that doesn't yet have an app_users row gets one now.
insert into app_users (id, email, display_name, brand_id)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
  (select id from brands order by created_at asc limit 1)
from auth.users u
where not exists (select 1 from app_users a where a.id = u.id);
