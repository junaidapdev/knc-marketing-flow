-- Migration 0043: shot_directions column on calendar_entries.
--
-- Splits production direction (camera moves, on-screen overlays, sensory
-- shots) out of the spoken Script field into its own section. Marketers
-- + directors asked for this so the spoken script stays clean Saudi
-- Arabic for the talent reading it to camera, while the shot list lives
-- separately as a bilingual practical aid for the crew.
--
-- Existing entries default to NULL and are filled either manually or via
-- the next AI Generate run.

alter table calendar_entries
  add column if not exists shot_directions text;
