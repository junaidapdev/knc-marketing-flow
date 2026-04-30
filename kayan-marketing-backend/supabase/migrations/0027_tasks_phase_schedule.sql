-- Adds 'schedule' to the tasks.phase CHECK constraint. The batch-mode task
-- chain ends with a "Schedule on Instagram/TikTok" task that has phase
-- 'schedule', a new value introduced in migration 0025. The original
-- constraint from migration 0007 didn't know about it, so any batch-mode
-- entry creation rejects with tasks_phase_check.

alter table tasks
  drop constraint if exists tasks_phase_check;

alter table tasks
  add constraint tasks_phase_check
  check (phase in (
    'script', 'shoot', 'edit', 'post', 'schedule',
    'plan', 'setup', 'wrap',
    'brief', 'review', 'track',
    'communicate', 'activate',
    'custom'
  ));
