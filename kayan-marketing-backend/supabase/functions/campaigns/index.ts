import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

const CAMPAIGN_TYPE_VALUES = [
  "offer",
  "event",
  "reward",
  "seasonal",
  "awareness",
  "other",
] as const;
const CAMPAIGN_STATUS_VALUES = ["planned", "active", "completed", "cancelled"] as const;
const ASSIGNEE_VALUES = ["junaid", "ammar", "both"] as const;
const AD_PLATFORM_VALUES = ["tiktok", "snapchat", "instagram"] as const;
const AD_OBJECTIVE_VALUES = ["awareness", "conversion", "traffic"] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const rolloutSchema = z.object({
  branchId: z.string().uuid(),
  branchName: z.string().min(1),
  rolloutDate: z.string().regex(DATE_REGEX),
  leadAssignee: z.enum(ASSIGNEE_VALUES),
  notes: z.string().nullable().optional(),
});

const adLineSchema = z
  .object({
    platform: z.enum(AD_PLATFORM_VALUES),
    startDate: z.string().regex(DATE_REGEX),
    endDate: z.string().regex(DATE_REGEX),
    budget: z.number().nonnegative(),
    objective: z.enum(AD_OBJECTIVE_VALUES).nullable().optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "endDate must be on or after startDate.",
    path: ["endDate"],
  });

const createSchema = z
  .object({
    brandId: z.string().uuid(),
    name: z.string().min(3).max(200),
    campaignType: z.enum(CAMPAIGN_TYPE_VALUES),
    status: z.enum(CAMPAIGN_STATUS_VALUES).default("planned"),
    startDate: z.string().regex(DATE_REGEX),
    endDate: z.string().regex(DATE_REGEX),
    totalBudget: z.number().nonnegative().default(0),
    offerTrigger: z.string().nullable().optional(),
    offerReward: z.string().nullable().optional(),
    promoCode: z.string().nullable().optional(),
    customFields: z.record(z.unknown()).optional(),
    notes: z.string().nullable().optional(),
    branchRollouts: z.array(rolloutSchema).default([]),
    adSpendLines: z.array(adLineSchema).default([]),
    autoCreateEntries: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate must be on or after startDate.",
      });
    }
    data.branchRollouts.forEach((r, i) => {
      if (r.rolloutDate < data.startDate || r.rolloutDate > data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["branchRollouts", i, "rolloutDate"],
          message: "Rollout date must be within the campaign window.",
        });
      }
    });
    data.adSpendLines.forEach((a, i) => {
      if (a.startDate < data.startDate || a.endDate > data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["adSpendLines", i],
          message: "Ad spend window must fall within the campaign window.",
        });
      }
    });
  });

const updateSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  campaignType: z.enum(CAMPAIGN_TYPE_VALUES).optional(),
  status: z.enum(CAMPAIGN_STATUS_VALUES).optional(),
  startDate: z.string().regex(DATE_REGEX).optional(),
  endDate: z.string().regex(DATE_REGEX).optional(),
  totalBudget: z.number().nonnegative().optional(),
  totalSpent: z.number().nonnegative().optional(),
  offerTrigger: z.string().nullable().optional(),
  offerReward: z.string().nullable().optional(),
  promoCode: z.string().nullable().optional(),
  customFields: z.record(z.unknown()).optional(),
  results: z.record(z.unknown()).optional(),
  notes: z.string().nullable().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1] ?? "";
  const isCollection = lastPart === "campaigns";
  const campaignId = isCollection ? null : lastPart;

  if (req.method === "GET" && isCollection) {
    const statusFilter = url.searchParams.get("status");
    let q = db.from("campaigns").select("*").order("start_date", { ascending: false });
    if (statusFilter) q = q.eq("status", statusFilter);
    const { data, error } = await q;
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "GET" && campaignId) {
    const { data, error } = await db
      .from("campaigns")
      .select("*, campaign_branch_rollouts(*), campaign_ad_spend(*)")
      .eq("id", campaignId)
      .single();
    if (error) return jsonError("NOT_FOUND", error.message, 404);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "POST" && isCollection) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("VALIDATION_FAILED", "Invalid JSON.", 400);
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const { data, error } = await db.rpc("create_campaign_with_artifacts", {
      p_brand_id: parsed.data.brandId,
      p_name: parsed.data.name,
      p_campaign_type: parsed.data.campaignType,
      p_status: parsed.data.status,
      p_start_date: parsed.data.startDate,
      p_end_date: parsed.data.endDate,
      p_total_budget: parsed.data.totalBudget,
      p_offer_trigger: parsed.data.offerTrigger ?? null,
      p_offer_reward: parsed.data.offerReward ?? null,
      p_promo_code: parsed.data.promoCode ?? null,
      p_custom_fields: parsed.data.customFields ?? {},
      p_notes: parsed.data.notes ?? null,
      p_branch_rollouts: parsed.data.branchRollouts,
      p_ad_spend_lines: parsed.data.adSpendLines,
      p_auto_create_entries: parsed.data.autoCreateEntries,
    });

    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data), 201);
  }

  if (req.method === "PATCH" && campaignId) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("VALIDATION_FAILED", "Invalid JSON.", 400);
    }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const dbInput: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) dbInput.name = parsed.data.name;
    if (parsed.data.campaignType !== undefined) dbInput.campaign_type = parsed.data.campaignType;
    if (parsed.data.status !== undefined) dbInput.status = parsed.data.status;
    if (parsed.data.startDate !== undefined) dbInput.start_date = parsed.data.startDate;
    if (parsed.data.endDate !== undefined) dbInput.end_date = parsed.data.endDate;
    if (parsed.data.totalBudget !== undefined) dbInput.total_budget = parsed.data.totalBudget;
    if (parsed.data.totalSpent !== undefined) dbInput.total_spent = parsed.data.totalSpent;
    if (parsed.data.offerTrigger !== undefined) dbInput.offer_trigger = parsed.data.offerTrigger;
    if (parsed.data.offerReward !== undefined) dbInput.offer_reward = parsed.data.offerReward;
    if (parsed.data.promoCode !== undefined) dbInput.promo_code = parsed.data.promoCode;
    if (parsed.data.customFields !== undefined) dbInput.custom_fields = parsed.data.customFields;
    if (parsed.data.results !== undefined) dbInput.results = parsed.data.results;
    if (parsed.data.notes !== undefined) dbInput.notes = parsed.data.notes;

    const { data, error } = await db
      .from("campaigns")
      .update(dbInput)
      .eq("id", campaignId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "DELETE" && campaignId) {
    const { error } = await db.from("campaigns").delete().eq("id", campaignId);
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return jsonError("NOT_FOUND", "Route not found.", 404);
});
