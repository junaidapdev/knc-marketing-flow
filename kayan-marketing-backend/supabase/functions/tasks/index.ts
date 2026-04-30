import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

const ASSIGNEE_VALUES = ["junaid", "ammar", "both"] as const;
const TASK_STATUS_VALUES = ["pending", "in_progress", "completed"] as const;
const TASK_PHASE_VALUES = [
  "script",
  "shoot",
  "edit",
  "post",
  "plan",
  "setup",
  "wrap",
  "brief",
  "review",
  "track",
  "communicate",
  "activate",
  "custom",
] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z
  .object({
    entryId: z.string().uuid().nullable().optional(),
    campaignId: z.string().uuid().nullable().optional(),
    title: z.string().min(3).max(200),
    phase: z.enum(TASK_PHASE_VALUES).nullable().optional(),
    assignee: z.enum(ASSIGNEE_VALUES),
    dueDate: z.string().regex(DATE_REGEX),
    isStandalone: z.boolean().default(false),
    notes: z.string().max(5000).nullable().optional(),
  })
  .refine((data) => data.entryId != null || data.isStandalone === true, {
    message: "Task must reference an entry or be marked standalone.",
    path: ["entryId"],
  });

const updateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  phase: z.enum(TASK_PHASE_VALUES).nullable().optional(),
  assignee: z.enum(ASSIGNEE_VALUES).optional(),
  dueDate: z.string().regex(DATE_REGEX).optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  notes: z.string().max(5000).nullable().optional(),
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
  const isCollection = lastPart === "tasks";
  const taskId = isCollection ? null : lastPart;

  if (req.method === "GET" && isCollection) {
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const assigneeFilter = url.searchParams.get("assignee");
    const statusFilter = url.searchParams.get("status");
    const entryIdFilter = url.searchParams.get("entryId");

    let q = db.from("tasks").select("*").order("due_date", { ascending: true });
    if (fromDate) q = q.gte("due_date", fromDate);
    if (toDate) q = q.lte("due_date", toDate);
    if (assigneeFilter) q = q.eq("assignee", assigneeFilter);
    if (statusFilter) q = q.eq("status", statusFilter);
    if (entryIdFilter) q = q.eq("entry_id", entryIdFilter);

    const { data, error } = await q;
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "GET" && taskId) {
    const { data, error } = await db.from("tasks").select("*").eq("id", taskId).single();
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

    const { data, error } = await db
      .from("tasks")
      .insert({
        entry_id: parsed.data.entryId ?? null,
        campaign_id: parsed.data.campaignId ?? null,
        title: parsed.data.title,
        phase: parsed.data.phase ?? null,
        assignee: parsed.data.assignee,
        due_date: parsed.data.dueDate,
        is_standalone: parsed.data.isStandalone,
        notes: parsed.data.notes ?? null,
      })
      .select()
      .single();

    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data), 201);
  }

  if (req.method === "PATCH" && taskId) {
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
    if (parsed.data.title !== undefined) dbInput.title = parsed.data.title;
    if (parsed.data.phase !== undefined) dbInput.phase = parsed.data.phase;
    if (parsed.data.assignee !== undefined) dbInput.assignee = parsed.data.assignee;
    if (parsed.data.dueDate !== undefined) dbInput.due_date = parsed.data.dueDate;
    if (parsed.data.notes !== undefined) dbInput.notes = parsed.data.notes;
    if (parsed.data.status !== undefined) {
      dbInput.status = parsed.data.status;
      // Stamp completed_at when transitioning to completed; clear it otherwise
      dbInput.completed_at = parsed.data.status === "completed" ? new Date().toISOString() : null;
    }

    const { data, error } = await db
      .from("tasks")
      .update(dbInput)
      .eq("id", taskId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "DELETE" && taskId) {
    const { error } = await db.from("tasks").delete().eq("id", taskId);
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return jsonError("NOT_FOUND", "Route not found.", 404);
});
