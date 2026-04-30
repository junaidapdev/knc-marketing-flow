-- Repair migration. Ensures the assignee CHECK constraints on
-- calendar_entries, tasks, and campaign_branch_rollouts include 'both' as
-- a valid value. This duplicates migration 0019 but is idempotent — safe
-- to apply on any database state, including ones where 0019 was either
-- never run or somehow got reverted (the user hit
-- "calendar_entries_assignee_check" violations after attempting to save an
-- entry whose task chain produced a mixed-assignee derived owner).

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
