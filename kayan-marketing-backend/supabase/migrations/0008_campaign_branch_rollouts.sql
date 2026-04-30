create table campaign_branch_rollouts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  rollout_date date not null,
  lead_assignee text not null check (lead_assignee in ('junaid', 'ammar')),
  status text not null default 'planned' check (status in ('planned', 'active', 'done', 'skipped')),
  calendar_entry_id uuid references calendar_entries(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_rollouts_campaign_id on campaign_branch_rollouts(campaign_id);
create index idx_rollouts_branch_date on campaign_branch_rollouts(branch_id, rollout_date);

create trigger rollouts_set_updated_at before update on campaign_branch_rollouts
  for each row execute function set_updated_at();

alter table campaign_branch_rollouts enable row level security;
create policy "authenticated_full_access" on campaign_branch_rollouts
  for all to authenticated using (true) with check (true);
