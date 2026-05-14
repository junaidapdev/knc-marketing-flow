-- Migration 0052: Backfill all-platforms for existing content entries.
--
-- Why
-- ---
-- Migration 0050 honestly preserved old data: each old per-platform entry
-- (instagram_reel, tiktok_video, etc.) became one entry with one publication
-- row for the platform it was originally stored under. But Kayan's reality
-- has always been "one shoot, all three platforms" — the old schema just
-- couldn't capture that. Reports therefore show e.g. "Videos: TikTok 1 ·
-- Instagram 5 · Snapchat 0" when the truth is closer to 6 / 6 / 6.
--
-- This migration adds the missing publication rows so historical entries
-- match the workflow:
--   video  → tiktok + instagram + snapchat
--   story  → instagram + snapchat   (TikTok stories aren't a Kayan surface)
--
-- Idempotent
-- ----------
-- Uses INSERT … ON CONFLICT (entry_id, platform) DO NOTHING. Re-running
-- the migration is a no-op. Existing publication rows (including any with
-- post_url already filled in) are preserved untouched.
--
-- Reversibility
-- -------------
-- Not automatically reversible — there's no signal in the data of which
-- rows were the original vs. backfilled. If you need to roll back, do it
-- manually with a DELETE FROM entry_publications WHERE post_url IS NULL
-- AND created_at >= '<this migration's run-at>' or similar.

begin;

-- Videos → all three platforms
insert into entry_publications (entry_id, platform)
select e.id, p.platform
from calendar_entries e
cross join (
  values ('tiktok'), ('instagram'), ('snapchat')
) as p(platform)
where e.format = 'video'
on conflict (entry_id, platform) do nothing;

-- Stories → Instagram + Snapchat
insert into entry_publications (entry_id, platform)
select e.id, p.platform
from calendar_entries e
cross join (
  values ('instagram'), ('snapchat')
) as p(platform)
where e.format = 'story'
on conflict (entry_id, platform) do nothing;

commit;
