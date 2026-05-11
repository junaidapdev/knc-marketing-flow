import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonError } from "./response.ts";
import type { PortalInfluencerRecord } from "./portal-types.ts";

const PORTAL_PATH_SEGMENT = "portal";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000;
const UNKNOWN_IP = "unknown";
const HEADER_FORWARDED_FOR = "x-forwarded-for";
const HEADER_REAL_IP = "x-real-ip";
const HEADER_CF_CONNECTING_IP = "cf-connecting-ip";
const ERROR_UNAUTHORIZED = "UNAUTHORIZED";
const ERROR_RATE_LIMITED = "RATE_LIMITED";
const ERROR_INTERNAL = "INTERNAL_ERROR";
const MESSAGE_UNAUTHORIZED = "Invalid portal link.";
const MESSAGE_RATE_LIMITED = "Too many requests.";
const MESSAGE_CONFIG = "Server configuration error.";
const STATUS_UNAUTHORIZED = 401;
const STATUS_RATE_LIMITED = 429;
const STATUS_INTERNAL = 500;

interface RateLimitBucket {
  windowStart: number;
  count: number;
}

const requestBuckets = new Map<string, RateLimitBucket>();
let lastCleanupAt = 0;

function unauthorized(): Response {
  return jsonError(
    ERROR_UNAUTHORIZED,
    MESSAGE_UNAUTHORIZED,
    STATUS_UNAUTHORIZED,
  );
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get(HEADER_FORWARDED_FOR);
  if (forwarded) return forwarded.split(",")[0].trim() || UNKNOWN_IP;
  return (
    req.headers.get(HEADER_CF_CONNECTING_IP) ??
    req.headers.get(HEADER_REAL_IP) ??
    UNKNOWN_IP
  );
}

function cleanupBuckets(now: number): void {
  if (now - lastCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [ip, bucket] of requestBuckets.entries()) {
    if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
      requestBuckets.delete(ip);
    }
  }
}

function rateLimit(req: Request): Response | null {
  const now = Date.now();
  cleanupBuckets(now);

  const ip = getClientIp(req);
  const bucket = requestBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    requestBuckets.set(ip, { windowStart: now, count: 1 });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    return jsonError(
      ERROR_RATE_LIMITED,
      MESSAGE_RATE_LIMITED,
      STATUS_RATE_LIMITED,
    );
  }
  return null;
}

function getTokenFromPath(req: Request): string | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const portalIndex = parts.indexOf(PORTAL_PATH_SEGMENT);
  const token = portalIndex >= 0 ? parts[portalIndex + 1] : null;
  if (!token) return null;
  return decodeURIComponent(token).trim() || null;
}

export async function requirePortalToken(
  req: Request,
): Promise<{ influencer: PortalInfluencerRecord } | { error: Response }> {
  const limited = rateLimit(req);
  if (limited) return { error: limited };

  const token = getTokenFromPath(req);
  if (!token) return { error: unauthorized() };

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return {
      error: jsonError(ERROR_INTERNAL, MESSAGE_CONFIG, STATUS_INTERNAL),
    };
  }

  const db = createClient(supabaseUrl, serviceKey);
  const { data, error } = await db
    .from("influencers")
    .select(
      [
        "id",
        "display_name",
        "city",
        "tiktok_handle",
        "tiktok_url",
        "tiktok_followers",
        "instagram_handle",
        "instagram_url",
        "instagram_followers",
        "snapchat_handle",
        "snapchat_url",
        "snapchat_followers",
        "niche_tags",
        "languages",
        // Pulled so we can gate paused / blacklisted creators out of
        // the portal without leaking *why* (same opaque 401 as invalid
        // tokens). Admins control portal access through status.
        "status",
      ].join(","),
    )
    .eq("portal_token", token)
    .not("portal_activated_at", "is", null)
    .single();

  if (error || !data) return { error: unauthorized() };
  if ((data as { status?: string }).status !== "active") {
    return { error: unauthorized() };
  }
  return { influencer: data as unknown as PortalInfluencerRecord };
}
