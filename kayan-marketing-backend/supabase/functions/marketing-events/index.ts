import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

// Reference calendar for holidays, school breaks, and retail planning windows.
// Events are intentionally separate from campaigns: they provide context the
// marketer can plan around, and AI can read nearby events during generation.

const EVENT_TYPES = [
  "public_holiday",
  "religious_season",
  "school_calendar",
  "retail_season",
  "brand_opportunity",
] as const;

const IMPORTANCE_VALUES = ["mega", "major", "soft", "reference"] as const;
const STATUS_VALUES = ["active", "archived"] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const baseSchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().min(2).max(200),
  eventType: z.enum(EVENT_TYPES),
  importance: z.enum(IMPORTANCE_VALUES),
  startDate: z.string().regex(DATE_REGEX, "Must be YYYY-MM-DD"),
  endDate: z.string().regex(DATE_REGEX, "Must be YYYY-MM-DD"),
  description: z.string().max(2000).nullable().optional(),
  marketingNotes: z.string().max(5000).nullable().optional(),
  branchFocus: z.array(z.string().min(1).max(120)).max(30).default([]),
  sourceNote: z.string().max(1000).nullable().optional(),
  isDateEstimate: z.boolean().default(false),
  estimateReason: z.string().max(1000).nullable().optional(),
  status: z.enum(STATUS_VALUES).default("active"),
  metadata: z.record(z.unknown()).default({}),
});

const createSchema = baseSchema
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate.",
    path: ["endDate"],
  });

const updateSchema = baseSchema.partial().refine(
  (data) =>
    data.startDate === undefined ||
    data.endDate === undefined ||
    data.endDate >= data.startDate,
  {
    message: "endDate must be on or after startDate.",
    path: ["endDate"],
  },
);

function toDbInput(data: z.infer<typeof createSchema> | z.infer<typeof updateSchema>) {
  const out: Record<string, unknown> = {};
  if (data.brandId !== undefined) out.brand_id = data.brandId;
  if (data.title !== undefined) out.title = data.title;
  if (data.eventType !== undefined) out.event_type = data.eventType;
  if (data.importance !== undefined) out.importance = data.importance;
  if (data.startDate !== undefined) out.start_date = data.startDate;
  if (data.endDate !== undefined) out.end_date = data.endDate;
  if (data.description !== undefined) out.description = data.description ?? null;
  if (data.marketingNotes !== undefined) out.marketing_notes = data.marketingNotes ?? null;
  if (data.branchFocus !== undefined) out.branch_focus = data.branchFocus;
  if (data.sourceNote !== undefined) out.source_note = data.sourceNote ?? null;
  if (data.isDateEstimate !== undefined) out.is_date_estimate = data.isDateEstimate;
  if (data.estimateReason !== undefined) out.estimate_reason = data.estimateReason ?? null;
  if (data.status !== undefined) out.status = data.status;
  if (data.metadata !== undefined) out.metadata = data.metadata;
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const baseIdx = pathParts.indexOf("marketing-events");
  const eventId = pathParts[baseIdx + 1] ?? null;
  const isCollection = eventId === null;

  // GET /marketing-events?brandId=&from=&to=&importance=&eventType=
  if (req.method === "GET" && isCollection) {
    const brandId = url.searchParams.get("brandId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const importance = url.searchParams.get("importance");
    const eventType = url.searchParams.get("eventType");
    const includeArchived = url.searchParams.get("includeArchived") === "true";

    let q = db
      .from("marketing_events")
      .select("*")
      .order("start_date", { ascending: true })
      .order("importance", { ascending: true });

    if (brandId) q = q.eq("brand_id", brandId);
    if (!includeArchived) q = q.eq("status", "active");
    if (from) q = q.gte("end_date", from);
    if (to) q = q.lte("start_date", to);
    if (importance) q = q.eq("importance", importance);
    if (eventType) q = q.eq("event_type", eventType);

    const { data, error } = await q;
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  // GET /marketing-events/:id
  if (req.method === "GET" && eventId) {
    const { data, error } = await db
      .from("marketing_events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (error) return jsonError("NOT_FOUND", "Marketing event not found.", 404);
    return jsonSuccess(toCamel(data));
  }

  // POST /marketing-events
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

    const { data, error } = await db
      .from("marketing_events")
      .insert(toDbInput(parsed.data))
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data), 201);
  }

  // PATCH /marketing-events/:id
  if (req.method === "PATCH" && eventId) {
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

    const dbInput = toDbInput(parsed.data);
    const { data, error } = await db
      .from("marketing_events")
      .update(dbInput)
      .eq("id", eventId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  // DELETE /marketing-events/:id soft-archives the reference.
  if (req.method === "DELETE" && eventId) {
    const { data, error } = await db
      .from("marketing_events")
      .update({ status: "archived" })
      .eq("id", eventId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  return jsonError("NOT_FOUND", "Route not found.", 404);
});
