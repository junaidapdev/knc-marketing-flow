import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";
import {
  TOPIC_GENERATION_LANE_VALUES,
  TOPIC_GENERATION_MODE_CONFIG,
  TOPIC_GENERATION_MODE_LANES,
  TOPIC_GENERATION_MODE_VALUES,
  TOPIC_GENERATION_MODES,
  TOPIC_MAX_CRITIC_ATTEMPTS,
  TOPIC_MAX_GENERATED_IDEAS,
  TOPIC_MIN_OVERALL_SAVE_SCORE,
  TOPIC_OVERGENERATION_EXTRA,
  TOPIC_OVERGENERATION_MULTIPLIER,
  TOPIC_CRITIC_MAX_COMPLETION_TOKENS,
  TOPIC_RAW_GENERATION_MAX_COMPLETION_TOKENS,
  TOPIC_SCORE_DIMENSIONS,
  TOPIC_SCORE_LABELS,
  TOPIC_SCORE_MAX,
  TOPIC_SCORE_MIN,
  type TopicGenerationLane,
  type TopicGenerationMode,
  type TopicScoreDimension,
} from "./topic-generation.ts";

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
const TOPIC_MEMORY_STATUSES = ["queued", "in_progress", "used", "archived"] as const;
const ACTIVE_TOPIC_STATUSES = new Set<string>(["queued", "in_progress"]);
const TOPIC_MEMORY_LIMIT = 120;
const AVOID_GROUP_LIMIT = 35;
const RECENT_ENTRY_MEMORY_LIMIT = 60;
const RECENT_THEME_LIMIT = 45;
const TITLE_THEME_SIMILARITY_THRESHOLD = 0.72;
const FINGERPRINT_SIMILARITY_THRESHOLD = 0.82;
const MIN_SIMILARITY_TOKENS = 3;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "your",
  "you",
  "this",
  "that",
  "هذي",
  "هذا",
  "هذه",
  "في",
  "من",
  "على",
  "عن",
  "مع",
  "الي",
  "اللي",
  "وش",
  "ايش",
  "أيش",
  "او",
  "أو",
  "و",
  "يا",
  "كل",
  "بس",
  "كذا",
  "دحين",
  "موضوعك",
  "عندي",
]);

const requestSchema = z.object({
  count: z.number().int().min(1).max(10).default(5),
  occasion: z.string().min(1).max(40).optional(),
  excludeRecentDays: z.number().int().min(0).max(180).default(30),
  mode: z.enum(TOPIC_GENERATION_MODE_VALUES).default(TOPIC_GENERATION_MODES.BALANCED),
  branchId: z.string().uuid().optional(),
  productFocus: z.string().trim().min(1).max(200).optional(),
  audienceFocus: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().min(1).max(1200).optional(),
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
  lane: z.enum(TOPIC_GENERATION_LANE_VALUES),
  novelty_reason: z.string().min(1).max(1000),
  business_goal: z.string().min(1).max(500),
  production_notes: z.string().min(1).max(1000),
});

type Suggestion = z.infer<typeof suggestionSchema>;

const criticDecisionValues = ["save", "revise", "reject"] as const;

const criticScoresSchema = z.object({
  [TOPIC_SCORE_DIMENSIONS.BRAND_FIT]: z.number().min(TOPIC_SCORE_MIN).max(TOPIC_SCORE_MAX),
  [TOPIC_SCORE_DIMENSIONS.NOVELTY]: z.number().min(TOPIC_SCORE_MIN).max(TOPIC_SCORE_MAX),
  [TOPIC_SCORE_DIMENSIONS.SEASONAL_RELEVANCE]: z
    .number()
    .min(TOPIC_SCORE_MIN)
    .max(TOPIC_SCORE_MAX),
  [TOPIC_SCORE_DIMENSIONS.PRODUCTION_EASE]: z
    .number()
    .min(TOPIC_SCORE_MIN)
    .max(TOPIC_SCORE_MAX),
  [TOPIC_SCORE_DIMENSIONS.SALES_USEFULNESS]: z
    .number()
    .min(TOPIC_SCORE_MIN)
    .max(TOPIC_SCORE_MAX),
  [TOPIC_SCORE_DIMENSIONS.CREATOR_ENERGY]: z
    .number()
    .min(TOPIC_SCORE_MIN)
    .max(TOPIC_SCORE_MAX),
});

const criticItemSchema = z.object({
  index: z.number().int().min(0),
  decision: z.enum(criticDecisionValues),
  scores: criticScoresSchema,
  overall_score: z.number().min(TOPIC_SCORE_MIN).max(TOPIC_SCORE_MAX),
  critique_reason: z.string().min(1).max(1200),
  improved_item: suggestionSchema.partial().nullable().optional(),
  improved_title: z.string().min(3).max(200).nullable().optional(),
  improved_title_en: z.string().min(3).max(200).nullable().optional(),
  improved_description: z.string().min(1).max(2000).nullable().optional(),
  improved_description_en: z.string().min(1).max(2000).nullable().optional(),
  improved_theme: z.string().min(1).max(200).nullable().optional(),
  improved_novelty_reason: z.string().min(1).max(1000).nullable().optional(),
  improved_business_goal: z.string().min(1).max(500).nullable().optional(),
  improved_production_notes: z.string().min(1).max(1000).nullable().optional(),
});

const criticResponseSchema = z.object({
  items: z.array(criticItemSchema),
});

type CriticItem = z.infer<typeof criticItemSchema>;
type TopicScoreMap = z.infer<typeof criticScoresSchema>;

interface ReviewedSuggestion {
  item: Suggestion;
  index: number;
  scores: TopicScoreMap;
  overallScore: number;
  decision: (typeof criticDecisionValues)[number];
  critiqueReason: string;
}

interface BranchRow {
  id: string;
  name: string;
  city: string;
  last_featured_date: string | null;
}

interface CalendarEntryRow {
  id: string;
  title: string;
  description: string | null;
  pattern_id: string | null;
  branch_id: string | null;
  theme: string | null;
  target_date: string;
}

interface TopicRow {
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  theme: string | null;
  pattern_id: string | null;
  branch_id: string | null;
  occasion: string | null;
  status: (typeof TOPIC_MEMORY_STATUSES)[number];
  created_at: string;
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

interface SkippedSuggestion {
  index: number;
  reason: string;
  matchedTitle?: string;
  matchedTheme?: string;
}

interface ValidatedSuggestion {
  item: Suggestion;
  index: number;
}

interface MemoryFingerprint {
  title: string;
  theme: string | null;
  fingerprintTokens: Set<string>;
  titleThemeTokens: Set<string>;
}

interface DuplicateMatch {
  title: string;
  theme: string | null;
}

// Small helper to format a date as "YYYY-MM-DD" UTC, matching what the rest
// of the app stores in date columns.
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeRawGenerationCount(requestedCount: number): number {
  return Math.min(
    TOPIC_MAX_GENERATED_IDEAS,
    Math.max(
      requestedCount * TOPIC_OVERGENERATION_MULTIPLIER,
      requestedCount + TOPIC_OVERGENERATION_EXTRA,
    ),
  );
}

function normalizeForSimilarity(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensFromParts(parts: Array<string | null | undefined>): Set<string> {
  const normalized = normalizeForSimilarity(parts.filter(Boolean).join(" "));
  if (!normalized) return new Set();
  return new Set(
    normalized
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

function tokenOverlapScore(left: Set<string>, right: Set<string>): number {
  const smaller = left.size <= right.size ? left : right;
  const larger = left.size <= right.size ? right : left;
  if (smaller.size < MIN_SIMILARITY_TOKENS || larger.size < MIN_SIMILARITY_TOKENS) {
    return 0;
  }
  let overlap = 0;
  for (const token of smaller) {
    if (larger.has(token)) overlap += 1;
  }
  return overlap / smaller.size;
}

function formatMemoryItem(item: {
  title: string;
  title_en?: string | null;
  theme: string | null;
  pattern_id: string | null;
  occasion?: string | null;
  status?: string | null;
}): string {
  const titleEn = item.title_en ? ` / ${item.title_en}` : "";
  const bits = [
    item.pattern_id ? `pattern ${item.pattern_id}` : null,
    item.theme ? `theme: ${item.theme}` : null,
    item.occasion ? `occasion: ${item.occasion}` : null,
    item.status ? `status: ${item.status}` : null,
  ].filter((bit): bit is string => Boolean(bit));
  return `- "${item.title}${titleEn}"${bits.length > 0 ? ` (${bits.join("; ")})` : ""}`;
}

function formatMemoryList(items: TopicRow[], limit = AVOID_GROUP_LIMIT): string {
  if (items.length === 0) return "- (none)";
  return items.slice(0, limit).map(formatMemoryItem).join("\n");
}

function formatEntryMemoryList(items: CalendarEntryRow[]): string {
  if (items.length === 0) return "- (none)";
  return items
    .slice(0, RECENT_ENTRY_MEMORY_LIMIT)
    .map((entry) =>
      formatMemoryItem({
        title: entry.title,
        theme: entry.theme,
        pattern_id: entry.pattern_id,
        status: `calendar ${entry.target_date}`,
      })
    )
    .join("\n");
}

function uniqueNonEmpty(values: Array<string | null | undefined>, limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = normalizeForSimilarity(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

function buildAvoidMemoryBlock(topicMemory: TopicRow[], recentEntries: CalendarEntryRow[]): string {
  const activeTopics = topicMemory.filter((topic) => ACTIVE_TOPIC_STATUSES.has(topic.status));
  const usedTopics = topicMemory.filter((topic) => topic.status === "used");
  const archivedTopics = topicMemory.filter((topic) => topic.status === "archived");
  const recentThemes = uniqueNonEmpty(
    [
      ...recentEntries.map((entry) => entry.theme),
      ...topicMemory.map((topic) => topic.theme),
    ],
    RECENT_THEME_LIMIT,
  );

  return `# AVOID MEMORY
Use this as hard novelty context. Do not rephrase these ideas, do not repeat the same product/category + same angle, and do not revive archived topics unless the new angle is meaningfully different.

Queued or in-progress topics already waiting in the queue:
${formatMemoryList(activeTopics)}

Used topics that already became content:
${formatMemoryList(usedTopics)}

Archived/rejected topics. These usually mean the creator rejected the idea, so avoid reviving them:
${formatMemoryList(archivedTopics)}

Recent calendar entries already shipped or planned:
${formatEntryMemoryList(recentEntries)}

Recent themes to avoid repeating:
${recentThemes.length > 0 ? recentThemes.map((theme) => `- ${theme}`).join("\n") : "- (none)"}`;
}

function createMemoryFingerprint(args: {
  title: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  theme: string | null;
  patternId: string | null;
  branchId: string | null;
  occasion?: string | null;
}): MemoryFingerprint {
  return {
    title: args.title,
    theme: args.theme,
    fingerprintTokens: tokensFromParts([
      args.occasion,
      args.patternId,
      args.branchId,
      args.theme,
      args.title,
      args.titleEn,
    ]),
    titleThemeTokens: tokensFromParts([
      args.title,
      args.titleEn,
      args.theme,
      args.description,
      args.descriptionEn,
    ]),
  };
}

function buildExistingFingerprints(
  topicMemory: TopicRow[],
  recentEntries: CalendarEntryRow[],
): MemoryFingerprint[] {
  return [
    ...topicMemory.map((topic) =>
      createMemoryFingerprint({
        title: topic.title,
        titleEn: topic.title_en,
        description: topic.description,
        descriptionEn: topic.description_en,
        theme: topic.theme,
        patternId: topic.pattern_id,
        branchId: topic.branch_id,
        occasion: topic.occasion,
      })
    ),
    ...recentEntries.map((entry) =>
      createMemoryFingerprint({
        title: entry.title,
        description: entry.description,
        theme: entry.theme,
        patternId: entry.pattern_id,
        branchId: entry.branch_id,
      })
    ),
  ];
}

function findNearDuplicate(
  candidate: MemoryFingerprint,
  existing: MemoryFingerprint[],
): DuplicateMatch | null {
  for (const memory of existing) {
    const titleThemeScore = tokenOverlapScore(
      candidate.titleThemeTokens,
      memory.titleThemeTokens,
    );
    if (titleThemeScore >= TITLE_THEME_SIMILARITY_THRESHOLD) {
      return { title: memory.title, theme: memory.theme };
    }

    const fingerprintScore = tokenOverlapScore(
      candidate.fingerprintTokens,
      memory.fingerprintTokens,
    );
    if (fingerprintScore >= FINGERPRINT_SIMILARITY_THRESHOLD) {
      return { title: memory.title, theme: memory.theme };
    }
  }
  return null;
}

function formatLaneLabel(lane: TopicGenerationLane): string {
  return lane.replace(/_/g, " ");
}

function buildLanePlan(mode: TopicGenerationMode, count: number): string {
  const lanes = TOPIC_GENERATION_MODE_LANES[mode];
  const assignments = Array.from({ length: count }, (_value, index) => lanes[index % lanes.length]);
  return assignments
    .map((lane, index) => `${index + 1}. ${lane} — ${formatLaneLabel(lane)}`)
    .join("\n");
}

function buildDirectionBlock(args: {
  selectedBranchName: string | null;
  productFocus?: string;
  audienceFocus?: string;
  notes?: string;
}): string {
  const lines: string[] = [];
  if (args.selectedBranchName) {
    lines.push(`- Branch focus: ${args.selectedBranchName}. Use it only when the lane supports a branch-specific idea.`);
  }
  if (args.productFocus) {
    lines.push(`- Product/category focus: ${args.productFocus}. Use it for product-led or premium-gift lanes.`);
  }
  if (args.audienceFocus) {
    lines.push(`- Audience focus: ${args.audienceFocus}. Build at least one audience-led angle around this.`);
  }
  if (args.notes) {
    lines.push(`- User direction: ${args.notes}`);
  }
  if (lines.length === 0) return "";
  return `\n# USER DIRECTION\n${lines.join("\n")}\n`;
}

function buildTopicNotes(args: {
  mode: TopicGenerationMode;
  lane: TopicGenerationLane;
  businessGoal: string;
  noveltyReason: string;
  productionNotes: string;
  scores: TopicScoreMap;
  overallScore: number;
  criticNote: string;
  reasoning?: string;
}): string {
  const modeConfig = TOPIC_GENERATION_MODE_CONFIG[args.mode];
  return [
    "Topic Generator V2",
    `Lane: ${args.lane}`,
    `Mode: ${modeConfig.label}`,
    `Business goal: ${args.businessGoal}`,
    `Novelty reason: ${args.noveltyReason}`,
    "Scores:",
    `- ${TOPIC_SCORE_LABELS.brand_fit}: ${args.scores.brand_fit}`,
    `- ${TOPIC_SCORE_LABELS.novelty}: ${args.scores.novelty}`,
    `- ${TOPIC_SCORE_LABELS.seasonal_relevance}: ${args.scores.seasonal_relevance}`,
    `- ${TOPIC_SCORE_LABELS.production_ease}: ${args.scores.production_ease}`,
    `- ${TOPIC_SCORE_LABELS.sales_usefulness}: ${args.scores.sales_usefulness}`,
    `- ${TOPIC_SCORE_LABELS.creator_energy}: ${args.scores.creator_energy}`,
    `Overall score: ${args.overallScore}`,
    `Critic note: ${args.criticNote}`,
    `Production notes: ${args.productionNotes}`,
    args.reasoning ? `AI reasoning: ${args.reasoning}` : null,
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function buildSuggesterPrompt(args: {
  voiceConfig: Record<string, unknown>;
  dnaMarkdown: string | null;
  recentEntries: CalendarEntryRow[];
  topicMemory: TopicRow[];
  branches: BranchRow[];
  upcomingEvents: MarketingEventRow[];
  count: number;
  occasionBias?: string;
  windowDays: number;
  mode: TopicGenerationMode;
  selectedBranchName: string | null;
  productFocus?: string;
  audienceFocus?: string;
  notes?: string;
}): string {
  const {
    voiceConfig,
    dnaMarkdown,
    recentEntries,
    topicMemory,
    branches,
    upcomingEvents,
    count,
    occasionBias,
    windowDays,
    mode,
    selectedBranchName,
    productFocus,
    audienceFocus,
    notes,
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

  const activeTopics = topicMemory.filter((topic) => ACTIVE_TOPIC_STATUSES.has(topic.status));

  // Stale branches — those with no entry in the window and no active idea
  // already queued. This prevents regeneration from repeatedly pushing the
  // same "stale" branches before the team has used the first suggestion.
  const recentBranchIds = new Set(
    recentEntries.map((e) => e.branch_id).filter((b): b is string => Boolean(b)),
  );
  const activeTopicBranchIds = new Set(
    activeTopics.map((topic) => topic.branch_id).filter((id): id is string => Boolean(id)),
  );
  const coveredBranchIds = new Set([...recentBranchIds, ...activeTopicBranchIds]);
  const staleBranches = branches.filter((b) => !coveredBranchIds.has(b.id));
  const staleBranchLine = staleBranches.length > 0
    ? staleBranches.map((b) => `${b.name} (${b.city})`).join(", ")
    : "(none)";

  // Stale patterns — pull from voice_config.patterns
  const allPatterns = Array.isArray(voiceConfig.patterns)
    ? (voiceConfig.patterns as Array<{ id: string; name: string }>)
    : [];
  const activePatternIds = new Set(
    activeTopics.map((topic) => topic.pattern_id).filter((id): id is string => Boolean(id)),
  );
  const stalePatterns = allPatterns.filter((p) => !patternUsage.has(p.id) && !activePatternIds.has(p.id));
  const stalePatternLine = stalePatterns.length > 0
    ? stalePatterns.map((p) => `${p.id} (${p.name})`).join(", ")
    : "(none)";

  // Recent themes — to avoid duplicating what we just shipped or already
  // queued. Kept as a compact line for the activity summary; the full avoid
  // block below carries richer grouped memory.
  const recentThemes = recentEntries
    .map((e) => e.theme)
    .concat(topicMemory.map((topic) => topic.theme))
    .filter((t): t is string => Boolean(t))
    .slice(0, 30)
    .join("; ") || "(none)";

  const avoidMemoryBlock = buildAvoidMemoryBlock(topicMemory, recentEntries);

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
  const modeConfig = TOPIC_GENERATION_MODE_CONFIG[mode];
  const lanePlan = buildLanePlan(mode, count);
  const laneValuesLine = TOPIC_GENERATION_LANE_VALUES.join(", ");
  const directionBlock = buildDirectionBlock({
    selectedBranchName,
    productFocus,
    audienceFocus,
    notes,
  });

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

# ACTIVE QUEUE COVERAGE
- Branches already represented in queued/in-progress topics: ${activeTopicBranchIds.size}/${branches.length}
- Patterns already represented in queued/in-progress topics: ${activePatternIds.size}/${allPatterns.length}

${avoidMemoryBlock}
${occasionLine}
${directionBlock}

# GENERATION MODE
Mode: ${modeConfig.label} (${mode})
Description: ${modeConfig.description}
Instruction: ${modeConfig.instruction}

# STRATEGIC LANE REQUIREMENTS
Force variety across these lanes. Follow this lane plan in order, then cycle if you need more ideas:
${lanePlan}

Lane rules:
- Every topic MUST include a "lane" value from this exact list: ${laneValuesLine}.
- Each topic must be clearly different from the others in lane, product/category, hook style, audience, or branch.
- Keep the idea relevant to Kayan Sweets. Do not drift into generic lifestyle content.
- If user direction conflicts with avoid memory, avoid memory wins.

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
  "reasoning": "Behind-the-scenes + reciprocity + return guarantee — high-trust angle, Saudi-pride bonus.",
  "lane": "product_led",
  "novelty_reason": "Uses supplier proof and refund confidence rather than a normal product showcase.",
  "business_goal": "Build trust in a premium chocolate line and make the product feel worth a store visit.",
  "production_notes": "Shoot as a simple factory/supplier walk-through with close-ups of three flavors."
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
  "reasoning": "Eid is upcoming + 'موضوعك عندي' is a proven high-engagement Kayan opener.",
  "lane": "seasonal",
  "novelty_reason": "Frames Eid prep as a solved problem rather than another generic gift mention.",
  "business_goal": "Drive Eid distribution purchases and make Kayan the easiest choice for families.",
  "production_notes": "Show boxes, filler products, and the cash-inside-the-box gag in one quick table setup."
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
      "pattern_id": "<one of P1-P13>",
      "suggested_branch": "<exact branch name from voice config, or null if not branch-specific>",
      "theme": "<focus product or angle, 3-8 words, English or Arabic — internal label>",
      "occasion": "<one of: regular, ramadan, eid, national_day, mothers_day, fathers_day, back_to_school, summer, derby_weekend, riyadh_season>",
      "format": "<one of: video, story, shop_activity, influencer_collab, offer, general>",
      "default_platforms": ["<one or more of: tiktok, instagram, snapchat — required for video/story, [] otherwise>"],
      "reasoning": "<one English sentence: why this combo, why now>",
      "lane": "<one of: ${laneValuesLine}>",
      "novelty_reason": "<one English sentence explaining why this is not a repeat of memory>",
      "business_goal": "<one English sentence explaining what business outcome it supports>",
      "production_notes": "<one English sentence explaining how to shoot it simply>"
    }
    // ... ${count} total
  ]
}

Rules:
- pattern_id MUST be one of the 13 patterns (P1–P13). See the BRAND DNA section above for what each pattern is — match the topic to the most fitting one.
- suggested_branch MUST exactly match a branch name in voice config, or be null.
- format defaults to "video" unless the topic clearly fits another shape.
- default_platforms is required for video/story formats (one or more of tiktok/instagram/snapchat). Use [] for other formats.
- One shoot = one entry. Don't split a single video idea across multiple entries per platform — list all platforms in default_platforms.
- DO NOT repeat queued, used, archived, rejected, or recent calendar ideas.
- DO NOT rephrase old ideas with the same product/category + same angle.
- DO NOT invent specific prices — use the placeholders.
- DO NOT include any commentary outside the JSON.`;
}

function buildCriticPrompt(args: {
  voiceConfig: Record<string, unknown>;
  dnaMarkdown: string | null;
  topicMemory: TopicRow[];
  recentEntries: CalendarEntryRow[];
  candidates: ValidatedSuggestion[];
  mode: TopicGenerationMode;
  occasionBias?: string;
  productFocus?: string;
  audienceFocus?: string;
  notes?: string;
}): string {
  const modeConfig = TOPIC_GENERATION_MODE_CONFIG[args.mode];
  const candidatePayload = args.candidates.map(({ item, index }) => ({
    index,
    ...item,
  }));
  const dnaBlock = args.dnaMarkdown && args.dnaMarkdown.trim().length > 0
    ? `\n# BRAND DNA\n${args.dnaMarkdown}\n# END BRAND DNA\n`
    : "";
  const directionLines = [
    args.occasionBias ? `- Occasion bias: ${args.occasionBias}` : null,
    args.productFocus ? `- Product focus: ${args.productFocus}` : null,
    args.audienceFocus ? `- Audience focus: ${args.audienceFocus}` : null,
    args.notes ? `- User notes: ${args.notes}` : null,
  ].filter((line): line is string => Boolean(line));
  const directionBlock = directionLines.length > 0
    ? `\n# REQUEST DIRECTION\n${directionLines.join("\n")}\n`
    : "";

  return `You are the senior Saudi creative director reviewing Kayan Sweets topic ideas before they are saved to the marketing queue.

Brand voice config:
${JSON.stringify(args.voiceConfig)}
${dnaBlock}

# SELECTED MODE
Mode: ${modeConfig.label} (${args.mode})
Instruction: ${modeConfig.instruction}
${directionBlock}

${buildAvoidMemoryBlock(args.topicMemory, args.recentEntries)}

# CRITIC TASK
Review each candidate idea and decide if it should be saved, revised, or rejected.

Evaluate strictly:
- Is it truly Kayan Sweets, not generic retail content?
- Is it meaningfully different from avoid memory and from other candidates?
- Is it shootable by one creator with a phone inside a branch or simple setup?
- Does it have a clear hook or curiosity reason?
- Does it help sales, store traffic, gifting, product discovery, or creator engagement?
- Is it relevant to the selected mode, occasion, season, product focus, audience focus, or branch logic?
- Does it avoid repeating the same product/category + same angle + same pattern/branch combination?

Score each dimension from ${TOPIC_SCORE_MIN} to ${TOPIC_SCORE_MAX}:
- brand_fit
- novelty
- seasonal_relevance
- production_ease
- sales_usefulness
- creator_energy

Decision rules:
- "save" only for strong ideas that already work.
- "revise" when the core idea is good but title/description/theme should be improved. Keep facts intact.
- "reject" for weak, generic, repeated, off-brand, hard-to-shoot, or commercially unclear ideas.
- Overall score should be a realistic weighted creative judgment. Anything below ${TOPIC_MIN_OVERALL_SAVE_SCORE} is not strong enough to save.

# CANDIDATES
${JSON.stringify(candidatePayload, null, 2)}

Output ONLY this JSON object:
{
  "items": [
    {
      "index": 0,
      "decision": "save",
      "scores": {
        "brand_fit": 8,
        "novelty": 8,
        "seasonal_relevance": 7,
        "production_ease": 9,
        "sales_usefulness": 8,
        "creator_energy": 8
      },
      "overall_score": 8.0,
      "critique_reason": "Short English reason for the decision.",
      "improved_item": null,
      "improved_title": null,
      "improved_title_en": null,
      "improved_description": null,
      "improved_description_en": null,
      "improved_theme": null,
      "improved_novelty_reason": null,
      "improved_business_goal": null,
      "improved_production_notes": null
    }
  ]
}

Rules:
- Return one review item per candidate index.
- For revised ideas, either fill "improved_item" with the revised candidate object or fill the specific improved_* fields.
- For revised ideas, fill improved fields only where the improvement is better than the original.
- Preserve product, campaign, branch, price-placeholder, platform, lane, and pattern facts.
- Do not invent specific prices.
- Do not include commentary outside JSON.`;
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

function applyCriticRevision(candidate: Suggestion, review: CriticItem): Suggestion | null {
  if (review.decision !== "revise") return candidate;
  if (review.improved_item) {
    const parsedItem = suggestionSchema.safeParse({
      ...candidate,
      ...review.improved_item,
    });
    if (parsedItem.success) return parsedItem.data;
  }
  const revised = {
    ...candidate,
    title: review.improved_title?.trim() || candidate.title,
    title_en: review.improved_title_en?.trim() || candidate.title_en,
    description: review.improved_description?.trim() || candidate.description,
    description_en: review.improved_description_en?.trim() || candidate.description_en,
    theme: review.improved_theme?.trim() || candidate.theme,
    novelty_reason: review.improved_novelty_reason?.trim() || candidate.novelty_reason,
    business_goal: review.improved_business_goal?.trim() || candidate.business_goal,
    production_notes: review.improved_production_notes?.trim() || candidate.production_notes,
  };
  const parsed = suggestionSchema.safeParse(revised);
  return parsed.success ? parsed.data : null;
}

function averageDimension(items: ReviewedSuggestion[], dimension: TopicScoreDimension): number {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + item.scores[dimension], 0);
  return Math.round((total / items.length) * 10) / 10;
}

function averageOverallScore(items: ReviewedSuggestion[]): number | null {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + item.overallScore, 0);
  return Math.round((total / items.length) * 10) / 10;
}

function buildScoreSummary(items: ReviewedSuggestion[]): Record<string, number> | null {
  if (items.length === 0) return null;
  return {
    brandFit: averageDimension(items, TOPIC_SCORE_DIMENSIONS.BRAND_FIT),
    novelty: averageDimension(items, TOPIC_SCORE_DIMENSIONS.NOVELTY),
    seasonalRelevance: averageDimension(items, TOPIC_SCORE_DIMENSIONS.SEASONAL_RELEVANCE),
    productionEase: averageDimension(items, TOPIC_SCORE_DIMENSIONS.PRODUCTION_EASE),
    salesUsefulness: averageDimension(items, TOPIC_SCORE_DIMENSIONS.SALES_USEFULNESS),
    creatorEnergy: averageDimension(items, TOPIC_SCORE_DIMENSIONS.CREATOR_ENERGY),
  };
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
      .select("id, title, description, pattern_id, branch_id, theme, target_date")
      .eq("brand_id", brandId)
      .gte("target_date", windowStartIso)
      .order("target_date", { ascending: false })
      .limit(RECENT_ENTRY_MEMORY_LIMIT),
    db
      .from("topics")
      .select(
        "title, title_en, description, description_en, theme, pattern_id, branch_id, occasion, status, created_at",
      )
      .eq("brand_id", brandId)
      .in("status", [...TOPIC_MEMORY_STATUSES])
      .order("created_at", { ascending: false })
      .limit(TOPIC_MEMORY_LIMIT),
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
  const topicMemory = (topicsRes.data ?? []) as TopicRow[];
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
  const selectedBranchName =
    branches.find((branch) => branch.id === parsed.data.branchId)?.name ?? null;
  const requestedCount = parsed.data.count;
  const rawGenerationCount = computeRawGenerationCount(requestedCount);

  const systemPrompt = buildSuggesterPrompt({
    voiceConfig,
    dnaMarkdown,
    recentEntries,
    topicMemory,
    branches,
    upcomingEvents,
    count: rawGenerationCount,
    occasionBias: parsed.data.occasion === "regular" ? undefined : parsed.data.occasion,
    windowDays: parsed.data.excludeRecentDays,
    mode: parsed.data.mode,
    selectedBranchName,
    productFocus: parsed.data.productFocus,
    audienceFocus: parsed.data.audienceFocus,
    notes: parsed.data.notes,
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
      // 6500 leaves headroom for over-generated bilingual ideas (Arabic + English
      // title + description) plus the new format/default_platforms fields
      // added after migration 0050. Truncation at 2000 was producing
      // unparseable JSON.
      max_completion_tokens: TOPIC_RAW_GENERATION_MAX_COMPLETION_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate ${rawGenerationCount} raw topic ideas now.` },
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
  const validated: ValidatedSuggestion[] = [];
  const skipped: SkippedSuggestion[] = [];
  for (let i = 0; i < itemsRaw.length; i++) {
    const result = suggestionSchema.safeParse(itemsRaw[i]);
    if (result.success) {
      validated.push({ item: result.data, index: i });
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

  const accepted: ValidatedSuggestion[] = [];
  const seenFingerprints = buildExistingFingerprints(topicMemory, recentEntries);
  for (const suggestion of validated) {
    const s = suggestion.item;
    const branchId = s.suggested_branch
      ? (branchByName.get(s.suggested_branch.toLowerCase()) ?? null)
      : null;
    const candidate = createMemoryFingerprint({
      title: s.title,
      titleEn: s.title_en ?? null,
      description: s.description ?? null,
      descriptionEn: s.description_en ?? null,
      theme: s.theme,
      patternId: s.pattern_id,
      branchId,
      occasion: s.occasion,
    });
    const duplicate = findNearDuplicate(candidate, seenFingerprints);
    if (duplicate) {
      skipped.push({
        index: suggestion.index,
        reason: "near_duplicate",
        matchedTitle: duplicate.title,
        matchedTheme: duplicate.theme ?? undefined,
      });
      continue;
    }
    accepted.push(suggestion);
    seenFingerprints.push(candidate);
  }

  if (accepted.length === 0) {
    return jsonSuccess(
      {
        topics: [],
        requested: requestedCount,
        generated: 0,
        reviewed: 0,
        saved: 0,
        rejected: 0,
        duplicatesSkipped: skipped.filter((skip) => skip.reason === "near_duplicate").length,
        averageScore: null,
        scoreSummary: null,
        skipped,
        tokensUsed: aiData.usage?.total_tokens ?? null,
      },
      201,
    );
  }

  const criticPrompt = buildCriticPrompt({
    voiceConfig,
    dnaMarkdown,
    topicMemory,
    recentEntries,
    candidates: accepted,
    mode: parsed.data.mode,
    occasionBias: parsed.data.occasion === "regular" ? undefined : parsed.data.occasion,
    productFocus: parsed.data.productFocus,
    audienceFocus: parsed.data.audienceFocus,
    notes: parsed.data.notes,
  });

  let criticItems: CriticItem[] | null = null;
  let criticTokens: number | undefined;
  let criticRawPreview = "";
  for (let attempt = 0; attempt < TOPIC_MAX_CRITIC_ATTEMPTS; attempt += 1) {
    const criticRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: openaiModel,
        max_completion_tokens: TOPIC_CRITIC_MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: criticPrompt },
          { role: "user", content: `Review ${accepted.length} candidate topic ideas now.` },
        ],
      }),
    });

    if (!criticRes.ok) {
      const errText = await criticRes.text();
      return jsonError("INTERNAL_ERROR", `AI critic error: ${errText.slice(0, 200)}`, 500);
    }

    const criticData = (await criticRes.json()) as OpenAIResponse;
    criticTokens = criticData.usage?.total_tokens;
    const criticRaw = criticData.choices[0]?.message?.content ?? "";
    criticRawPreview = criticRaw.slice(0, 600);
    const criticJson = safeParseAIResponse(criticRaw);
    const criticPayload = Array.isArray(criticJson) ? { items: criticJson } : criticJson;
    const parsedCritic = criticResponseSchema.safeParse(criticPayload);
    if (parsedCritic.success) {
      criticItems = parsedCritic.data.items;
      break;
    }
  }

  if (criticItems === null) {
    return jsonError("INTERNAL_ERROR", "AI critic returned no valid review items.", 500, {
      preview: criticRawPreview,
    });
  }

  const reviewByIndex = new Map<number, CriticItem>();
  for (const review of criticItems) {
    reviewByIndex.set(review.index, review);
  }

  const saveable: ReviewedSuggestion[] = [];
  for (const candidate of accepted) {
    const review = reviewByIndex.get(candidate.index);
    if (!review) continue;
    const revisedItem = applyCriticRevision(candidate.item, review);
    if (!revisedItem) continue;
    if (review.decision === "reject") continue;
    if (review.overall_score < TOPIC_MIN_OVERALL_SAVE_SCORE) continue;
    saveable.push({
      item: revisedItem,
      index: candidate.index,
      scores: review.scores,
      overallScore: Math.round(review.overall_score * 10) / 10,
      decision: review.decision,
      critiqueReason: review.critique_reason,
    });
  }

  const selected: ReviewedSuggestion[] = [];
  let finalDuplicatesSkipped = 0;
  const finalFingerprints = buildExistingFingerprints(topicMemory, recentEntries);
  const sortedSaveable = saveable.sort((left, right) => right.overallScore - left.overallScore);
  for (const reviewed of sortedSaveable) {
    const s = reviewed.item;
    const branchId = s.suggested_branch
      ? (branchByName.get(s.suggested_branch.toLowerCase()) ?? null)
      : null;
    const candidate = createMemoryFingerprint({
      title: s.title,
      titleEn: s.title_en ?? null,
      description: s.description ?? null,
      descriptionEn: s.description_en ?? null,
      theme: s.theme,
      patternId: s.pattern_id,
      branchId,
      occasion: s.occasion,
    });
    const duplicate = findNearDuplicate(candidate, finalFingerprints);
    if (duplicate) {
      finalDuplicatesSkipped += 1;
      skipped.push({
        index: reviewed.index,
        reason: "near_duplicate",
        matchedTitle: duplicate.title,
        matchedTheme: duplicate.theme ?? undefined,
      });
      continue;
    }
    selected.push(reviewed);
    finalFingerprints.push(candidate);
    if (selected.length >= requestedCount) break;
  }
  const duplicatesSkipped = skipped.filter((skip) => skip.reason === "near_duplicate").length;
  const tokensUsed = aiData.usage?.total_tokens !== undefined || criticTokens !== undefined
    ? (aiData.usage?.total_tokens ?? 0) + (criticTokens ?? 0)
    : null;

  if (selected.length === 0) {
    return jsonSuccess(
      {
        topics: [],
        requested: requestedCount,
        generated: 0,
        reviewed: accepted.length,
        saved: 0,
        rejected: Math.max(0, accepted.length - finalDuplicatesSkipped),
        duplicatesSkipped,
        averageScore: null,
        scoreSummary: null,
        skipped,
        tokensUsed,
      },
      201,
    );
  }

  const rowsToInsert = selected.map(({ item: s, scores, overallScore, critiqueReason }) => {
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
      notes: buildTopicNotes({
        mode: parsed.data.mode,
        lane: s.lane,
        businessGoal: s.business_goal,
        noveltyReason: s.novelty_reason,
        productionNotes: s.production_notes,
        scores,
        overallScore,
        criticNote: critiqueReason,
        reasoning: s.reasoning,
      }),
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
      requested: requestedCount,
      generated: inserted?.length ?? 0,
      reviewed: accepted.length,
      saved: inserted?.length ?? 0,
      rejected: Math.max(0, accepted.length - (inserted?.length ?? 0) - finalDuplicatesSkipped),
      duplicatesSkipped,
      averageScore: averageOverallScore(selected),
      scoreSummary: buildScoreSummary(selected),
      skipped,
      tokensUsed,
    },
    201,
  );
});
