import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

const PLATFORM_VALUES = ["tiktok", "instagram", "snapchat"] as const;
const METHOD_OPTIONS = "OPTIONS";
const ERROR_INTERNAL = "INTERNAL_ERROR";
const ERROR_NOT_FOUND = "NOT_FOUND";
const ERROR_VALIDATION = "VALIDATION_FAILED";
const MESSAGE_INVALID_JSON = "Invalid JSON.";
const MESSAGE_VALIDATION = "Validation failed.";
const STATUS_BAD_REQUEST = 400;
const STATUS_UNPROCESSABLE = 422;
const STATUS_NOT_FOUND = 404;
const STATUS_INTERNAL = 500;

const metricSchema = z.number().int().nonnegative().nullable().optional();

const createSchema = z.object({
  submissionId: z.string().uuid(),
  platform: z.enum(PLATFORM_VALUES),
  views: metricSchema,
  likes: metricSchema,
  comments: metricSchema,
  shares: metricSchema,
  reach: metricSchema,
  notes: z.string().trim().max(5000).nullable().optional(),
});

const updateSchema = z.object({
  views: metricSchema,
  likes: metricSchema,
  comments: metricSchema,
  shares: metricSchema,
  reach: metricSchema,
  notes: z.string().trim().max(5000).nullable().optional(),
});

Deno.serve(async (req) => {
  if (req.method === METHOD_OPTIONS) return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const baseIdx = pathParts.indexOf("influencer-performance");
  const logId = pathParts[baseIdx + 1] ?? null;
  const isCollection = logId === null;

  if (req.method === "GET" && isCollection) {
    const submissionId = url.searchParams.get("submissionId");
    let q = db
      .from("influencer_performance_logs")
      .select("*")
      .order("logged_at", { ascending: false });
    if (submissionId) q = q.eq("submission_id", submissionId);
    const { data, error } = await q;
    if (error) return jsonError(ERROR_INTERNAL, error.message, STATUS_INTERNAL);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "POST" && isCollection) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(ERROR_VALIDATION, MESSAGE_INVALID_JSON, STATUS_BAD_REQUEST);
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(ERROR_VALIDATION, MESSAGE_VALIDATION, STATUS_UNPROCESSABLE, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const { data: submission, error: submissionError } = await db
      .from("influencer_submissions")
      .select("id, influencer_id")
      .eq("id", parsed.data.submissionId)
      .single();

    if (submissionError || !submission) {
      return jsonError(ERROR_NOT_FOUND, "Submission not found.", STATUS_NOT_FOUND);
    }

    const { data, error } = await db
      .from("influencer_performance_logs")
      .insert({
        submission_id: parsed.data.submissionId,
        influencer_id: (submission as { influencer_id: string }).influencer_id,
        platform: parsed.data.platform,
        views: parsed.data.views ?? null,
        likes: parsed.data.likes ?? null,
        comments: parsed.data.comments ?? null,
        shares: parsed.data.shares ?? null,
        reach: parsed.data.reach ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select()
      .single();

    if (error) return jsonError(ERROR_INTERNAL, error.message, STATUS_INTERNAL);
    return jsonSuccess(toCamel(data), 201);
  }

  if (req.method === "PATCH" && logId) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(ERROR_VALIDATION, MESSAGE_INVALID_JSON, STATUS_BAD_REQUEST);
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(ERROR_VALIDATION, MESSAGE_VALIDATION, STATUS_UNPROCESSABLE, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const dbInput: Record<string, unknown> = {};
    if (parsed.data.views !== undefined) dbInput.views = parsed.data.views;
    if (parsed.data.likes !== undefined) dbInput.likes = parsed.data.likes;
    if (parsed.data.comments !== undefined) dbInput.comments = parsed.data.comments;
    if (parsed.data.shares !== undefined) dbInput.shares = parsed.data.shares;
    if (parsed.data.reach !== undefined) dbInput.reach = parsed.data.reach;
    if (parsed.data.notes !== undefined) dbInput.notes = parsed.data.notes;

    const { data, error } = await db
      .from("influencer_performance_logs")
      .update(dbInput)
      .eq("id", logId)
      .select()
      .single();

    if (error) return jsonError(ERROR_INTERNAL, error.message, STATUS_INTERNAL);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "DELETE" && logId) {
    const { error } = await db.from("influencer_performance_logs").delete().eq("id", logId);
    if (error) return jsonError(ERROR_INTERNAL, error.message, STATUS_INTERNAL);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return jsonError(ERROR_NOT_FOUND, "Route not found.", STATUS_NOT_FOUND);
});
