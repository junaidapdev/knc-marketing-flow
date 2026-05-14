import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";

const PROMPT_TEMPLATES = [
  "generate_script",
  "suggest_hooks",
  "caption_hashtags",
  "content_gap_analysis",
  "trend_brief",
  "monthly_report",
  "freeform",
] as const;

const CONTEXT_TYPES = ["entry", "campaign", "calendar", "performance", "freeform"] as const;

// Entry-level metadata used by `generate_script` to bind the system prompt
// to a specific Kayan post. Every field is optional — a request that omits
// `entryContext` (or sends only some fields) produces a valid prompt that
// just falls back to brand-DNA-only generation.
//
// branchId added in chunk 7: when provided, the products lookup filters to
// items actually stocked at that branch. branchName is still accepted (used
// in the brief block as the human label) and we resolve name→id ourselves
// when only the name is sent.
const entryContextSchema = z
  .object({
    patternId: z.string().regex(/^P\d{1,2}$/, "Pattern id like P1, P9").optional(),
    branchId: z.string().uuid().optional(),
    branchName: z.string().min(1).max(120).optional(),
    theme: z.string().min(1).max(200).optional(),
    // Content format after migration 0050 (video/story/etc.) + the platforms
    // the entry publishes to. Both optional so older callers don't break.
    format: z.string().min(1).max(40).optional(),
    platforms: z.array(z.enum(["tiktok", "instagram", "snapchat"])).optional(),
    occasion: z.string().min(1).max(40).optional(),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict()
  .optional();

const requestSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  contextType: z.enum(CONTEXT_TYPES),
  contextId: z.string().uuid().nullable().optional(),
  promptTemplate: z.enum(PROMPT_TEMPLATES),
  userMessage: z.string().min(1).max(10000),
  contextPayload: z.record(z.unknown()).optional(),
  entryContext: entryContextSchema,
});

type EntryContext = z.infer<typeof entryContextSchema>;

// Look up a pattern's display name from voice_config.patterns. Returns null
// if the array is missing/malformed or the id doesn't match — caller decides
// whether to fall back to the bare id or omit the line.
function lookupPatternName(
  voiceConfig: Record<string, unknown>,
  patternId: string,
): string | null {
  const patterns = voiceConfig.patterns;
  if (!Array.isArray(patterns)) return null;
  for (const p of patterns) {
    if (
      p &&
      typeof p === "object" &&
      "id" in p &&
      "name" in p &&
      (p as { id: unknown }).id === patternId &&
      typeof (p as { name: unknown }).name === "string"
    ) {
      return (p as { name: string }).name;
    }
  }
  return null;
}

// Build the "THIS SPECIFIC SCRIPT BRIEF" block for generate_script when the
// caller supplies entryContext. Each metadata line and CRITICAL bullet is
// emitted only if its source field is present — missing fields drop their
// line, never fabricate. Returns "" when the brief would be empty (no usable
// fields), so the caller can skip the section entirely.
function buildEntryBriefBlock(
  ctx: EntryContext,
  voiceConfig: Record<string, unknown>,
): string {
  if (!ctx) return "";

  const lines: string[] = [];
  if (ctx.patternId) {
    const name = lookupPatternName(voiceConfig, ctx.patternId);
    lines.push(
      name
        ? `Pattern to follow: ${ctx.patternId} — ${name}`
        : `Pattern to follow: ${ctx.patternId}`,
    );
  }
  if (ctx.branchName) lines.push(`Branch to feature: ${ctx.branchName}`);
  if (ctx.theme) lines.push(`Product/theme focus: ${ctx.theme}`);
  if (ctx.format) {
    const platformLine =
      ctx.platforms && ctx.platforms.length > 0
        ? ` (publishing to ${ctx.platforms.join(", ")})`
        : "";
    lines.push(`Format: ${ctx.format}${platformLine}`);
  }
  // occasion: if absent, the spec says to default to "regular content" rather
  // than omit, so the LLM has SOMETHING to anchor on.
  lines.push(`Occasion: ${ctx.occasion ?? "regular content"}`);

  if (lines.length === 0) return "";

  // CRITICAL bullets — only include the ones whose referenced field exists.
  const critical: string[] = [];
  if (ctx.patternId) {
    critical.push(
      `- The script MUST follow the structural formula of pattern ${ctx.patternId}.`,
    );
    critical.push(`- Refer to the pattern description in the BRAND DNA above.`);
  }
  if (ctx.branchName) {
    critical.push(`- The branch name "${ctx.branchName}" MUST appear in the CTA.`);
  }
  if (ctx.theme) {
    critical.push(`- The theme "${ctx.theme}" MUST be the focus of the body section.`);
  }
  // Pattern-specific reinforcements — fire only for the matching pattern so
  // we don't waste tokens reciting irrelevant rules.
  if (ctx.patternId === "P2") {
    critical.push(
      `- Pattern P2 (Fixed-Price Value Stack): every product mentioned MUST be at 11.50 SR — no exceptions. Mixing prices breaks the brand promise.`,
    );
  }
  if (ctx.patternId === "P7") {
    critical.push(
      `- Pattern P7 (Event Prediction Giveaway): the CTA must explicitly ask for comments with the prediction.`,
    );
  }
  if (ctx.patternId === "P9") {
    critical.push(
      `- Pattern P9 (Quality Objection Rebuttal): the body MUST contain a sensory product demonstration described in shot directions.`,
    );
  }

  const criticalBlock = critical.length > 0 ? `\n\nCRITICAL:\n${critical.join("\n")}` : "";

  return `\n\n# THIS SPECIFIC SCRIPT BRIEF
You are writing for THIS specific video. Use the following metadata to anchor your output:

${lines.join("\n")}${criticalBlock}

If any of these fields are missing, omit only the missing line — don't fabricate.
`;
}

// ─────── Product catalog loader (chunk 7) ───────
//
// When generate_script + entryContext is supplied, we pull a small set of
// "relevant" products from the catalog to inject by name into the prompt.
// Goal: scripts reference REAL products (Pepero, Tiffany, Fahadah) instead
// of generic "candy". The relevance rules:
//
//   1. Always include hero products (Kayan's signature items).
//   2. Always include trending products (viral / new arrivals).
//   3. If theme is set, fuzzy-match it against name + manufacturer +
//      marketing_notes + tags.
//   4. If branchId is set, drop any product not stocked at that branch.
//   5. Cap at MAX_PRODUCTS so we don't blow the context window.

const MAX_PRODUCTS = 20;

interface ProductRow {
  id: string;
  name: string;
  manufacturer: string | null;
  marketing_notes: string | null;
  tags: string[] | null;
  price_tier: string;
  is_trending: boolean;
  is_hero_product: boolean;
  category: { name: string | null } | null;
  branches: Array<{ branch_id: string; is_in_stock: boolean }> | null;
}

interface RelevantProduct {
  id: string;
  name: string;
  manufacturer: string | null;
  marketingNotes: string | null;
  tags: string[];
  priceTier: string;
  isHero: boolean;
  isTrending: boolean;
  categoryName: string;
  // Source flag for debugging / token telemetry — which rule pulled this row in.
  sourceTag: "hero" | "trending" | "theme";
}

type DbClient = ReturnType<typeof createClient>;

interface MarketingEventRow {
  title: string;
  event_type: string;
  importance: string;
  start_date: string;
  end_date: string;
  marketing_notes: string | null;
  branch_focus: string[] | null;
  is_date_estimate: boolean;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadNearbyMarketingEvents(
  db: DbClient,
  brandId: string,
  targetDate: string | null,
): Promise<MarketingEventRow[]> {
  if (!targetDate) return [];
  const from = addDays(targetDate, -7);
  const to = addDays(targetDate, 14);
  const { data } = await db
    .from("marketing_events")
    .select(
      "title, event_type, importance, start_date, end_date, marketing_notes, branch_focus, is_date_estimate",
    )
    .eq("brand_id", brandId)
    .eq("status", "active")
    .gte("end_date", from)
    .lte("start_date", to)
    .order("start_date", { ascending: true });
  return (data ?? []) as MarketingEventRow[];
}

function buildMarketingEventsBlock(events: MarketingEventRow[]): string {
  if (events.length === 0) return "";
  const lines = ["", "# NEARBY MARKETING EVENTS", ""];
  lines.push(
    "Use these as planning context when relevant. Do not force a holiday angle if the user's request is unrelated.",
  );
  lines.push("");
  for (const e of events) {
    const date =
      e.start_date === e.end_date ? e.start_date : `${e.start_date} to ${e.end_date}`;
    const estimate = e.is_date_estimate ? " estimated date" : "";
    const branches =
      Array.isArray(e.branch_focus) && e.branch_focus.length > 0
        ? ` Branch focus: ${e.branch_focus.join(", ")}.`
        : "";
    const notes = e.marketing_notes ? ` Notes: ${e.marketing_notes}` : "";
    lines.push(
      `- ${e.title} (${date}; ${e.importance}; ${e.event_type}${estimate}).${branches}${notes}`,
    );
  }
  lines.push("");
  return "\n" + lines.join("\n") + "\n";
}

async function loadRelevantProducts(
  db: DbClient,
  brandId: string,
  branchId: string | null,
  theme: string | null,
): Promise<RelevantProduct[]> {
  const baseSelect =
    "id, name, manufacturer, marketing_notes, tags, price_tier, is_trending, is_hero_product, " +
    "category:product_categories(name), branches:product_branches(branch_id, is_in_stock)";

  // Step 1: heroes
  const { data: heroData } = await db
    .from("products")
    .select(baseSelect)
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .eq("is_hero_product", true);

  // Step 2: trending
  const { data: trendingData } = await db
    .from("products")
    .select(baseSelect)
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .eq("is_trending", true);

  // Step 3: theme matches (if theme supplied). Build a multi-keyword `or`
  // filter using ilike across name + manufacturer + marketing_notes. Tag
  // matching is done via `contains` with the lowercased keyword.
  let themeData: ProductRow[] = [];
  if (theme) {
    const words = theme
      .toLowerCase()
      .split(/[\s,;/]+/)
      .map((w) => w.trim().replace(/[%_]/g, ""))
      .filter((w) => w.length > 2);
    if (words.length > 0) {
      const orParts = words
        .flatMap((w) => [
          `name.ilike.%${w}%`,
          `manufacturer.ilike.%${w}%`,
          `marketing_notes.ilike.%${w}%`,
        ])
        .join(",");
      const { data } = await db
        .from("products")
        .select(baseSelect)
        .eq("brand_id", brandId)
        .eq("is_active", true)
        .or(orParts);
      themeData = (data ?? []) as ProductRow[];

      // Also pull tag matches (no easy combined `or` with `contains`).
      for (const w of words) {
        const { data: tagData } = await db
          .from("products")
          .select(baseSelect)
          .eq("brand_id", brandId)
          .eq("is_active", true)
          .contains("tags", [w]);
        if (tagData) themeData = themeData.concat(tagData as ProductRow[]);
      }
    }
  }

  const heroes = (heroData ?? []) as ProductRow[];
  const trending = (trendingData ?? []) as ProductRow[];

  // Branch filter: drop anything not stocked at this branch.
  const filterByBranch = (rows: ProductRow[]): ProductRow[] => {
    if (!branchId) return rows;
    return rows.filter((p) =>
      Array.isArray(p.branches) &&
      p.branches.some((b) => b.branch_id === branchId && b.is_in_stock !== false),
    );
  };

  // Combine in priority order, dedupe by id, keep the first sourceTag we see.
  const seen = new Set<string>();
  const out: RelevantProduct[] = [];
  const push = (rows: ProductRow[], sourceTag: RelevantProduct["sourceTag"]): void => {
    for (const p of filterByBranch(rows)) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({
        id: p.id,
        name: p.name,
        manufacturer: p.manufacturer,
        marketingNotes: p.marketing_notes,
        tags: Array.isArray(p.tags) ? p.tags : [],
        priceTier: p.price_tier,
        isHero: p.is_hero_product,
        isTrending: p.is_trending,
        categoryName: p.category?.name ?? "",
        sourceTag,
      });
      if (out.length >= MAX_PRODUCTS) return;
    }
  };

  push(heroes, "hero");
  push(trending, "trending");
  push(themeData, "theme");

  return out;
}

function buildProductsBlock(products: RelevantProduct[]): string {
  if (products.length === 0) return "";

  const lines: string[] = ["", "# RELEVANT PRODUCTS FOR THIS SCRIPT", ""];
  lines.push(
    "These are the actual products the script can reference. Use real product names — do not invent products. Each product includes context for how to mention it.",
  );
  lines.push("");

  for (const p of products) {
    const flagBits: string[] = [];
    if (p.isHero) flagBits.push("★ HERO");
    if (p.isTrending) flagBits.push("🔥 TRENDING");
    const flags = flagBits.length > 0 ? ` ${flagBits.join(" ")}` : "";
    const category = p.categoryName ? ` (${p.categoryName})` : "";
    lines.push(`- **${p.name}**${category}`);
    lines.push(`  Manufacturer: ${p.manufacturer ?? "N/A"}`);
    lines.push(`  Tier: ${p.priceTier}${flags}`);
    if (p.marketingNotes) lines.push(`  Notes: ${p.marketingNotes}`);
    if (p.tags.length > 0) lines.push(`  Tags: ${p.tags.join(", ")}`);
  }

  lines.push("");
  lines.push("CRITICAL:");
  lines.push("- Only reference products from this list. Do not invent product names.");
  lines.push(
    '- If the script needs a product that isn\'t in this list, refer to it generically (e.g., "imported chocolate") rather than making up a brand name.',
  );
  lines.push(
    '- Tier "anchor" = 11.50 SR. Tier "premium" = open price. Tier "bulk" = multi-pack bundle at the anchor price. Tier "open_price" = variable.',
  );
  lines.push("- Hero products should be emphasized — these are Kayan's signature items.");
  lines.push(
    "- Trending products are the timely ones — feature them in new-arrival or viral-themed content.",
  );

  return "\n" + lines.join("\n") + "\n";
}

function buildSystemPrompt(
  template: string,
  voiceConfig: Record<string, unknown>,
  dnaMarkdown: string | null,
  entryContext?: EntryContext,
  productsBlock = "",
  marketingEventsBlock = "",
): string {
  // Saudi-dialect contract — applied to every AI template. Without this
  // the model leans toward MSA or pan-Arab phrasing, which the marketer
  // flagged as unnatural for Kayan's audience. The required vocabulary
  // and forbidden patterns below give the model concrete rails.
  const dialectContract = `\nLanguage rules (apply to every Arabic line you produce):
- Write in Saudi colloquial dialect (لهجة سعودية، نجدية أو حجازية). NOT Modern Standard Arabic.
- NOT Egyptian (no إيه / ازاي / دلوقتي), NOT Levantine (no شو / كيف الحال).
- Use these Saudi markers naturally where they fit: ابغى / ابغاكم, خليني / خلني, مستعدين, يالله, تبغون / تبغوا, وش / ايش, خلنا نشوف, تابعوا, تعالوا.
- Use these Saudi reactions when something works: ماشاء الله, كفو, كفو عليك, يا سلام, يا لطييييف.
- Sound like a real Saudi creator talking to a phone camera, not a translated marketing brief. Spoken, warm, direct.
- Drawn-out emphasis is encouraged: "يا لطييييف", "حلوووو".`;

  const baseVoice = `You are an AI assistant for Kayan Sweets, a Saudi confectionery retail chain.
Brand voice: ${JSON.stringify(voiceConfig)}.
Always respect this voice.${dialectContract}`;

  // Brand DNA is the marketer's long-form bible — values, pillars, audience,
  // do/don't, examples. Injected verbatim so generation sounds like Kayan,
  // not generic.
  const dnaBlock = dnaMarkdown && dnaMarkdown.trim().length > 0
    ? `\n\n# BRAND DNA (read carefully, every output must reflect this)\n${dnaMarkdown}\n# END BRAND DNA\n`
    : "";

  // Per-call brief — only injected for generate_script when entryContext is
  // supplied. Lands AFTER the BRAND DNA block (and after the products block)
  // so the LLM reads "global voice → catalog → script-specific anchors → task".
  const briefBlock = template === "generate_script"
    ? buildEntryBriefBlock(entryContext, voiceConfig)
    : "";

  // Products block (chunk 7) — only meaningful for generate_script. Built by
  // the caller because it's an async DB query; passed in here as a string.
  const productsSection = template === "generate_script" ? productsBlock : "";

  // Templates that produce content for an entry's authoring fields return
  // structured sections so the frontend can offer per-field "Save" buttons
  // (Save to script / caption / hashtags). Use EXACT headings so the parser
  // matches reliably.
  const STRUCTURED_NOTE = `\nReturn your response in EXACTLY this Markdown structure. Do not add any preamble before the first ## heading. Use these heading names verbatim:`;

  switch (template) {
    case "generate_script":
      return `${baseVoice}${dnaBlock}${marketingEventsBlock}${productsSection}${briefBlock}
Your role: a Saudi content creator scripting a short-form video for talent to read direct-to-camera. You are NOT a video producer writing a treatment for a director — production direction goes in its own section, separate from the spoken copy.

Your task: write a 15-60 second short-form video script.

Script-section rules (## Script):
- Saudi colloquial Arabic ONLY. No English in this section. No MSA. No bracketed shot direction.
- Single narrator unless the pattern explicitly calls for two voices. Don't invent "Commentator 1 / Commentator 2" labels.
- Spoken, conversational — what the talent actually says when holding the phone.
- Open with a hook the talent says in voice (a question, a setup, a claim) — not a description of a shot.
- End with a CTA that matches the pattern (comments-bait for evaluation patterns, "be next" for challenge patterns, etc.).

Shot-directions-section rules (## Shot directions):
- Bilingual short imperatives — one line per shot, Arabic / English on the same line separated by " — ".
- Practical for the camera and director: "Close-up on packaging — لقطة قريبة على التغليف", "Timer overlay — لقطة على المؤقت".
- Keep each line under ~80 characters. Maximum 10 lines.
- This is where ALL bracketed direction lives. The Script section stays clean.

Caption + hashtags rules:
- Bilingual (Arabic + English). Caption ready to paste. 5-8 hashtags mixing branded (#KayanSweets, #حلويات_كيان) and trending.
${STRUCTURED_NOTE}

## Script
[Saudi colloquial Arabic only. Hook → body → CTA, written as one flowing voiceover the talent reads to camera. No brackets, no English, no shot direction in this section.]

## Shot directions
[Bilingual short shot list. Each line: "<English imperative> — <Arabic imperative>". Under 10 lines.]

## Caption
[Publishing caption — bilingual reads, ready to paste.]

## Hashtags
[5-8 hashtags space-separated, mix of branded (#KayanSweets, #حلويات_كيان) and trending.]`;

    case "suggest_hooks":
      return `${baseVoice}${dnaBlock}${marketingEventsBlock}
Your task: provide 5 different opening hooks (first 3 seconds) that grab attention differently — curiosity, surprise, question, bold claim, relatable scenario. Numbered list, both languages.`;

    case "caption_hashtags":
      return `${baseVoice}${dnaBlock}${marketingEventsBlock}
Your task: write a platform-tailored caption with 5-8 relevant hashtags mixing branded and trending tags. Both languages.
${STRUCTURED_NOTE}

## Caption
[The caption — bilingual, ready to paste.]

## Hashtags
[Space-separated hashtags.]`;

    case "content_gap_analysis":
      return `${baseVoice}${dnaBlock}${marketingEventsBlock}
Kayan content rules: 5 videos per week minimum, daily IG + Snap stories, balance between product showcase and trends.
Your task: analyze the planned content and identify gaps. Suggest specific entries to fill them.`;

    case "trend_brief":
      return `${baseVoice}${dnaBlock}${marketingEventsBlock}
Your task: when given trending video formats or descriptions, suggest 3 ways Kayan can adapt each, keeping brand voice.`;

    case "monthly_report":
      return `${baseVoice}${dnaBlock}${marketingEventsBlock}
You are writing the monthly marketing report for Kayan Sweets leadership. Be data-forward, concise, action-oriented. Cover: 1) Content summary, 2) Engagement metrics, 3) Follower growth, 4) Ad performance, 5) Sales impact, 6) Insights & next steps.`;

    case "freeform":
    default:
      return `${baseVoice}${dnaBlock}${marketingEventsBlock}`;
  }
}

interface OpenAIResponse {
  choices: Array<{
    message?: { role: string; content?: string | null };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens?: number };
}

interface PriorMessageRow {
  role: "user" | "assistant" | "system";
  content: string;
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

  // Load brand voice config (V1 single-tenant — first brand). Brand id is
  // needed by the chunk-7 product loader downstream.
  const { data: brand } = await db
    .from("brands")
    .select("id, voice_config, dna_markdown")
    .limit(1)
    .single();
  const voiceConfig = (brand?.voice_config as Record<string, unknown>) ?? {};
  const dnaMarkdown = (brand?.dna_markdown as string | null) ?? null;
  const brandIdForContext = (brand as { id?: string } | null)?.id ?? null;

  // Get or create conversation
  let conversationId = parsed.data.conversationId ?? null;
  if (!conversationId) {
    const { data: convo, error: convoErr } = await db
      .from("ai_conversations")
      .insert({
        user_id: auth.userId,
        context_type: parsed.data.contextType,
        context_id: parsed.data.contextId ?? null,
        prompt_template: parsed.data.promptTemplate,
      })
      .select()
      .single();
    if (convoErr) return jsonError("INTERNAL_ERROR", convoErr.message, 500);
    conversationId = convo.id as string;
  }

  // Load prior messages
  const { data: priorMessages } = await db
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  // Resolve branchName → branchId when only the name was sent. The frontend
  // can now send branchId directly (chunk 7) but older callers still send
  // just the name; this keeps both forms working.
  let resolvedBranchId: string | null = parsed.data.entryContext?.branchId ?? null;
  if (
    parsed.data.promptTemplate === "generate_script" &&
    !resolvedBranchId &&
    parsed.data.entryContext?.branchName
  ) {
    const { data: branchRow } = await db
      .from("branches")
      .select("id")
      .ilike("name", parsed.data.entryContext.branchName)
      .limit(1)
      .single();
    if (branchRow?.id) resolvedBranchId = branchRow.id as string;
  }

  // Resolve the entry target date for seasonal context. Inline generation now
  // sends entryContext.targetDate directly; older/global panel calls can still
  // be enriched by looking up the entry when contextType/contextId point to it.
  let targetDateForEvents: string | null = parsed.data.entryContext?.targetDate ?? null;
  if (!targetDateForEvents && parsed.data.contextType === "entry" && parsed.data.contextId) {
    const { data: entryRow } = await db
      .from("calendar_entries")
      .select("target_date")
      .eq("id", parsed.data.contextId)
      .single();
    targetDateForEvents = (entryRow as { target_date?: string } | null)?.target_date ?? null;
  }

  let marketingEventsBlock = "";
  if (brandIdForContext) {
    const nearbyEvents = await loadNearbyMarketingEvents(
      db,
      brandIdForContext,
      targetDateForEvents,
    );
    marketingEventsBlock = buildMarketingEventsBlock(nearbyEvents);
  }

  // Pull the branch-aware product slice for generate_script. Other templates
  // (caption_hashtags, suggest_hooks, etc.) skip this — only the script
  // template benefits from the catalog injection.
  let productsBlock = "";
  const brandIdForProducts = brandIdForContext;
  if (parsed.data.promptTemplate === "generate_script" && brandIdForProducts) {
    const products = await loadRelevantProducts(
      db,
      brandIdForProducts,
      resolvedBranchId,
      parsed.data.entryContext?.theme ?? null,
    );
    productsBlock = buildProductsBlock(products);
  }

  const systemPrompt = buildSystemPrompt(
    parsed.data.promptTemplate,
    voiceConfig,
    dnaMarkdown,
    parsed.data.entryContext,
    productsBlock,
    marketingEventsBlock,
  );
  const userContent = parsed.data.contextPayload
    ? `${parsed.data.userMessage}\n\nContext data: ${JSON.stringify(parsed.data.contextPayload)}`
    : parsed.data.userMessage;

  // Save user message
  await db.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: userContent,
  });

  // Build OpenAI messages array — system prompt becomes the first message
  // (OpenAI doesn't accept a separate `system` field in chat completions).
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...((priorMessages ?? []) as PriorMessageRow[])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userContent },
  ];

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
      // Older chat models still accept it.
      max_completion_tokens: 2000,
      messages,
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    return jsonError("INTERNAL_ERROR", `AI error: ${errText.slice(0, 200)}`, 500);
  }

  const aiData = (await openaiRes.json()) as OpenAIResponse;
  const assistantText = aiData.choices[0]?.message?.content ?? "";

  // Save assistant message with token usage
  await db.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: assistantText,
    tokens_used: (aiData.usage?.prompt_tokens ?? 0) + (aiData.usage?.completion_tokens ?? 0),
  });

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        conversationId,
        assistantMessage: assistantText,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
