import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonError, jsonSuccess } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

// Manual-refresh ingest: call Apify scrapers for Instagram + TikTok in
// parallel, then upsert today's follower snapshot + the latest posts.
// Snap is intentionally skipped — public Snap scraping isn't reliable.
//
// Architecture choices:
//   - Use Apify's `run-sync-get-dataset-items` endpoint so we get a single
//     blocking call per actor instead of having to poll. 30 posts of one
//     profile typically finishes in 15-25 seconds — well inside Supabase
//     Edge Function wall time.
//   - We use Promise.allSettled so a TikTok failure doesn't cancel a
//     successful Instagram pull, and vice versa.
//   - Posts upsert by (brand_id, platform, post_url) — the unique partial
//     index in migration 0023 — so re-runs don't dupe.

const APIFY_BASE = "https://api.apify.com/v2";
const IG_ACTOR = "apify~instagram-profile-scraper";
const TIKTOK_ACTOR = "clockworks~tiktok-scraper";
// We tell Apify to wait up to ~3 min before returning. That's fine — Supabase
// Edge Functions get plenty of wall time to hold the connection open.
const SYNC_TIMEOUT_SEC = 180;

interface InstagramPost {
  id?: string;
  shortCode?: string;
  caption?: string | null;
  url?: string;
  displayUrl?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  timestamp?: string; // ISO
  type?: string;
}
interface InstagramProfileItem {
  username?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  latestPosts?: InstagramPost[];
}

interface TikTokAuthorMeta {
  name?: string;
  fans?: number; // followers
  heart?: number; // total likes across account
  video?: number; // post count
}
interface TikTokVideoItem {
  id?: string;
  text?: string | null;
  webVideoUrl?: string;
  createTimeISO?: string;
  authorMeta?: TikTokAuthorMeta;
  videoMeta?: { coverUrl?: string };
  diggCount?: number; // likes
  shareCount?: number;
  playCount?: number; // views
  commentCount?: number;
}

interface IngestSummary {
  platform: "instagram" | "tiktok";
  handle: string;
  followers: number | null;
  postsIngested: number;
  error?: string;
}

async function fetchApify<T>(actor: string, token: string, input: unknown): Promise<T[]> {
  const url = `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=${SYNC_TIMEOUT_SEC}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify ${actor} ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T[];
}

function todayDateString(): string {
  // Use UTC for consistency with stored snapshot_date column (date type).
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError("NOT_FOUND", "Method not supported.", 404);

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const apifyToken = Deno.env.get("APIFY_API_TOKEN") ?? "";
  if (!apifyToken) return jsonError("INTERNAL_ERROR", "APIFY_API_TOKEN not configured.", 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  // V1 single-tenant — first brand. Dashboard reads handles from `brands`.
  const { data: brand, error: brandErr } = await db
    .from("brands")
    .select("id, instagram_handle, tiktok_handle")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (brandErr || !brand) {
    return jsonError("INTERNAL_ERROR", brandErr?.message ?? "Brand not found.", 500);
  }
  const brandId = brand.id as string;
  const igHandle = (brand.instagram_handle as string | null) ?? null;
  const ttHandle = (brand.tiktok_handle as string | null) ?? null;

  const today = todayDateString();
  const summaries: IngestSummary[] = [];

  // Run both scrapers in parallel — independent of each other.
  const [igRes, ttRes] = await Promise.allSettled([
    igHandle
      ? fetchApify<InstagramProfileItem>(IG_ACTOR, apifyToken, { usernames: [igHandle] })
      : Promise.reject(new Error("No Instagram handle on brand.")),
    ttHandle
      ? fetchApify<TikTokVideoItem>(TIKTOK_ACTOR, apifyToken, {
          profiles: [ttHandle],
          resultsPerPage: 30,
        })
      : Promise.reject(new Error("No TikTok handle on brand.")),
  ]);

  // ---------- Instagram ----------
  if (igRes.status === "fulfilled" && igRes.value.length > 0) {
    const profile = igRes.value[0];
    const followers = profile.followersCount ?? null;
    const posts = (profile.latestPosts ?? []).slice(0, 30);

    // Aggregate engagement totals across the latest posts so the snapshot
    // captures recent activity volume, not lifetime totals.
    const totals = posts.reduce(
      (acc, p) => ({
        likes: acc.likes + (p.likesCount ?? 0),
        comments: acc.comments + (p.commentsCount ?? 0),
        views: acc.views + (p.videoViewCount ?? 0),
      }),
      { likes: 0, comments: 0, views: 0 },
    );

    const snapshotErr = await db.from("performance_snapshots").upsert(
      {
        brand_id: brandId,
        snapshot_date: today,
        platform: "instagram",
        followers,
        total_views: totals.views || null,
        total_likes: totals.likes,
        total_comments: totals.comments,
      },
      { onConflict: "brand_id,snapshot_date,platform" },
    );
    if (snapshotErr.error) {
      summaries.push({
        platform: "instagram",
        handle: igHandle ?? "",
        followers,
        postsIngested: 0,
        error: snapshotErr.error.message,
      });
    } else {
      // Upsert each post by URL so re-runs are idempotent.
      const postRows = posts
        .filter((p) => p.url)
        .map((p) => ({
          brand_id: brandId,
          platform: "instagram" as const,
          post_url: p.url ?? "",
          post_date: p.timestamp ? p.timestamp.slice(0, 10) : today,
          caption_snippet: (p.caption ?? "").slice(0, 280),
          plays: p.videoViewCount ?? null,
          likes: p.likesCount ?? null,
          comments: p.commentsCount ?? null,
          thumbnail_url: p.displayUrl ?? null,
          engagement_rate:
            followers && followers > 0
              ? Number((((p.likesCount ?? 0) + (p.commentsCount ?? 0)) / followers * 100).toFixed(2))
              : null,
        }));

      if (postRows.length > 0) {
        const postsRes = await db.from("top_posts").upsert(postRows, {
          onConflict: "brand_id,platform,post_url",
        });
        if (postsRes.error) {
          summaries.push({
            platform: "instagram",
            handle: igHandle ?? "",
            followers,
            postsIngested: 0,
            error: postsRes.error.message,
          });
        } else {
          summaries.push({
            platform: "instagram",
            handle: igHandle ?? "",
            followers,
            postsIngested: postRows.length,
          });
        }
      } else {
        summaries.push({
          platform: "instagram",
          handle: igHandle ?? "",
          followers,
          postsIngested: 0,
        });
      }
    }
  } else {
    summaries.push({
      platform: "instagram",
      handle: igHandle ?? "",
      followers: null,
      postsIngested: 0,
      error: igRes.status === "rejected" ? String(igRes.reason).slice(0, 300) : "Empty Apify response.",
    });
  }

  // ---------- TikTok ----------
  if (ttRes.status === "fulfilled" && ttRes.value.length > 0) {
    const videos = ttRes.value.slice(0, 30);
    // Follower count is duplicated on every video's authorMeta — take the
    // first non-null occurrence as the canonical value for today.
    const followers = videos.find((v) => v.authorMeta?.fans != null)?.authorMeta?.fans ?? null;

    const totals = videos.reduce(
      (acc, v) => ({
        plays: acc.plays + (v.playCount ?? 0),
        likes: acc.likes + (v.diggCount ?? 0),
        comments: acc.comments + (v.commentCount ?? 0),
        shares: acc.shares + (v.shareCount ?? 0),
      }),
      { plays: 0, likes: 0, comments: 0, shares: 0 },
    );

    const snapshotErr = await db.from("performance_snapshots").upsert(
      {
        brand_id: brandId,
        snapshot_date: today,
        platform: "tiktok",
        followers,
        total_views: totals.plays,
        total_likes: totals.likes,
        total_comments: totals.comments,
        total_shares: totals.shares,
      },
      { onConflict: "brand_id,snapshot_date,platform" },
    );
    if (snapshotErr.error) {
      summaries.push({
        platform: "tiktok",
        handle: ttHandle ?? "",
        followers,
        postsIngested: 0,
        error: snapshotErr.error.message,
      });
    } else {
      const postRows = videos
        .filter((v) => v.webVideoUrl)
        .map((v) => ({
          brand_id: brandId,
          platform: "tiktok" as const,
          post_url: v.webVideoUrl ?? "",
          post_date: v.createTimeISO ? v.createTimeISO.slice(0, 10) : today,
          caption_snippet: (v.text ?? "").slice(0, 280),
          plays: v.playCount ?? null,
          likes: v.diggCount ?? null,
          comments: v.commentCount ?? null,
          shares: v.shareCount ?? null,
          thumbnail_url: v.videoMeta?.coverUrl ?? null,
          engagement_rate:
            followers && followers > 0
              ? Number((((v.diggCount ?? 0) + (v.commentCount ?? 0) + (v.shareCount ?? 0)) / followers * 100).toFixed(2))
              : null,
        }));

      if (postRows.length > 0) {
        const postsRes = await db.from("top_posts").upsert(postRows, {
          onConflict: "brand_id,platform,post_url",
        });
        if (postsRes.error) {
          summaries.push({
            platform: "tiktok",
            handle: ttHandle ?? "",
            followers,
            postsIngested: 0,
            error: postsRes.error.message,
          });
        } else {
          summaries.push({
            platform: "tiktok",
            handle: ttHandle ?? "",
            followers,
            postsIngested: postRows.length,
          });
        }
      } else {
        summaries.push({
          platform: "tiktok",
          handle: ttHandle ?? "",
          followers,
          postsIngested: 0,
        });
      }
    }
  } else {
    summaries.push({
      platform: "tiktok",
      handle: ttHandle ?? "",
      followers: null,
      postsIngested: 0,
      error: ttRes.status === "rejected" ? String(ttRes.reason).slice(0, 300) : "Empty Apify response.",
    });
  }

  // Stamp the brand even if one platform errored — the other side may still
  // have produced a fresh snapshot.
  const anySuccess = summaries.some((s) => !s.error);
  if (anySuccess) {
    await db.from("brands").update({ last_apify_sync_at: new Date().toISOString() }).eq("id", brandId);
  }

  return jsonSuccess({
    syncedAt: new Date().toISOString(),
    summaries,
  });
});
