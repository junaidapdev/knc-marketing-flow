-- Migration 0054: Script revision history.
--
-- The first AI script generation writes directly to calendar_entries.script.
-- Revisions are different: the creator gives notes, the AI returns a preview,
-- and the old script is only overwritten after explicit approval. This table
-- stores every generated revision preview so creator feedback remains auditable
-- even when the preview is not applied.

create table if not exists script_revisions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references calendar_entries(id) on delete cascade,
  previous_script text not null,
  revision_notes text,
  quick_fixes text[] not null default '{}'::text[],
  revised_script text not null,
  model text not null,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_script_revisions_entry_created
  on script_revisions(entry_id, created_at desc);

create index if not exists idx_script_revisions_created_by
  on script_revisions(created_by);

alter table script_revisions enable row level security;

drop policy if exists "script_revisions_authenticated_full_access" on script_revisions;
create policy "script_revisions_authenticated_full_access"
  on script_revisions for all to authenticated
  using (true) with check (true);
