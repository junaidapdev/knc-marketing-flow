-- Migration 0040: failure_reasons[] on creator_searches.
--
-- Records partial-failure state when one platform actor errors but others
-- succeed. Lets the UI surface a small "couldn't fetch from <platform>"
-- warning above the results without the whole search being marked failed.
--
-- Idempotent: `add column if not exists`.

alter table creator_searches
  add column if not exists failure_reasons text[] not null default '{}'::text[];
