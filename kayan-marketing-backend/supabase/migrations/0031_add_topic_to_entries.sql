-- Migration 0031: Trace which topic produced an entry.
--
-- Inverse of topics.used_for_entry_id (added in 0030). Together they let us
-- show "this entry came from this topic" on the entry detail panel and
-- "this topic was used here" on the topic queue.
--
-- ON DELETE SET NULL: if a topic is hard-deleted, the spawned entry stays —
-- the link just goes stale. Most flows should set status='archived' on the
-- topic instead of deleting; the SET NULL is a safety net.
--
-- Idempotent: `add column if not exists`.

alter table calendar_entries
  add column if not exists source_topic_id uuid
    references topics(id) on delete set null;

create index if not exists idx_calendar_entries_source_topic_id
  on calendar_entries(source_topic_id)
  where source_topic_id is not null;
