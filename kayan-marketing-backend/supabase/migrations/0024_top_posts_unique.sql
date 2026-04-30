-- Replace the partial unique index from 0023 with a plain unique constraint.
-- Postgres' ON CONFLICT can technically use a partial index, but only if the
-- INSERT also names the index's WHERE predicate — which PostgREST/supabase-js
-- don't do via `onConflict: "..."`. Without a fully-matching constraint, the
-- upsert in `performance-ingest` errors out.
--
-- A regular unique constraint on (brand_id, platform, post_url) is fine
-- because in standard SQL, NULL values are not considered equal — so older
-- manually-logged rows with NULL post_url do NOT conflict with each other.

drop index if exists top_posts_brand_platform_url_key;

-- Defensive: if any duplicate (brand_id, platform, post_url) rows exist from
-- the failed ingest attempts, keep only the most recent and discard the rest
-- so the constraint creation succeeds.
delete from top_posts t
using top_posts d
where t.id <> d.id
  and t.post_url is not null
  and t.brand_id = d.brand_id
  and t.platform = d.platform
  and t.post_url = d.post_url
  and t.created_at < d.created_at;

alter table top_posts
  add constraint top_posts_brand_platform_url_uq
  unique (brand_id, platform, post_url);
