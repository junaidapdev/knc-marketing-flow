import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

// Generates N topic ideas using brand DNA + recent activity context, then
// bulk-inserts them into the topics queue with status='queued'. Returns the
// inserted rows so the UI can render them immediately.
//
// Two-step flow:
//   1. Build a context-rich prompt (DNA + voice + recent activity stats +
//      stale branches/patterns) and ask OpenAI for a JSON array.
//   2. Validate each suggestion with Zod, resolve branch_name → branch_id,
//      then bulk-insert.

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

const PATTERN_ID_REGEX = /^P\d{1,2}$/;

const requestSchema = z.object({
  count: z.number().int().min(1).max(10).default(5),
  occasion: z.string().min(1).max(40).optional(),
  excludeRecentDays: z.number().int().min(0).max(180).default(30),
});

// Each suggestion the LLM returns. We're permissive on inputs (anything
// vaguely shaped) and tighten the contract via Zod so a bad row doesn't
// poison the whole batch — invalid suggestions are skipped, not rejected.
const suggestionSchema = z.object({
  title: z.string().min(3).max(200),
  pattern_id: z.string().regex(PATTERN_ID_REGEX),
  suggested_branch: z.string().min(1).max(120).nullable().optional(),
  theme: z.string().min(1).max(200),
  occasion: z.string().min(1).max(40).default("regular"),
  entry_type: z.enum(ENTRY_TYPE_VALUES).default("instagram_reel"),
  reasoning: z.string().min(1).max(1000).optional(),
});

type Suggestion = z.infer<typeof suggestionSchema>;

interface BranchRow {
  id: string;
  name: string;
  city: string;
  last_featured_date: string | null;
}

interface CalendarEntryRow {
  id: string;
  title: string;
  pattern_id: string | null;
  branch_id: string | null;
  theme: string | null;
  target_date: string;
}

interface TopicRow {
  title: string;
  theme: string | null;
  pattern_id: string | null;
}

interface MarketingEventRow {
  title: string;
  event_type: string;
  importance: string;
  start_date: string;
  end_date: string;
  marketing_notes: string | null;
  is_date_estimate: boolean;
}

interface OpenAIResponse {
  choices: Array<{ message?: { content?: string | null } }>;
  usage?: { total_tokens?: number };
}

// Small helper to format a date as "YYYY-MM-DD" UTC, matching what the rest
// of the app stores in date columns.
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildSuggesterPrompt(args: {
  voiceConfig: Record<string, unknown>;
  dnaMarkdown: string | null;
  recentEntries: CalendarEntryRow[];
  queuedTopics: TopicRow[];
  branches: BranchRow[];
  upcomingEvents: MarketingEventRow[];
  count: number;
  occasionBias?: string;
  windowDays: number;
}): string {
  const {
    voiceConfig,
    dnaMarkdown,
    recentEntries,
    queuedTopics,
    branches,
    upcomingEvents,
    count,
    occasionBias,
    windowDays,
  } = args;

  // Pattern frequency over the recent window
  const patternUsage = new Map<string, number>();
  for (const e of recentEntries) {
    if (e.pattern_id) {
      patternUsage.set(e.pattern_id, (patternUsage.get(e.pattern_id) ?? 0) + 1);
    }
  }
  const usedPatternsLine = patternUsage.size > 0
    ? Array.from(patternUsage.entries())
        .map(([p, n]) => `${p} (${n}×)`)
        .join(", ")
    : "(none)";

  // Stale branches — those with no entry in the window
  const recentBranchIds = new Set(
    recentEntries.map((e) => e.branch_id).filter((b): b is string => Boolean(b)),
  );
  const staleBranches = branches.filter((b) => !recentBranchIds.has(b.id));
  const staleBranchLine = staleBranches.length > 0
    ? staleBranches.map((b) => `${b.name} (${b.city})`).join(", ")
    : "(none)";

  // Stale patterns — pull from voice_config.patterns
  const allPatterns = Array.isArray(voiceConfig.patterns)
    ? (voiceConfig.patterns as Array<{ id: string; name: string }>)
    : [];
  const stalePatterns = allPatterns.filter((p) => !patternUsage.has(p.id));
  const stalePatternLine = stalePatterns.length > 0
    ? stalePatterns.map((p) => `${p.id} (${p.name})`).join(", ")
    : "(none)";

  // Recent themes — to avoid duplicating what we just shipped
  const recentThemes = recentEntries
    .map((e) => e.theme)
    .filter((t): t is string => Boolean(t))
    .slice(0, 20)
    .join("; ") || "(none)";

  // Queued topics — to avoid suggesting near-duplicates
  const queuedLine = queuedTopics.length > 0
    ? queuedTopics.slice(0, 30).map((t) => `"${t.title}"`).join(", ")
    : "(none)";

  const eventsLine = upcomingEvents.length > 0
    ? upcomingEvents
        .slice(0, 12)
        .map((e) => {
          const date = e.start_date === e.end_date ? e.start_date : `${e.start_date} to ${e.end_date}`;
          const estimate = e.is_date_estimate ? ", estimated" : "";
          const notes = e.marketing_notes ? ` - ${e.marketing_notes}` : "";
          return `${e.title} (${date}, ${e.importance}${estimate})${notes}`;
        })
        .join("\n- ")
    : "(none)";

  const dnaBlock = dnaMarkdown && dnaMarkdown.trim().length > 0
    ? `\n\n# BRAND DNA\n${dnaMarkdown}\n# END BRAND DNA\n`
    : "";

  const occasionLine = occasionBias
    ? `\nBias EVERY suggestion toward the "${occasionBias}" occasion. Frame products, hooks, and themes around it.`
    : "";

  // Note: OpenAI requires the word "JSON" in the prompt when using
  // response_format: { type: "json_object" }. The schema instruction below
  // satisfies that.
  return `You are an AI content strategist for Kayan Sweets, a Saudi confectionery retail chain. You generate fresh, on-brand short-form video topic ideas.

Brand voice (raw config):
${JSON.stringify(voiceConfig)}
${dnaBlock}

# RECENT ACTIVITY (last ${windowDays} days)
- Patterns used: ${usedPatternsLine}
- Themes shipped: ${recentThemes}
- Branches featured: ${recentBranchIds.size}/${branches.length}

# OPPORTUNITIES
- Stale branches (NOT featured in ${windowDays}+ days, prioritize these): ${staleBranchLine}
- Stale patterns (NOT used recently, prioritize these): ${stalePatternLine}
- Upcoming marketing events in the next 90 days:
- ${eventsLine}

# AVOID
- Topics already in queue (don't duplicate near-matches): ${queuedLine}
${occasionLine}

# TASK
Generate ${count} fresh topic ideas. Prioritize stale branches + stale patterns. Each suggestion must follow this exact JSON structure inside an "items" array:

{
  "items": [
    {
      "title": "<short working title, 5-12 words>",
      "pattern_id": "<one of P1-P9>",
      "suggested_branch": "<exact branch name from voice config, or null if pattern doesn't need branch focus>",
      "theme": "<focus product or angle, 3-8 words, e.g. 'imported chocolates aisle'>",
      "occasion": "<one of: regular, ramadan, eid, national_day, mothers_day, fathers_day, back_to_school, summer, derby_weekend, riyadh_season>",
      "entry_type": "<one of: tiktok_video, instagram_reel, instagram_story, snapchat_story, shop_activity, influencer_collab, offer, general>",
      "reasoning": "<one sentence: why this combo, why now>"
    }
    // ... ${count} total
  ]
}

Rules:
- pattern_id MUST be one of the 9 patterns (P1–P9).
- suggested_branch MUST exactly match a branch name in voice config, or be null.
- entry_type defaults to "instagram_reel" unless the topic clearly fits another format.
- DO NOT repeat queued topics or recent themes.
- DO NOT include any commentary outside the JSON.`;
}

function safeParseAIResponse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // The LLM occasionally wraps JSON in fences despite the response_format
    // hint. Try a quick recovery: pull text between the first `[` or `{` and
    // the last matching closer.
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        // fallthrough
      }
    }
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonError("NOT_FOUND", "Method not supported.", 404);

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_FAILED", "Invalid JSON.", 400);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_FAILED", "Validation failed.", 422, {
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const openaiModel = Deno.env.get("OPENAI_MODEL") ?? "gpt-5.5";
  if (!openaiKey) return jsonError("INTERNAL_ERROR", "AI not configured.", 500);

  const db = createClient(supabaseUrl, serviceKey);

  // Single-tenant V1 — first brand row.
  const { data: brand, error: brandErr } = await db
    .from("brands")
    .select("id, voice_config, dna_markdown")
    .limit(1)
    .single();
  if (brandErr || !brand) {
    return jsonError("INTERNAL_ERROR", "Brand row missing.", 500);
  }

  const brandId = brand.id as string;
  const voiceConfig = (brand.voice_config as Record<string, unknown>) ?? {};
  const dnaMarkdown = (brand.dna_markdown as string | null) ?? null;

  // Date window: anything with target_date >= (today - excludeRecentDays).
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - parsed.data.excludeRecentDays);
  const windowStartIso = isoDate(windowStart);
  const todayIso = isoDate(new Date());
  const eventWindowEnd = new Date();
  eventWindowEnd.setUTCDate(eventWindowEnd.getUTCDate() + 90);
  const eventWindowEndIso = isoDate(eventWindowEnd);

  const [entriesRes, topicsRes, branchesRes, eventsRes] = await Promise.all([
    db
      .from("calendar_entries")
      .select("id, title, pattern_id, branch_id, theme, target_date")
      .eq("brand_id", brandId)
      .gte("target_date", windowStartIso),
    db
      .from("topics")
      .select("title, theme, pattern_id")
      .eq("brand_id", brandId)
      .eq("status", "queued"),
    db
      .from("branches")
      .select("id, name, city")
      .eq("brand_id", brandId)
      .eq("is_active", true),
    db
      .from("marketing_events")
      .select("title, event_type, importance, start_date, end_date, marketing_notes, is_date_estimate")
      .eq("brand_id", brandId)
      .eq("status", "active")
      .gte("end_date", todayIso)
      .lte("start_date", eventWindowEndIso)
      .order("start_date", { ascending: true }),
  ]);

  if (entriesRes.error) return jsonError("INTERNAL_ERROR", entriesRes.error.message, 500);
  if (topicsRes.error) return jsonError("INTERNAL_ERROR", topicsRes.error.message, 500);
  if (branchesRes.error) return jsonError("INTERNAL_ERROR", branchesRes.error.message, 500);
  if (eventsRes.error) return jsonError("INTERNAL_ERROR", eventsRes.error.message, 500);

  const recentEntries = (entriesRes.data ?? []) as CalendarEntryRow[];
  const queuedTopics = (topicsRes.data ?? []) as TopicRow[];
  const branchesRaw = (branchesRes.data ?? []) as Array<{ id: string; name: string; city: string }>;
  const upcomingEvents = (eventsRes.data ?? []) as MarketingEventRow[];

  // Compute last_featured_date per branch from the recent entries.
  const lastFeaturedMap = new Map<string, string>();
  for (const e of recentEntries) {
    if (!e.branch_id) continue;
    const existing = lastFeaturedMap.get(e.branch_id);
    if (!existing || e.target_date > existing) {
      lastFeaturedMap.set(e.branch_id, e.target_date);
    }
  }
  const branches: BranchRow[] = branchesRaw.map((b) => ({
    id: b.id,
    name: b.name,
    city: b.city,
    last_featured_date: lastFeaturedMap.get(b.id) ?? null,
  }));

  const systemPrompt = buildSuggesterPrompt({
    voiceConfig,
    dnaMarkdown,
    recentEntries,
    queuedTopics,
    branches,
    upcomingEvents,
    count: parsed.data.count,
    occasionBias: parsed.data.occasion,
    windowDays: parsed.data.excludeRecentDays,
  });

  // Two-message structure: system gets the long context; user gets a short
  // "go" instruction. Keeps the user message stable across calls so the
  // OpenAI cache layer can hit on the system prompt when we call again
  // with the same context.
  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: openaiModel,
      // Newer OpenAI models (GPT-5 series, o-series) require
      // `max_completion_tokens` instead of the legacy `max_tokens`.
      max_completion_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate ${parsed.data.count} topic ideas now.` },
      ],
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    return jsonError("INTERNAL_ERROR", `AI error: ${errText.slice(0, 200)}`, 500);
  }

  const aiData = (await openaiRes.json()) as OpenAIResponse;
  const raw = aiData.choices[0]?.message?.content ?? "";
  const parsedRaw = safeParseAIResponse(raw);

  if (!parsedRaw || typeof parsedRaw !== "object") {
    return jsonError("INTERNAL_ERROR", "AI returned non-JSON content.", 500, {
      preview: raw.slice(0, 300),
    });
  }

  // Accept either { items: [...] } or a bare array. The prompt asks for the
  // wrapped form, but the LLM has been known to ignore that.
  const itemsRaw =
    Array.isArray(parsedRaw)
      ? parsedRaw
      : ((parsedRaw as Record<string, unknown>).items ??
         (parsedRaw as Record<string, unknown>).suggestions ??
         (parsedRaw as Record<string, unknown>).topics ??
         []);
  if (!Array.isArray(itemsRaw)) {
    return jsonError("INTERNAL_ERROR", "AI response missing items array.", 500, {
      preview: raw.slice(0, 300),
    });
  }

  // Validate each suggestion. Skip invalid ones rather than rejecting the
  // whole batch — partial success is better than no success when the user
  // asked for 5 and the LLM gave 5 with one malformed entry.
  const validated: Suggestion[] = [];
  const skipped: Array<{ index: number; reason: string }> = [];
  for (let i = 0; i < itemsRaw.length; i++) {
    const result = suggestionSchema.safeParse(itemsRaw[i]);
    if (result.success) {
      validated.push(result.data);
    } else {
      skipped.push({
        index: i,
        reason: result.error.issues.map((e) => e.message).join("; "),
      });
    }
  }

  if (validated.length === 0) {
    return jsonError("INTERNAL_ERROR", "AI returned no valid suggestions.", 500, {
      skipped,
      preview: raw.slice(0, 300),
    });
  }

  // Resolve branch names → ids. Case-insensitive exact-match. Unknown
  // branch names just store branch_id=null on the topic; the suggestion
  // stays in the queue with the LLM's textual hint in the title/theme.
  const branchByName = new Map<string, string>();
  for (const b of branches) {
    branchByName.set(b.name.toLowerCase(), b.id);
  }

  const rowsToInsert = validated.map((s) => ({
    brand_id: brandId,
    title: s.title,
    description: s.reasoning ?? null,
    pattern_id: s.pattern_id,
    branch_id: s.suggested_branch
      ? (branchByName.get(s.suggested_branch.toLowerCase()) ?? null)
      : null,
    theme: s.theme,
    occasion: s.occasion,
    entry_type: s.entry_type,
    priority: 0,
    notes: null,
    created_by: auth.userId,
    status: "queued" as const,
  }));

  const { data: inserted, error: insertErr } = await db
    .from("topics")
    .insert(rowsToInsert)
    .select();
  if (insertErr) return jsonError("INTERNAL_ERROR", insertErr.message, 500);

  return jsonSuccess(
    {
      topics: toCamel(inserted),
      requested: parsed.data.count,
      generated: validated.length,
      skipped,
      tokensUsed: aiData.usage?.total_tokens ?? null,
    },
    201,
  );
});
