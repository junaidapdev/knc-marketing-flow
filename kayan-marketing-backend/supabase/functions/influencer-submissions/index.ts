import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

const STATUS_VALUES = ["pending", "verified", "disputed"] as const;
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

const updateSchema = z
  .object({
    verificationStatus: z.enum(["verified", "disputed"]),
    disputeReason: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.verificationStatus === "disputed" && !data.disputeReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disputeReason"],
        message: "Dispute reason is required.",
      });
    }
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
  const baseIdx = pathParts.indexOf("influencer-submissions");
  const submissionId = pathParts[baseIdx + 1] ?? null;
  const isCollection = submissionId === null;

  if (req.method === "GET" && isCollection) {
    const status = url.searchParams.get("status");
    const influencerId = url.searchParams.get("influencerId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let q = db
      .from("influencer_submissions")
      .select(
        [
          "*",
          "influencer:influencers(id, display_name)",
          "entry:calendar_entries(id, title, target_date, status)",
          // Join performance logs so the Influencer Detail page can
          // aggregate totals client-side without an N+1 fetch per
          // submission. List items carry the same performanceLogs
          // array shape as the detail endpoint.
          "performance_logs:influencer_performance_logs(*)",
        ].join(","),
      )
      .order("submitted_at", { ascending: false });

    if (status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])) {
      q = q.eq("verification_status", status);
    }
    if (influencerId) q = q.eq("influencer_id", influencerId);
    if (from) q = q.gte("submitted_at", from);
    if (to) q = q.lte("submitted_at", to);

    const { data, error } = await q;
    if (error) return jsonError(ERROR_INTERNAL, error.message, STATUS_INTERNAL);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "GET" && submissionId) {
    const { data, error } = await db
      .from("influencer_submissions")
      .select(
        [
          "*",
          "influencer:influencers(*)",
          "entry:calendar_entries(*)",
          "performanceLogs:influencer_performance_logs(*)",
        ].join(","),
      )
      .eq("id", submissionId)
      .single();

    if (error) return jsonError(ERROR_NOT_FOUND, "Submission not found.", STATUS_NOT_FOUND);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "PATCH" && submissionId) {
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

    const { data, error } = await db.rpc("update_influencer_submission_verification", {
      p_submission_id: submissionId,
      p_verification_status: parsed.data.verificationStatus,
      p_dispute_reason: parsed.data.disputeReason ?? null,
      p_verified_by: parsed.data.verificationStatus === "verified" ? auth.userId : null,
    });

    if (error) return jsonError(ERROR_VALIDATION, error.message, STATUS_UNPROCESSABLE);
    return jsonSuccess(toCamel(data));
  }

  return jsonError(ERROR_NOT_FOUND, "Route not found.", STATUS_NOT_FOUND);
});
