-- Adds 'both' as a valid assignee value across calendar_entries, tasks, and
-- campaign_branch_rollouts. Lets a single task / entry / rollout be co-owned
-- by Junaid + Ammar; the Today docket renders such items in both columns.
--
-- Drops + recreates the existing CHECK constraints (no in-place ALTER for
-- enum-style text checks).

alter table calendar_entries
  drop constraint if exists calendar_entries_assignee_check;
alter table calendar_entries
  add constraint calendar_entries_assignee_check
  check (assignee in ('junaid', 'ammar', 'both'));

alter table tasks
  drop constraint if exists tasks_assignee_check;
alter table tasks
  add constraint tasks_assignee_check
  check (assignee in ('junaid', 'ammar', 'both'));

alter table campaign_branch_rollouts
  drop constraint if exists campaign_branch_rollouts_lead_assignee_check;
alter table campaign_branch_rollouts
  add constraint campaign_branch_rollouts_lead_assignee_check
  check (lead_assignee in ('junaid', 'ammar', 'both'));
