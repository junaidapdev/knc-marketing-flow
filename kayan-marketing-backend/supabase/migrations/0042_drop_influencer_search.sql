-- Migration 0042: drop the Influencer Search feature.
--
-- The feature was built across migrations 0039 / 0040 / 0041 and removed on
-- 2026-05-06 — TikTok user search via Apify was too slow to fit inside
-- Supabase's gateway IDLE_TIMEOUT without an async-polling refactor.
-- Migrations 0039-0041 are kept for historical record; this one undoes
-- their schema effects on existing DBs.
--
-- Drop order matters: child tables first (saved_creators and
-- creator_search_costs FK creator_results, which FKs creator_searches).

drop table if exists saved_creators;
drop table if exists creator_search_costs;
drop table if exists creator_results;
drop table if exists creator_searches;
