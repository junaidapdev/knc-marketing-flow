create table tasks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references calendar_entries(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  title text not null check (length(title) >= 3),
  phase text check (phase in (
    'script', 'shoot', 'edit', 'post',
    'plan', 'setup', 'wrap',
    'brief', 'review', 'track',
    'communicate', 'activate',
    'custom'
  )),
  assignee text not null check (assignee in ('junaid', 'ammar')),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  is_standalone boolean not null default false,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_has_parent check (entry_id is not null or is_standalone = true)
);

create index idx_tasks_due_date on tasks(due_date);
create index idx_tasks_assignee_date on tasks(assignee, due_date);
create index idx_tasks_status_date on tasks(status, due_date);
create index idx_tasks_entry_id on tasks(entry_id);
create index idx_tasks_campaign_id on tasks(campaign_id);

create trigger tasks_set_updated_at before update on tasks
  for each row execute function set_updated_at();

alter table tasks enable row level security;
create policy "authenticated_full_access" on tasks
  for all to authenticated using (true) with check (true);
