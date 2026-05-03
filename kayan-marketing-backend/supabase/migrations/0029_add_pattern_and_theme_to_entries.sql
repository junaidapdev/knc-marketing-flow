-- Migration 0029: Tag calendar entries with pattern + theme.
--
-- pattern_id  → references the Recipe Book V2 patterns (P1–P9), kept in code
--               constants (kayan-marketing-frontend/src/constants/patterns.ts +
--               backend mirror). Deliberately NO foreign key — patterns evolve
--               in code, not in a DB table for V1.
-- theme       → free-form short string for the focus product/topic of the
--               entry (e.g. "Japanese cake new flavors", "imported chocolates
--               aisle", "Mother's Day gifts"). Helps the AI generator target
--               the prompt at a specific angle.
--
-- Both nullable, no backfill — existing rows stay null.
-- Idempotent: `if not exists` so re-running is safe.

alter table calendar_entries
  add column if not exists pattern_id text,
  add column if not exists theme text;

-- Index on pattern_id helps "all entries using P1" lookups (analytics + the
-- forthcoming pattern dashboard). Partial index keeps it small — most
-- existing entries won't have a pattern set.
create index if not exists idx_calendar_entries_pattern_id
  on calendar_entries(pattern_id)
  where pattern_id is not null;
