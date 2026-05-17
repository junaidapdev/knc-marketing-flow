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

const CONTENT_FORMAT_VALUES = [
  "video",
  "story",
  "shop_activity",
  "influencer_collab",
  "offer",
  "general",
] as const;

const PLATFORM_VALUES = ["tiktok", "instagram", "snapchat"] as const;
const CONTENT_FORMATS = new Set<string>(["video", "story"]);

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
  // English companion fields — both required by the prompt; tolerated
  // as optional here so a partial response (Arabic-only or English-only)
  // still saves rather than silently dropping the whole row.
  title_en: z.string().min(3).max(200).nullable().optional(),
  description: z.string().min(1).max(2000).nullable().optional(),
  description_en: z.string().min(1).max(2000).nullable().optional(),
  pattern_id: z.string().regex(PATTERN_ID_REGEX),
  suggested_branch: z.string().min(1).max(120).nullable().optional(),
  theme: z.string().min(1).max(200),
  occasion: z.string().min(1).max(40).default("regular"),
  format: z.enum(CONTENT_FORMAT_VALUES).default("video"),
  // Default platforms — only meaningful for video/story formats. The post-
  // validation step in this function normalizes by clearing them for non-
  // content formats and falling back to all-platforms for content if empty.
  default_platforms: z.array(z.enum(PLATFORM_VALUES)).default([]),
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
  return `You are a Saudi content strategist for Kayan Sweets, a Saudi confectionery retail chain. You generate fresh, on-brand short-form video TOPIC IDEAS — not full scripts. Each topic is a brief the marketer turns into a video later.

Brand voice (raw config):
${JSON.stringify(voiceConfig)}
${dnaBlock}

# DIALECT CONTRACT (apply to every Arabic field — title, description)

You MUST write Arabic in Saudi colloquial dialect (لهجة سعودية، نجدية أو حجازية). NOT MSA. NOT Egyptian (no إيه / ازاي / دلوقتي). NOT Levantine (no شو / كيف الحال).

Required Saudi markers used by the real Kayan creator (use these naturally):
- Demonstratives: هذي / هذا / هذيلك (NOT هذه / هؤلاء)
- Relative pronouns: الي (NOT التي / الذي)
- Future tense: حنبيعه / حتاخذو / حتشوفها / حتجيكم (with حـ prefix)
- Possessive / "with": معاه / معاها / معاكم
- "Sold for": ينباع بـ / تنباع بـ
- Pricing format: "X ريال و Y هللة" or "X.YY هللة" (riyal + halala split)
- Casual fillers: يعني / بس / كذا / دحين / عشان / بدال / والله / وربي

Kayan-specific creator vocabulary observed from real reviewed scripts:
- Hooks: "هذي أطول فاتورة حتشوفها بحياتك"، "أكثر منتج تنتظروه"، "الترند وصل"، "أحد شايل هم X؟ موضوعك عندي"
- Confidence claims: "أقوى عرض في السنة"، "لأول مره بالتاريخ"، "بأقل سعر في السوق"، "حاجة مرة رهيبة"
- Reciprocity framing: "عيدية مننا لكم"، "راعين الأول وسابقينا بالطيب"، "وكنا نقدر نسوي عليها عرض ونبيعها بـ X لكن..."
- Sensory demos: "والله فرمت اللحم في ٢٠ ثانية بس"، "ما تحس بغثاثة"، "من خفتها تاكل حبة ورا حبة"
- Saudi reactions: ماشاء الله / كفو / كفو عليك / يا سلام / يا لطييييف / ألف عافية عليكم / تستاه
- "I got you" framing: "موضوعك عندي"
- Sound like a real Saudi creator holding a phone, NOT a marketing translator. Spoken, warm, direct.

# TOPIC ANGLE PALETTE (pick 1-2 angles per topic — never invent generic ones)

1. Aggressive price hook — "longest receipt", "lowest in the market", "biggest savings ever"
2. Trend-anchored — "الترند وصل", new arrival of a viral product
3. Occasion-anchored — Ramadan, Eid, Iftar, Eid distributions, summer, back-to-school
4. Reciprocity gift-to-followers — "we could've sold for X, but you came first, so it's our gift to you"
5. Behind-the-scenes / supplier visit — factory tour, manufacturer interview, "صنع في السعودية"
6. Sensory quality demo — taste, texture, speed (the meat grinder shot), weight
7. Problem-solution — "أحد شايل هم X؟ موضوعك عندي" — name a worry, then solve it
8. Saudi-pride — "صنع في السعودية"، "أيادي سعودية", local craftsmanship
9. Money-back guarantee — "if you don't love it, we refund you fully even if the box is opened"

# PRICE RULE

DO NOT invent specific prices. Use placeholders [السعر القديم] and [السعر الجديد] in Arabic, and [old price] / [new price] in English. The marketer fills in real numbers when they record.

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

# FEW-SHOT EXAMPLES (match this voice and structure)

Example A — Lucerne Swiss chocolate, supplier-visit + reciprocity + return guarantee:
{
  "title": "لوسيرن السويسري بأيادي سعودية - زرنا ساديا في جدة",
  "title_en": "Swiss Lucerne in Saudi hands — we visited Sadia in Jeddah",
  "description": "نمشي مع شركة ساديا في مصنعهم بجدة، نقابل المهندس حسام والمدير ماتيوس. نعرض ٣ نكهات لوسيرن: كرات كرنشي بحشوة كراميل، شوكلاتة محشية كرنشي، وأصابع شوكلاتة بحشوة لوز. نضمن استرجاع كامل الفلوس حتى لو البوكس مفتوح. ينباع بـ [السعر القديم]، نحن بـ [السعر الجديد]. صنع في السعودية، فريش من المصنع.",
  "description_en": "Behind-the-scenes visit to Sadia's Jeddah factory with engineer Hossam and manager Mateus. Showcase 3 Lucerne flavors: caramel-filled crunchy bites, crunch-filled chocolate, and almond chocolate fingers. Money-back guarantee even if the box is opened. Saudi-made, fresh from the factory. Price contrast: [old price] → [new price].",
  "pattern_id": "P9",
  "suggested_branch": null,
  "theme": "lucerne supplier visit",
  "occasion": "regular",
  "format": "video",
  "default_platforms": ["tiktok", "instagram", "snapchat"],
  "reasoning": "Behind-the-scenes + reciprocity + return guarantee — high-trust angle, Saudi-pride bonus."
}

Example B — Eid distributions, problem-solution + price ladder:
{
  "title": "أحد شايل هم توزيعات العيد دحين؟ موضوعك عندي",
  "title_en": "Worried about Eid distributions? I got you covered",
  "description": "نبدأ بسؤال يلامس كل بيت قبل العيد، ثم نعرض البوكسات بـ [السعر الجديد] بدال [السعر القديم] في السوق. نشوف الترند الحين ونقترح ايش تحطو فيها (حلاوة نظارة، حلاوة مصاص، كت كات، ويفر تولا — كل وحده بـ [السعر الجديد]). نختم بمشهد الفلوس داخل التوزيعة وقفلة 'ولا التوزيعة مالها داعي'.",
  "description_en": "Open with a question every household worries about before Eid, then show the distribution boxes at [new price] vs [old price] in the market. Walk through trending fillers (sunglasses candy, sucker candy, KitKat miniatures, Tola wafers) each at [new price]. Close on the cash-inside-the-box gag.",
  "pattern_id": "P3",
  "suggested_branch": "Al Salama",
  "theme": "eid distributions boxes",
  "occasion": "eid",
  "format": "video",
  "default_platforms": ["tiktok", "instagram", "snapchat"],
  "reasoning": "Eid is upcoming + 'موضوعك عندي' is a proven high-engagement Kayan opener."
}

# TASK

Generate ${count} fresh topic ideas. Prioritize stale branches + stale patterns. Match the dialect and structure of the few-shot examples above. Output ONLY the JSON object below — no commentary.

{
  "items": [
    {
      "title": "<Saudi-Arabic, hook-style — what would catch a Saudi scroller, 5-12 words>",
      "title_en": "<English plain summary, 5-12 words>",
      "description": "<Saudi-Arabic, 2-4 sentences explaining the angle, the products/setup, and the structure beats. Use prices placeholders [السعر القديم] / [السعر الجديد].>",
      "description_en": "<English plain summary, 2-4 sentences. Use [old price] / [new price] placeholders.>",
      "pattern_id": "<one of P1-P9>",
      "suggested_branch": "<exact branch name from voice config, or null if not branch-specific>",
      "theme": "<focus product or angle, 3-8 words, English or Arabic — internal label>",
      "occasion": "<one of: regular, ramadan, eid, national_day, mothers_day, fathers_day, back_to_school, summer, derby_weekend, riyadh_season>",
      "format": "<one of: video, story, shop_activity, influencer_collab, offer, general>",
      "default_platforms": ["<one or more of: tiktok, instagram, snapchat — required for video/story, [] otherwise>"],
      "reasoning": "<one English sentence: why this combo, why now>"
    }
    // ... ${count} total
  ]
}

Rules:
- pattern_id MUST be one of the 9 patterns (P1–P9).
- suggested_branch MUST exactly match a branch name in voice config, or be null.
- format defaults to "video" unless the topic clearly fits another shape.
- default_platforms is required for video/story formats (one or more of tiktok/instagram/snapchat). Use [] for other formats.
- One shoot = one entry. Don't split a single video idea across multiple entries per platform — list all platforms in default_platforms.
- DO NOT repeat queued topics or recent themes.
- DO NOT invent specific prices — use the placeholders.
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
      // 4000 leaves headroom for 5 fully bilingual items (Arabic + English
      // title + description) plus the new format/default_platforms fields
      // added after migration 0050. Truncation at 2000 was producing
      // unparseable JSON.
      max_completion_tokens: 4000,
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
    // Surface the raw preview directly in the error message so the frontend
    // toast carries enough info to diagnose without digging into Edge Function
    // logs. The full raw response is still attached as `preview` in details.
    const previewSnippet = raw.slice(0, 200).replace(/\s+/g, " ").trim();
    return jsonError(
      "INTERNAL_ERROR",
      previewSnippet.length > 0
        ? `AI returned non-JSON content. First 200 chars: ${previewSnippet}`
        : "AI returned an empty response.",
      500,
      { preview: raw.slice(0, 600) },
    );
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

  const rowsToInsert = validated.map((s) => {
    // Normalize platforms vs format: content formats need at least one
    // platform; if the AI forgot, default to all three. Non-content formats
    // must have an empty array (the DB CHECK is strict).
    const isContent = CONTENT_FORMATS.has(s.format);
    let defaultPlatforms = s.default_platforms ?? [];
    if (isContent && defaultPlatforms.length === 0) {
      defaultPlatforms = ["tiktok", "instagram", "snapchat"];
    }
    if (!isContent) {
      defaultPlatforms = [];
    }
    return {
      brand_id: brandId,
      title: s.title,
      title_en: s.title_en ?? null,
      // Use the AI's `description` (the angle write-up). Fall back to
      // `reasoning` for legacy callers and earlier prompt versions that
      // didn't emit a description field.
      description: s.description ?? s.reasoning ?? null,
      description_en: s.description_en ?? null,
      pattern_id: s.pattern_id,
      branch_id: s.suggested_branch
        ? (branchByName.get(s.suggested_branch.toLowerCase()) ?? null)
        : null,
      theme: s.theme,
      occasion: s.occasion,
      format: s.format,
      default_platforms: defaultPlatforms,
      priority: 0,
      notes: null,
      created_by: auth.userId,
      status: "queued" as const,
    };
  });

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
