-- Apify ingest support: brands now know which IG/TikTok handle to scrape, and
-- we record when the last successful Apify sync ran (so the dashboard can show
-- "Last synced X minutes ago"). top_posts gets a partial unique constraint on
-- post_url so re-running the ingest deduplicates against the source URL
-- without breaking older manually-logged rows that have no post_url.

alter table brands
  add column if not exists instagram_handle text,
  add column if not exists tiktok_handle text,
  add column if not exists last_apify_sync_at timestamptz;

-- Seed handles for the V1 brand (Kayan Sweets) so the Edge Function has
-- something to scrape on first call. The marketer can edit them in Settings
-- later if the handles ever change.
update brands
set instagram_handle = coalesce(instagram_handle, 'kayan_sweets'),
    tiktok_handle    = coalesce(tiktok_handle, 'kayan_sweets')
where brand_code = 'KAYAN';

-- Partial unique index so ingested posts upsert by URL while older manually
-- logged posts (post_url is null) keep working unchanged.
create unique index if not exists top_posts_brand_platform_url_key
  on top_posts (brand_id, platform, post_url)
  where post_url is not null;
