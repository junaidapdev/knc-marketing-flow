import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

const METHOD_GET = "GET";
const METHOD_OPTIONS = "OPTIONS";
const ROUTE_REPORTS = "reports";
const ROUTE_SUMMARY = "summary";
const RPC_GET_REPORT_SUMMARY = "get_report_summary";
const KAYAN_BRAND_ID = "11111111-1111-1111-1111-111111111111";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const REPORT_MAX_RANGE_DAYS = 365;
const REPORT_CACHE_TTL_SECONDS = 300;
const REPORT_CACHE_TTL_MS = REPORT_CACHE_TTL_SECONDS * 1000;
const REPORT_CACHE_CLEANUP_INTERVAL_MS = 60_000;
const STATUS_OK = 200;
const STATUS_NOT_FOUND = 404;
const STATUS_UNPROCESSABLE = 422;
const STATUS_INTERNAL = 500;
const ERROR_VALIDATION = "VALIDATION_FAILED";
const ERROR_NOT_FOUND = "NOT_FOUND";
const ERROR_INTERNAL = "INTERNAL_ERROR";
const MESSAGE_INVALID_JSON = "Invalid query.";
const MESSAGE_METHOD_NOT_SUPPORTED = "Method not supported.";
const MESSAGE_ROUTE_NOT_FOUND = "Route not found.";
const MESSAGE_SERVER_CONFIG = "Server configuration error.";
const MESSAGE_SUMMARY_EMPTY = "Report summary response was empty.";
const CACHE_NONE = "none";

type ReportPlatform = "tiktok" | "instagram" | "snapchat";

interface PlatformBreakdown {
  tiktok: number;
  instagram: number;
  snapchat: number;
}

interface ReportPeriod {
  from: string;
  to: string;
  label: string;
  daysCount: number;
}

interface ReportSummaryBase {
  period: ReportPeriod;
  generatedAt: string;
  content: {
    totalPosted: number;
    videosTotal: number;
    storiesTotal: number;
    // One shoot = one entry; same shoot can land on 1-3 platforms via
    // entry_publications. These three counts answer "how many videos / stories
    // / total publications hit each platform during the range."
    videosByPlatform: PlatformBreakdown;
    storiesByPlatform: PlatformBreakdown;
    postsByPlatform: PlatformBreakdown;
  };
  activities: {
    shopActivities: number;
    offers: number;
    influencerCollabs: number;
    generalTasks: number;
  };
  campaigns: {
    activeDuringPeriod: number;
    completedDuringPeriod: number;
    topCampaign: {
      id: string;
      name: string;
      entriesCount: number;
    } | null;
  };
  influencers: {
    totalCollabs: number;
    submissionsReceived: number;
    verified: number;
    pending: number;
    disputed: number;
    notSubmittedYet: number;
  };
  performance: {
    coverage: {
      totalPosted: number;
      withPerformanceLogged: number;
      percentage: number;
      belowThreshold: boolean;
    };
    totals: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
      reach: number;
    } | null;
    topPlatform: ReportPlatform | null;
  };
}

interface ReportComparison {
  previousPeriod: {
    from: string;
    to: string;
    label: string;
  };
  deltas: {
    videosTotal: number;
    storiesTotal: number;
    shopActivities: number;
    influencerCollabs: number;
    performanceViews: number | null;
  };
}

interface ReportSummary extends ReportSummaryBase {
  comparison: ReportComparison | null;
}

interface SummaryParams {
  from: string;
  to: string;
  compareToPrevious: boolean;
  campaignId?: string;
  branchId?: string;
}

interface CacheEntry {
  expiresAt: number;
  data: ReportSummary;
}

interface RpcError {
  message: string;
}

interface RpcClient {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: RpcError | null }>;
}

const reportCache = new Map<string, CacheEntry>();
let lastCacheCleanupAt = 0;

const booleanQueryParam = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().default(false));

function isValidIsoDate(value: string): boolean {
  const parsed = parseIsoDate(value);
  return !Number.isNaN(parsed.getTime()) && isoDate(parsed) === value;
}

const dateParam = z
  .string()
  .regex(DATE_RE, "Must be YYYY-MM-DD.")
  .refine(isValidIsoDate, "Must be a valid calendar date.");

const querySchema = z
  .object({
    from: dateParam,
    to: dateParam,
    compareToPrevious: booleanQueryParam,
    campaignId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    const fromMs = parseIsoDate(data.from).getTime();
    const toMs = parseIsoDate(data.to).getTime();

    if (toMs < fromMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "End date must be on or after start date.",
      });
      return;
    }

    if (inclusiveDays(data.from, data.to) > REPORT_MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "Report range cannot exceed 365 days.",
      });
    }
  });

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function inclusiveDays(from: string, to: string): number {
  const fromMs = parseIsoDate(from).getTime();
  const toMs = parseIsoDate(to).getTime();
  return Math.floor((toMs - fromMs) / MS_PER_DAY) + 1;
}

function isCalendarMonth(from: string, to: string): boolean {
  const fromDate = parseIsoDate(from);
  if (fromDate.getUTCDate() !== 1) return false;
  const lastDay = new Date(
    Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + 1, 0),
  );
  return isoDate(lastDay) === to;
}

function previousPeriod(params: SummaryParams): { from: string; to: string } {
  const fromDate = parseIsoDate(params.from);
  if (isCalendarMonth(params.from, params.to)) {
    const previousFrom = new Date(
      Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() - 1, 1),
    );
    const previousTo = new Date(
      Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 0),
    );
    return { from: isoDate(previousFrom), to: isoDate(previousTo) };
  }

  const daysCount = inclusiveDays(params.from, params.to);
  const previousTo = addDays(fromDate, -1);
  const previousFrom = addDays(previousTo, -(daysCount - 1));
  return { from: isoDate(previousFrom), to: isoDate(previousTo) };
}

function cacheKey(params: SummaryParams): string {
  return [
    "report",
    "summary",
    KAYAN_BRAND_ID,
    params.from,
    params.to,
    params.campaignId ?? CACHE_NONE,
    params.branchId ?? CACHE_NONE,
    params.compareToPrevious ? "compare" : "single",
  ].join(":");
}

function cleanupCache(now: number): void {
  if (now - lastCacheCleanupAt < REPORT_CACHE_CLEANUP_INTERVAL_MS) return;
  lastCacheCleanupAt = now;
  for (const [key, entry] of reportCache.entries()) {
    if (entry.expiresAt <= now) reportCache.delete(key);
  }
}

function getCached(key: string): ReportSummary | null {
  const now = Date.now();
  cleanupCache(now);
  const entry = reportCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    reportCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: ReportSummary): void {
  reportCache.set(key, {
    data,
    expiresAt: Date.now() + REPORT_CACHE_TTL_MS,
  });
}

function routeAfterReports(req: Request): string | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const reportsIndex = parts.indexOf(ROUTE_REPORTS);
  if (reportsIndex < 0) return null;
  return parts[reportsIndex + 1] ?? null;
}

function getServiceClient(): ReturnType<typeof createClient> | { error: Response } {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return {
      error: jsonError(ERROR_INTERNAL, MESSAGE_SERVER_CONFIG, STATUS_INTERNAL),
    };
  }
  return createClient(supabaseUrl, serviceKey);
}

async function fetchSummary(
  db: ReturnType<typeof createClient>,
  params: Pick<SummaryParams, "from" | "to" | "campaignId" | "branchId">,
): Promise<{ data: ReportSummaryBase } | { error: Response }> {
  const rpcClient = db as unknown as RpcClient;
  const { data, error } = await rpcClient.rpc(RPC_GET_REPORT_SUMMARY, {
    p_brand_id: KAYAN_BRAND_ID,
    p_from: params.from,
    p_to: params.to,
    p_campaign_id: params.campaignId ?? null,
    p_branch_id: params.branchId ?? null,
  });

  if (error) {
    return {
      error: jsonError(ERROR_INTERNAL, error.message, STATUS_INTERNAL),
    };
  }

  if (!data) {
    return {
      error: jsonError(ERROR_INTERNAL, MESSAGE_SUMMARY_EMPTY, STATUS_INTERNAL),
    };
  }

  return { data: toCamel<ReportSummaryBase>(data) };
}

function buildComparison(
  current: ReportSummaryBase,
  previous: ReportSummaryBase,
): ReportComparison {
  return {
    previousPeriod: {
      from: previous.period.from,
      to: previous.period.to,
      label: previous.period.label,
    },
    deltas: {
      videosTotal: current.content.videosTotal - previous.content.videosTotal,
      storiesTotal: current.content.storiesTotal - previous.content.storiesTotal,
      shopActivities:
        current.activities.shopActivities - previous.activities.shopActivities,
      influencerCollabs:
        current.activities.influencerCollabs - previous.activities.influencerCollabs,
      performanceViews:
        current.performance.totals && previous.performance.totals
          ? current.performance.totals.views - previous.performance.totals.views
          : null,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === METHOD_OPTIONS) {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  if (req.method !== METHOD_GET) {
    return jsonError(ERROR_NOT_FOUND, MESSAGE_METHOD_NOT_SUPPORTED, STATUS_NOT_FOUND);
  }

  if (routeAfterReports(req) !== ROUTE_SUMMARY) {
    return jsonError(ERROR_NOT_FOUND, MESSAGE_ROUTE_NOT_FOUND, STATUS_NOT_FOUND);
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    compareToPrevious: url.searchParams.get("compareToPrevious") ?? undefined,
    campaignId: url.searchParams.get("campaignId") ?? undefined,
    branchId: url.searchParams.get("branchId") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError(ERROR_VALIDATION, MESSAGE_INVALID_JSON, STATUS_UNPROCESSABLE, {
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const params = parsed.data;
  const key = cacheKey(params);
  const cached = getCached(key);
  if (cached) {
    return jsonSuccess(cached, STATUS_OK, {
      cached: true,
      cacheTtlSeconds: REPORT_CACHE_TTL_SECONDS,
    });
  }

  const db = getServiceClient();
  if ("error" in db) return db.error;

  const primary = await fetchSummary(db, params);
  if ("error" in primary) return primary.error;

  let comparison: ReportComparison | null = null;
  if (params.compareToPrevious) {
    const previousRange = previousPeriod(params);
    const previous = await fetchSummary(db, {
      from: previousRange.from,
      to: previousRange.to,
      campaignId: params.campaignId,
      branchId: params.branchId,
    });
    if ("error" in previous) return previous.error;
    comparison = buildComparison(primary.data, previous.data);
  }

  const summary: ReportSummary = {
    ...primary.data,
    comparison,
  };

  // V1 cache is per Edge Function instance and disappears on cold start.
  // Production should move this to a shared durable cache such as Redis or
  // a Supabase-backed cache table when report traffic grows.
  setCached(key, summary);

  return jsonSuccess(summary, STATUS_OK, {
    cached: false,
    cacheTtlSeconds: REPORT_CACHE_TTL_SECONDS,
  });
});
