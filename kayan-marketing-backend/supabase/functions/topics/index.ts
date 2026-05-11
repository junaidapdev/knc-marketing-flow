import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

// CRUD for the topics queue (added in migration 0030). Plus a /use action
// that converts a topic into a calendar entry via create_entry_with_tasks
// — the RPC handles the topic.status='used' flip atomically (migration 0032).

const ENTRY_TYPE_VALUES = [
  "tiktok_video",
  "instagram_reel",
  "instagram_story",
  "snapchat_story",
  "shop_activity",
  "influencer_collab",
  "offer",
  "general",
] as const;

const TOPIC_STATUS_VALUES = ["queued", "in_progress", "used", "archived"] as const;
const ASSIGNEE_VALUES = ["junaid", "ammar", "both"] as const;
const PRODUCTION_MODES = ["batch", "adhoc"] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PATTERN_ID_REGEX = /^P\d{1,2}$/;

const patternIdSchema = z
  .string()
  .regex(PATTERN_ID_REGEX, "Pattern id like P1, P9")
  .nullable()
  .optional();

// ───── Schemas ─────

const createSchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().min(3).max(200),
  // English companions (migration 0045). Optional: a topic can be
  // saved with only Arabic, only English, or both.
  titleEn: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  descriptionEn: z.string().max(2000).nullable().optional(),
  patternId: patternIdSchema,
  branchId: z.string().uuid().nullable().optional(),
  theme: z.string().max(200).nullable().optional(),
  occasion: z.string().max(40).nullable().optional(),
  entryType: z.enum(ENTRY_TYPE_VALUES),
  priority: z.number().int().min(0).max(100).default(0),
  notes: z.string().max(5000).nullable().optional(),
});

const updateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  titleEn: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  descriptionEn: z.string().max(2000).nullable().optional(),
  patternId: patternIdSchema,
  branchId: z.string().uuid().nullable().optional(),
  theme: z.string().max(200).nullable().optional(),
  occasion: z.string().max(40).nullable().optional(),
  entryType: z.enum(ENTRY_TYPE_VALUES).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(5000).nullable().optional(),
  status: z.enum(TOPIC_STATUS_VALUES).optional(),
});

// "Use this topic" body. The topic supplies pattern/branch/theme/type;
// the user supplies the per-entry fields that change every conversion
// (target date, assignee, production mode). Optional overrides let the
// user retitle or repoint at conversion time.
const useSchema = z.object({
  targetDate: z.string().regex(DATE_REGEX, "Must be YYYY-MM-DD"),
  assignee: z.enum(ASSIGNEE_VALUES),
  shootDate: z.string().regex(DATE_REGEX).nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  titleOverride: z.string().min(3).max(200).optional(),
  descriptionOverride: z.string().max(2000).nullable().optional(),
  productionMode: z.enum(PRODUCTION_MODES).default("batch"),
  editorDaysOffset: z.number().int().min(0).max(30).default(2),
  autoCreateTasks: z.boolean().default(true),
});

// ───── Task chain (mirror of calendar-entries) ─────
// Used when /use creates an entry — same chains the calendar-entries POST
// uses so the resulting tasks look identical. Keep the two in sync.

interface TaskTemplate {
  phase: string;
  title: string;
  offsetDays: number;
  defaultAssignee: "junaid" | "ammar";
}

const TASK_CHAINS: Record<string, TaskTemplate[]> = {
  tiktok_video: [
    { phase: "script", title: "Write script", offsetDays: -4, defaultAssignee: "ammar" },
    { phase: "shoot", title: "Shoot footage", offsetDays: -2, defaultAssignee: "junaid" },
    { phase: "edit", title: "Edit video", offsetDays: -1, defaultAssignee: "ammar" },
    { phase: "post", title: "Post to TikTok", offsetDays: 0, defaultAssignee: "junaid" },
  ],
  instagram_reel: [
    { phase: "script", title: "Write script", offsetDays: -4, defaultAssignee: "ammar" },
    { phase: "shoot", title: "Shoot footage", offsetDays: -2, defaultAssignee: "junaid" },
    { phase: "edit", title: "Edit reel", offsetDays: -1, defaultAssignee: "ammar" },
    { phase: "post", title: "Post to Instagram", offsetDays: 0, defaultAssignee: "junaid" },
  ],
  instagram_story: [
    { phase: "post", title: "Post Instagram story", offsetDays: 0, defaultAssignee: "ammar" },
  ],
  snapchat_story: [
    { phase: "post", title: "Post Snapchat story", offsetDays: 0, defaultAssignee: "ammar" },
  ],
  shop_activity: [
    { phase: "plan", title: "Plan & brief staff", offsetDays: -3, defaultAssignee: "junaid" },
    { phase: "setup", title: "Setup branch", offsetDays: 0, defaultAssignee: "junaid" },
    { phase: "wrap", title: "Wrap & document", offsetDays: 1, defaultAssignee: "junaid" },
  ],
  influencer_collab: [
    { phase: "brief", title: "Brief & contract", offsetDays: -7, defaultAssignee: "junaid" },
    { phase: "review", title: "Content review", offsetDays: -2, defaultAssignee: "junaid" },
    { phase: "track", title: "Post & track", offsetDays: 0, defaultAssignee: "junaid" },
  ],
  offer: [
    { phase: "plan", title: "Plan offer", offsetDays: -3, defaultAssignee: "junaid" },
    { phase: "communicate", title: "Communicate to staff", offsetDays: -1, defaultAssignee: "junaid" },
    { phase: "activate", title: "Activate offer", offsetDays: 0, defaultAssignee: "junaid" },
    { phase: "wrap", title: "Wrap & log results", offsetDays: 3, defaultAssignee: "junaid" },
  ],
  general: [],
};

const BATCHABLE_TYPES = new Set(["tiktok_video", "instagram_reel"]);

interface TaskChainItem {
  phase: string;
  title: string;
  dueDate: string;
  assignee: "junaid" | "ammar" | "both";
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildBatchVideoChain(args: {
  type: string;
  shootDate: string;
  targetDate: string;
  editorDaysOffset: number;
  schedulingBuffer: number;
}): TaskChainItem[] {
  const { type, shootDate, targetDate, editorDaysOffset, schedulingBuffer } = args;
  const platformLabel = type === "tiktok_video" ? "TikTok" : "Instagram";
  return [
    { phase: "script", title: "Write script", dueDate: addDays(shootDate, -1), assignee: "ammar" },
    { phase: "shoot", title: "Shoot footage", dueDate: shootDate, assignee: "junaid" },
    { phase: "edit", title: "Edit video", dueDate: addDays(shootDate, editorDaysOffset), assignee: "ammar" },
    {
      phase: "schedule",
      title: `Schedule on ${platformLabel}`,
      dueDate: addDays(targetDate, -schedulingBuffer),
      assignee: "junaid",
    },
  ];
}

// ───── Handler ─────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Routing:
  //   /functions/v1/topics                      → list/create
  //   /functions/v1/topics/:id                  → detail/update/delete
  //   /functions/v1/topics/:id/use              → convert to entry
  // pathParts after `/functions/v1/`: ["topics"] | ["topics", ":id"] | ["topics", ":id", "use"]
  const topicsIdx = pathParts.indexOf("topics");
  const topicId = pathParts[topicsIdx + 1] ?? null;
  const subAction = pathParts[topicsIdx + 2] ?? null;
  const isCollection = topicId === null;

  // ───── GET list ─────
  if (req.method === "GET" && isCollection) {
    const status = url.searchParams.get("status");
    const occasion = url.searchParams.get("occasion");
    let q = db
      .from("topics")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    if (occasion) q = q.eq("occasion", occasion);
    const { data, error } = await q;
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  // ───── GET detail ─────
  if (req.method === "GET" && topicId && !subAction) {
    const { data, error } = await db
      .from("topics")
      .select("*")
      .eq("id", topicId)
      .single();
    if (error) return jsonError("NOT_FOUND", error.message, 404);
    return jsonSuccess(toCamel(data));
  }

  // ───── POST create ─────
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
      .from("topics")
      .insert({
        brand_id: parsed.data.brandId,
        title: parsed.data.title,
        title_en: parsed.data.titleEn ?? null,
        description: parsed.data.description ?? null,
        description_en: parsed.data.descriptionEn ?? null,
        pattern_id: parsed.data.patternId ?? null,
        branch_id: parsed.data.branchId ?? null,
        theme: parsed.data.theme ?? null,
        occasion: parsed.data.occasion ?? null,
        entry_type: parsed.data.entryType,
        priority: parsed.data.priority,
        notes: parsed.data.notes ?? null,
        created_by: auth.userId,
      })
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data), 201);
  }

  // ───── PATCH update ─────
  if (req.method === "PATCH" && topicId && !subAction) {
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
    if (parsed.data.titleEn !== undefined) dbInput.title_en = parsed.data.titleEn;
    if (parsed.data.description !== undefined) dbInput.description = parsed.data.description;
    if (parsed.data.descriptionEn !== undefined) dbInput.description_en = parsed.data.descriptionEn;
    if (parsed.data.patternId !== undefined) dbInput.pattern_id = parsed.data.patternId;
    if (parsed.data.branchId !== undefined) dbInput.branch_id = parsed.data.branchId;
    if (parsed.data.theme !== undefined) dbInput.theme = parsed.data.theme;
    if (parsed.data.occasion !== undefined) dbInput.occasion = parsed.data.occasion;
    if (parsed.data.entryType !== undefined) dbInput.entry_type = parsed.data.entryType;
    if (parsed.data.priority !== undefined) dbInput.priority = parsed.data.priority;
    if (parsed.data.notes !== undefined) dbInput.notes = parsed.data.notes;
    if (parsed.data.status !== undefined) dbInput.status = parsed.data.status;

    const { data, error } = await db
      .from("topics")
      .update(dbInput)
      .eq("id", topicId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  // ───── DELETE → soft delete (status='archived') ─────
  // Hard delete is reserved for future cleanup. Archived rows stay in the DB
  // so any calendar entry that referenced them can still resolve the link.
  if (req.method === "DELETE" && topicId && !subAction) {
    const { data, error } = await db
      .from("topics")
      .update({ status: "archived" })
      .eq("id", topicId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  // ───── POST /use → convert topic to calendar entry ─────
  if (req.method === "POST" && topicId && subAction === "use") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("VALIDATION_FAILED", "Invalid JSON.", 400);
    }
    const parsed = useSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    // Load the topic — must exist and not already be used.
    const { data: topic, error: topicErr } = await db
      .from("topics")
      .select("*")
      .eq("id", topicId)
      .single();
    if (topicErr || !topic) {
      return jsonError("NOT_FOUND", "Topic not found.", 404);
    }
    if (topic.status === "used") {
      return jsonError(
        "VALIDATION_FAILED",
        "This topic has already been used. Create a new topic instead.",
        409,
      );
    }

    const entryType = (topic.entry_type as string) ?? "general";
    const title = parsed.data.titleOverride ?? (topic.title as string);
    const description =
      parsed.data.descriptionOverride !== undefined
        ? parsed.data.descriptionOverride
        : ((topic.description as string | null) ?? null);
    const branchId = parsed.data.branchId ?? (topic.branch_id as string | null) ?? null;
    const campaignId = parsed.data.campaignId ?? null;
    const patternId = (topic.pattern_id as string | null) ?? null;
    const theme = (topic.theme as string | null) ?? null;
    const shootDate = parsed.data.shootDate ?? null;

    // Resolve scheduling buffer from brand settings (same as calendar-entries
    // POST). Falls back to 3 days when the brand row is missing the column.
    const { data: brandRow } = await db
      .from("brands")
      .select("default_scheduling_buffer")
      .eq("id", topic.brand_id)
      .single();
    const schedulingBuffer =
      (brandRow?.default_scheduling_buffer as number | undefined) ?? 3;

    let taskChain: TaskChainItem[];
    if (
      parsed.data.productionMode === "batch" &&
      BATCHABLE_TYPES.has(entryType) &&
      shootDate
    ) {
      taskChain = buildBatchVideoChain({
        type: entryType,
        shootDate,
        targetDate: parsed.data.targetDate,
        editorDaysOffset: parsed.data.editorDaysOffset,
        schedulingBuffer,
      });
    } else {
      taskChain = (TASK_CHAINS[entryType] ?? []).map((t) => ({
        phase: t.phase,
        title: t.title,
        dueDate: addDays(parsed.data.targetDate, t.offsetDays),
        assignee: t.defaultAssignee,
      }));
    }

    // The RPC writes the entry AND flips the topic to 'used' atomically
    // (migration 0032). No second UPDATE here — it's all one transaction.
    const { data: rpcResult, error: rpcErr } = await db.rpc("create_entry_with_tasks", {
      p_brand_id: topic.brand_id,
      p_campaign_id: campaignId,
      p_branch_id: branchId,
      p_influencer_id: null,
      p_type: entryType,
      p_title: title,
      p_description: description,
      p_target_date: parsed.data.targetDate,
      p_assignee: parsed.data.assignee,
      p_budget_allocated: 0,
      p_budget_category: null,
      p_notes: null,
      p_task_chain: taskChain,
      p_auto_create_tasks: parsed.data.autoCreateTasks,
      p_shoot_date: shootDate,
      p_production_mode: parsed.data.productionMode,
      p_editor_days_offset: parsed.data.editorDaysOffset,
      p_pattern_id: patternId,
      p_theme: theme,
      p_source_topic_id: topicId,
    });
    if (rpcErr) return jsonError("INTERNAL_ERROR", rpcErr.message, 500);

    return jsonSuccess(toCamel(rpcResult), 201);
  }

  return jsonError("NOT_FOUND", "Route not found.", 404);
});
