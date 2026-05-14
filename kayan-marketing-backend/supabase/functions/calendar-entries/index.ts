import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

// Mirrors src/constants/task-chains.ts. Deno cannot import from the TS source tree directly.
// Task chains are now keyed by FORMAT (not platform-type) — one chain covers
// a video across all platforms it lands on, since Junaid shoots once and
// distributes to TikTok/IG/Snap (decided 2026-05-14).
type TaskTemplate = {
  phase: string;
  title: string;
  offsetDays: number;
  defaultAssignee: "junaid" | "ammar";
};

const TASK_CHAINS: Record<string, TaskTemplate[]> = {
  video: [
    { phase: "script", title: "Write script", offsetDays: -4, defaultAssignee: "ammar" },
    { phase: "shoot", title: "Shoot footage", offsetDays: -2, defaultAssignee: "junaid" },
    { phase: "edit", title: "Edit video", offsetDays: -1, defaultAssignee: "ammar" },
    { phase: "post", title: "Post across platforms", offsetDays: 0, defaultAssignee: "junaid" },
  ],
  story: [
    { phase: "post", title: "Post stories", offsetDays: 0, defaultAssignee: "ammar" },
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

const CONTENT_FORMAT_VALUES = Object.keys(TASK_CHAINS) as [string, ...string[]];
const PLATFORM_VALUES = ["tiktok", "instagram", "snapchat"] as const;
const ASSIGNEE_VALUES = ["junaid", "ammar", "both"] as const;
const ENTRY_STATUS_VALUES = ["planned", "in_progress", "live", "done", "cancelled"] as const;
const PRODUCTION_MODES = ["batch", "adhoc"] as const;
const CONTENT_FORMATS = new Set(["video", "story"]);
// Only video format batches meaningfully — script + shoot + edit + schedule
// anchored on a shoot day. Stories are quick, posted same-day.
const BATCHABLE_FORMATS = new Set(["video"]);

const patternIdSchema = z
  .string()
  .regex(/^P\d{1,2}$/, "Pattern id like P1, P9")
  .nullable()
  .optional();
const themeSchema = z.string().max(200).nullable().optional();

const createSchema = z
  .object({
    brandId: z.string().uuid(),
    campaignId: z.string().uuid().nullable().optional(),
    branchId: z.string().uuid().nullable().optional(),
    influencerId: z.string().uuid().nullable().optional(),
    format: z.enum(CONTENT_FORMAT_VALUES),
    // Platforms only apply to video / story formats. Validation below enforces
    // that this matches the format. Empty array allowed for non-content formats.
    platforms: z.array(z.enum(PLATFORM_VALUES)).default([]),
    title: z.string().min(3).max(200),
    description: z.string().max(2000).nullable().optional(),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    assignee: z.enum(ASSIGNEE_VALUES),
    budgetAllocated: z.number().nonnegative().default(0),
    budgetCategory: z.string().nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    autoCreateTasks: z.boolean().default(true),
    productionMode: z.enum(PRODUCTION_MODES).default("batch"),
    shootDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    editorDaysOffset: z.number().int().min(0).max(30).default(2),
    // Recipe Book V2 tagging — both optional. AI generation flow reads these
    // to produce on-pattern, on-theme scripts (see ai-assistant chunk 3).
    patternId: patternIdSchema,
    theme: themeSchema,
    taskChainOverride: z
      .array(
        z.object({
          phase: z.string(),
          title: z.string(),
          dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          assignee: z.enum(ASSIGNEE_VALUES),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.format === "shop_activity" && !data.branchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["branchId"],
        message: "Please select a branch for shop activity entries.",
      });
    }
    if (data.format === "influencer_collab" && !data.influencerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["influencerId"],
        message: "Please select an influencer for collaboration entries.",
      });
    }
    // Content formats must pick at least one platform.
    if (CONTENT_FORMATS.has(data.format) && data.platforms.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["platforms"],
        message: "Pick at least one platform for video/story entries.",
      });
    }
    // Non-content formats can't carry platforms.
    if (!CONTENT_FORMATS.has(data.format) && data.platforms.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["platforms"],
        message: "Platforms only apply to video and story entries.",
      });
    }
    // Batch-mode videos must specify a shoot day. Without one we
    // can't compute the script/shoot/edit dates. Ad-hoc entries skip this.
    if (
      data.productionMode === "batch" &&
      BATCHABLE_FORMATS.has(data.format) &&
      !data.shootDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shootDate"],
        message: "Pick a shoot day for batch-mode video entries.",
      });
    }
  });

const updateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assignee: z.enum(ASSIGNEE_VALUES).optional(),
  status: z.enum(ENTRY_STATUS_VALUES).optional(),
  budgetAllocated: z.number().nonnegative().optional(),
  budgetSpent: z.number().nonnegative().optional(),
  videoUrl: z.string().url().nullable().optional(),
  // post_url is no longer on calendar_entries — it lives on entry_publications.
  // Updating per-platform URLs goes through PATCH /calendar-entries/:id/publications/:platform.
  notes: z.string().max(5000).nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  influencerId: z.string().uuid().nullable().optional(),
  // Authoring fields written asynchronously by the content creator.
  script: z.string().max(20000).nullable().optional(),
  shotDirections: z.string().max(10000).nullable().optional(),
  caption: z.string().max(5000).nullable().optional(),
  hashtags: z.string().max(2000).nullable().optional(),
  // Production rhythm fields — see migration 0025.
  productionMode: z.enum(PRODUCTION_MODES).optional(),
  shootDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  editorDaysOffset: z.number().int().min(0).max(30).optional(),
  patternId: patternIdSchema,
  theme: themeSchema,
});

// Patch one publication's post_url / posted_at. Used by the entry detail panel
// when the user pastes the live URL after publishing on a specific platform.
const updatePublicationSchema = z.object({
  postUrl: z.string().url().nullable().optional(),
  postedAt: z.string().datetime().nullable().optional(),
});

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface TaskChainItem {
  phase: string;
  title: string;
  dueDate: string;
  assignee: "junaid" | "ammar" | "both";
}

// Build the task chain for a batch-mode video entry. Anchors on the shoot
// day, then derives script (-1 from shoot), edit (+editorOffset from shoot),
// and schedule (target_date - schedulingBuffer). "Post" disappears because
// the schedulers auto-publish on the live date.
function buildBatchVideoChain(args: {
  shootDate: string;
  targetDate: string;
  editorDaysOffset: number;
  schedulingBuffer: number;
}): TaskChainItem[] {
  const { shootDate, targetDate, editorDaysOffset, schedulingBuffer } = args;
  return [
    {
      phase: "script",
      title: "Write script",
      dueDate: addDays(shootDate, -1),
      assignee: "ammar",
    },
    {
      phase: "shoot",
      title: "Shoot footage",
      dueDate: shootDate,
      assignee: "junaid",
    },
    {
      phase: "edit",
      title: "Edit video",
      dueDate: addDays(shootDate, editorDaysOffset),
      assignee: "ammar",
    },
    {
      phase: "schedule",
      title: "Schedule across platforms",
      dueDate: addDays(targetDate, -schedulingBuffer),
      assignee: "junaid",
    },
  ];
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
  // Routing:
  //   /functions/v1/calendar-entries                              → list/create
  //   /functions/v1/calendar-entries/:id                          → detail/update/delete
  //   /functions/v1/calendar-entries/:id/publications/:platform   → patch one publication
  const calIdx = pathParts.indexOf("calendar-entries");
  const entryId = pathParts[calIdx + 1] ?? null;
  const subResource = pathParts[calIdx + 2] ?? null;
  const subResourceId = pathParts[calIdx + 3] ?? null;
  const isCollection = entryId === null;
  const isPublicationPatch =
    entryId !== null && subResource === "publications" && subResourceId !== null;

  // ───── GET list ─────
  if (req.method === "GET" && isCollection) {
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const campaignIdFilter = url.searchParams.get("campaignId");
    const branchIdFilter = url.searchParams.get("branchId");
    const influencerIdFilter = url.searchParams.get("influencerId");
    const formatFilter = url.searchParams.get("format");
    // Inline tasks summary + publications so the calendar can render chips
    // (with platform badges) and production phase pills without a second
    // round-trip per entry.
    let q = db
      .from("calendar_entries")
      .select(
        "*, tasks(id, phase, status, due_date, title, assignee), publications:entry_publications(id, platform, post_url, posted_at)",
      )
      .order("target_date", { ascending: true });
    if (fromDate) q = q.gte("target_date", fromDate);
    if (toDate) q = q.lte("target_date", toDate);
    if (campaignIdFilter) q = q.eq("campaign_id", campaignIdFilter);
    if (branchIdFilter) q = q.eq("branch_id", branchIdFilter);
    if (influencerIdFilter) q = q.eq("influencer_id", influencerIdFilter);
    if (formatFilter) q = q.eq("format", formatFilter);
    const { data, error } = await q;
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  // ───── GET detail ─────
  if (req.method === "GET" && entryId && !subResource) {
    const { data, error } = await db
      .from("calendar_entries")
      .select(
        "*, tasks(*), branch:branches(id, name, city), publications:entry_publications(id, platform, post_url, posted_at, created_at, updated_at)",
      )
      .eq("id", entryId)
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

    // Resolve scheduling buffer from brand settings — falls back to 3 days
    // if the brand row hasn't been migrated yet.
    const { data: brandRow } = await db
      .from("brands")
      .select("default_scheduling_buffer")
      .eq("id", parsed.data.brandId)
      .single();
    const schedulingBuffer =
      (brandRow?.default_scheduling_buffer as number | undefined) ?? 3;

    // Decide which task chain to use:
    //   1. Explicit override always wins.
    //   2. Batch + video format with a shoot date → batch chain (anchors on
    //      shoot date, ends with "Schedule across platforms" task).
    //   3. Otherwise → legacy per-entry chain (anchors on target_date).
    let taskChain: TaskChainItem[];
    if (parsed.data.taskChainOverride) {
      taskChain = parsed.data.taskChainOverride;
    } else if (
      parsed.data.productionMode === "batch" &&
      BATCHABLE_FORMATS.has(parsed.data.format) &&
      parsed.data.shootDate
    ) {
      taskChain = buildBatchVideoChain({
        shootDate: parsed.data.shootDate,
        targetDate: parsed.data.targetDate,
        editorDaysOffset: parsed.data.editorDaysOffset,
        schedulingBuffer,
      });
    } else {
      taskChain = (TASK_CHAINS[parsed.data.format] ?? []).map((t) => ({
        phase: t.phase,
        title: t.title,
        dueDate: addDays(parsed.data.targetDate, t.offsetDays),
        assignee: t.defaultAssignee,
      }));
    }

    const { data, error } = await db.rpc("create_entry_with_tasks", {
      p_brand_id: parsed.data.brandId,
      p_campaign_id: parsed.data.campaignId ?? null,
      p_branch_id: parsed.data.branchId ?? null,
      p_influencer_id: parsed.data.influencerId ?? null,
      p_format: parsed.data.format,
      p_platforms: parsed.data.platforms,
      p_title: parsed.data.title,
      p_description: parsed.data.description ?? null,
      p_target_date: parsed.data.targetDate,
      p_assignee: parsed.data.assignee,
      p_budget_allocated: parsed.data.budgetAllocated,
      p_budget_category: parsed.data.budgetCategory ?? null,
      p_notes: parsed.data.notes ?? null,
      p_task_chain: taskChain,
      p_auto_create_tasks: parsed.data.autoCreateTasks,
      p_shoot_date: parsed.data.shootDate ?? null,
      p_production_mode: parsed.data.productionMode,
      p_editor_days_offset: parsed.data.editorDaysOffset,
      p_pattern_id: parsed.data.patternId ?? null,
      p_theme: parsed.data.theme ?? null,
    });

    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data), 201);
  }

  // ───── PATCH one publication (post_url / posted_at) ─────
  if (req.method === "PATCH" && isPublicationPatch) {
    const platform = subResourceId;
    if (!PLATFORM_VALUES.includes(platform as (typeof PLATFORM_VALUES)[number])) {
      return jsonError("VALIDATION_FAILED", "Unknown platform.", 422);
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("VALIDATION_FAILED", "Invalid JSON.", 400);
    }
    const parsed = updatePublicationSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const dbInput: Record<string, unknown> = {};
    if (parsed.data.postUrl !== undefined) dbInput.post_url = parsed.data.postUrl;
    if (parsed.data.postedAt !== undefined) dbInput.posted_at = parsed.data.postedAt;

    const { data, error } = await db
      .from("entry_publications")
      .update(dbInput)
      .eq("entry_id", entryId)
      .eq("platform", platform)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  // ───── PATCH entry ─────
  if (req.method === "PATCH" && entryId && !subResource) {
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
    if (parsed.data.description !== undefined) dbInput.description = parsed.data.description;
    if (parsed.data.targetDate !== undefined) dbInput.target_date = parsed.data.targetDate;
    if (parsed.data.assignee !== undefined) dbInput.assignee = parsed.data.assignee;
    if (parsed.data.status !== undefined) dbInput.status = parsed.data.status;
    if (parsed.data.budgetAllocated !== undefined) dbInput.budget_allocated = parsed.data.budgetAllocated;
    if (parsed.data.budgetSpent !== undefined) dbInput.budget_spent = parsed.data.budgetSpent;
    if (parsed.data.videoUrl !== undefined) dbInput.video_url = parsed.data.videoUrl;
    if (parsed.data.notes !== undefined) dbInput.notes = parsed.data.notes;
    if (parsed.data.branchId !== undefined) dbInput.branch_id = parsed.data.branchId;
    if (parsed.data.influencerId !== undefined) dbInput.influencer_id = parsed.data.influencerId;
    if (parsed.data.script !== undefined) dbInput.script = parsed.data.script;
    if (parsed.data.shotDirections !== undefined) dbInput.shot_directions = parsed.data.shotDirections;
    if (parsed.data.caption !== undefined) dbInput.caption = parsed.data.caption;
    if (parsed.data.hashtags !== undefined) dbInput.hashtags = parsed.data.hashtags;
    if (parsed.data.productionMode !== undefined) dbInput.production_mode = parsed.data.productionMode;
    if (parsed.data.shootDate !== undefined) dbInput.shoot_date = parsed.data.shootDate;
    if (parsed.data.editorDaysOffset !== undefined) dbInput.editor_days_offset = parsed.data.editorDaysOffset;
    if (parsed.data.patternId !== undefined) dbInput.pattern_id = parsed.data.patternId;
    if (parsed.data.theme !== undefined) dbInput.theme = parsed.data.theme;

    const { data, error } = await db
      .from("calendar_entries")
      .update(dbInput)
      .eq("id", entryId)
      .select()
      .single();
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return jsonSuccess(toCamel(data));
  }

  if (req.method === "DELETE" && entryId && !subResource) {
    const { error } = await db.from("calendar_entries").delete().eq("id", entryId);
    if (error) return jsonError("INTERNAL_ERROR", error.message, 500);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return jsonError("NOT_FOUND", "Route not found.", 404);
});
