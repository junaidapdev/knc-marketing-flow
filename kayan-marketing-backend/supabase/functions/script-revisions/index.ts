import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.0";
import { jsonSuccess, jsonError } from "../_shared/response.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { toCamel } from "../_shared/case.ts";

const METHOD_OPTIONS = "OPTIONS";
const METHOD_POST = "POST";
const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_NOT_FOUND = 404;
const STATUS_UNPROCESSABLE = 422;
const STATUS_INTERNAL = 500;
const ERROR_VALIDATION = "VALIDATION_FAILED";
const ERROR_NOT_FOUND = "NOT_FOUND";
const ERROR_INTERNAL = "INTERNAL_ERROR";
const MESSAGE_INVALID_JSON = "Invalid JSON.";
const MESSAGE_VALIDATION_FAILED = "Validation failed.";
const MESSAGE_METHOD_NOT_SUPPORTED = "Method not supported.";
const MESSAGE_ENTRY_NOT_FOUND = "Entry not found.";
const MESSAGE_AI_NOT_CONFIGURED = "AI not configured.";
const MESSAGE_SERVER_CONFIG = "Server configuration error.";
const MESSAGE_EMPTY_AI_RESPONSE = "AI returned an empty revised script.";
const MESSAGE_NEED_FEEDBACK = "Add revision notes or select at least one quick fix.";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const MAX_COMPLETION_TOKENS = 1800;
const CURRENT_SCRIPT_MAX = 20000;
const REVISION_NOTES_MAX = 4000;
const REVISED_SCRIPT_MAX = 20000;
const QUICK_FIX_VALUES = [
  "make_shorter",
  "more_saudi_dialect",
  "less_formal",
  "stronger_hook",
  "more_funny",
  "more_premium",
  "less_shot_directions",
  "one_narrator_only",
] as const;

type QuickFix = (typeof QUICK_FIX_VALUES)[number];

const QUICK_FIX_LABELS: Record<QuickFix, string> = {
  make_shorter: "Make it shorter",
  more_saudi_dialect: "More Saudi dialect",
  less_formal: "Less formal",
  stronger_hook: "Stronger hook",
  more_funny: "More funny",
  more_premium: "More premium",
  less_shot_directions: "Less shot directions",
  one_narrator_only: "One narrator only",
};

const requestSchema = z
  .object({
    entryId: z.string().uuid(),
    currentScript: z.string().trim().min(1).max(CURRENT_SCRIPT_MAX),
    revisionNotes: z.string().trim().max(REVISION_NOTES_MAX).nullable().optional(),
    quickFixes: z.array(z.enum(QUICK_FIX_VALUES)).default([]),
  })
  .superRefine((data, ctx) => {
    if (!data.revisionNotes?.trim() && data.quickFixes.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["revisionNotes"],
        message: MESSAGE_NEED_FEEDBACK,
      });
    }
  });

interface PublicationRow {
  platform: string;
  post_url: string | null;
  posted_at: string | null;
}

interface BranchRow {
  id: string;
  name: string;
  city: string;
}

interface CampaignRow {
  id: string;
  name: string;
  campaign_type: string;
  offer_trigger: string | null;
  offer_reward: string | null;
  promo_code: string | null;
  notes: string | null;
}

interface EntryRow {
  id: string;
  brand_id: string;
  campaign_id: string | null;
  branch_id: string | null;
  format: string;
  title: string;
  description: string | null;
  target_date: string;
  assignee: string;
  status: string;
  notes: string | null;
  script: string | null;
  shot_directions: string | null;
  pattern_id: string | null;
  theme: string | null;
  branch: BranchRow | null;
  campaign: CampaignRow | null;
  publications: PublicationRow[] | null;
}

interface BrandRow {
  voice_config: Record<string, unknown> | null;
  dna_markdown: string | null;
}

interface OpenAIResponse {
  choices: Array<{
    message?: { role: string; content?: string | null };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface DbError {
  message: string;
}

interface InsertQuery {
  select: () => {
    single: () => Promise<{ data: unknown; error: DbError | null }>;
  };
}

interface InsertClient {
  from: (table: string) => {
    insert: (value: Record<string, unknown>) => InsertQuery;
  };
}

function getServiceClient(): ReturnType<typeof createClient> | { error: Response } {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return {
      error: jsonError(ERROR_INTERNAL, MESSAGE_SERVER_CONFIG, STATUS_INTERNAL),
    };
  }
  return createClient(supabaseUrl, serviceKey);
}

function lookupPatternName(
  voiceConfig: Record<string, unknown>,
  patternId: string | null,
): string | null {
  if (!patternId) return null;
  const patterns = voiceConfig.patterns;
  if (!Array.isArray(patterns)) return null;
  for (const pattern of patterns) {
    if (
      pattern &&
      typeof pattern === "object" &&
      "id" in pattern &&
      "name" in pattern &&
      (pattern as { id: unknown }).id === patternId &&
      typeof (pattern as { name: unknown }).name === "string"
    ) {
      return (pattern as { name: string }).name;
    }
  }
  return null;
}

function quickFixLabels(quickFixes: QuickFix[]): string {
  if (quickFixes.length === 0) return "None";
  return quickFixes.map((fix) => QUICK_FIX_LABELS[fix]).join(", ");
}

function buildEntryFacts(
  entry: EntryRow,
  voiceConfig: Record<string, unknown>,
): string {
  const platforms =
    entry.publications && entry.publications.length > 0
      ? entry.publications.map((publication) => publication.platform).join(", ")
      : "none";
  const branch = entry.branch
    ? `${entry.branch.name}, ${entry.branch.city}`
    : "none";
  const campaign = entry.campaign
    ? [
      entry.campaign.name,
      `type: ${entry.campaign.campaign_type}`,
      entry.campaign.offer_trigger ? `trigger: ${entry.campaign.offer_trigger}` : null,
      entry.campaign.offer_reward ? `reward: ${entry.campaign.offer_reward}` : null,
      entry.campaign.promo_code ? `promo code: ${entry.campaign.promo_code}` : null,
    ].filter(Boolean).join("; ")
    : "none";
  const patternName = lookupPatternName(voiceConfig, entry.pattern_id);
  const pattern = entry.pattern_id
    ? `${entry.pattern_id}${patternName ? ` - ${patternName}` : ""}`
    : "none";

  return [
    `Entry title: ${entry.title}`,
    `Description: ${entry.description ?? "none"}`,
    `Format: ${entry.format}`,
    `Platforms: ${platforms}`,
    `Target date: ${entry.target_date}`,
    `Branch: ${branch}`,
    `Campaign: ${campaign}`,
    `Pattern: ${pattern}`,
    `Theme: ${entry.theme ?? "none"}`,
    `Internal notes: ${entry.notes ?? "none"}`,
    `Existing shot directions: ${entry.shot_directions ?? "none"}`,
  ].join("\n");
}

function buildSystemPrompt(
  entry: EntryRow,
  voiceConfig: Record<string, unknown>,
  dnaMarkdown: string | null,
  quickFixes: QuickFix[],
): string {
  const dnaBlock = dnaMarkdown?.trim()
    ? `\n\n# BRAND DNA\n${dnaMarkdown}\n# END BRAND DNA`
    : "";

  return `You are a senior Saudi short-form scriptwriter for Kayan Sweets.

Your job is to revise an EXISTING script using creator feedback. Do not start from zero unless the feedback explicitly asks for a full rewrite.

Voice config:
${JSON.stringify(voiceConfig)}${dnaBlock}

Entry facts you must preserve:
${buildEntryFacts(entry, voiceConfig)}

Quick fixes selected:
${quickFixLabels(quickFixes)}

Hard rules:
- Return ONLY the revised script text. No explanation, no caption, no hashtags.
- Return exactly two language blocks: **Arabic** first, then **English**.
- Keep both blocks in the same clean format: Hook, Body, CTA.
- Arabic block: proper conversational Saudi Arabic only. No Egyptian, no Levantine, no stiff MSA.
- English block: faithful translation of the revised Arabic for team/director reference. Do not add new facts.
- Use natural Saudi phrasing like ابغاكم, خليني, يالله, تبغون, وش, ايش, خلنا نشوف, تابعوا, ماشاء الله, كفو, يا سلام when it fits.
- Preserve product, campaign, price, offer, branch, and promo-code facts from the entry and current script.
- Do not invent products, prices, offers, branches, or campaign claims.
- Default to one narrator unless the feedback explicitly asks for dialogue.
- Keep shot directions out unless the feedback asks for them. If direction is useful, max 2 short bracket lines.
- Improve rhythm, clarity, hook strength, and Saudi creator voice.
- Script should feel like notes were given to a junior Saudi content writer and you are returning the improved version.`;
}

function buildUserPrompt(args: {
  currentScript: string;
  revisionNotes: string | null;
}): string {
  return `Current script:
${args.currentScript}

Creator revision notes:
${args.revisionNotes?.trim() || "No free-text notes. Apply the selected quick fixes."}

Revise the current script now.`;
}

function cleanRevisedScript(value: string): string {
  return value
    .trim()
    .replace(/^```(?:markdown|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^##\s*Script\s*:?\s*/i, "")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === METHOD_OPTIONS) return new Response(null, { headers: corsHeaders });
  if (req.method !== METHOD_POST) {
    return jsonError(ERROR_NOT_FOUND, MESSAGE_METHOD_NOT_SUPPORTED, STATUS_NOT_FOUND);
  }

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(ERROR_VALIDATION, MESSAGE_INVALID_JSON, STATUS_BAD_REQUEST);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(ERROR_VALIDATION, MESSAGE_VALIDATION_FAILED, STATUS_UNPROCESSABLE, {
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const openaiModel = Deno.env.get("OPENAI_MODEL") ?? DEFAULT_OPENAI_MODEL;
  if (!openaiKey) {
    return jsonError(ERROR_INTERNAL, MESSAGE_AI_NOT_CONFIGURED, STATUS_INTERNAL);
  }

  const db = getServiceClient();
  if ("error" in db) return db.error;

  const { data: entryData, error: entryError } = await db
    .from("calendar_entries")
    .select(
      "id, brand_id, campaign_id, branch_id, format, title, description, target_date, assignee, status, notes, script, shot_directions, pattern_id, theme, branch:branches(id, name, city), campaign:campaigns(id, name, campaign_type, offer_trigger, offer_reward, promo_code, notes), publications:entry_publications(platform, post_url, posted_at)",
    )
    .eq("id", parsed.data.entryId)
    .single();
  if (entryError || !entryData) {
    return jsonError(ERROR_NOT_FOUND, MESSAGE_ENTRY_NOT_FOUND, STATUS_NOT_FOUND);
  }
  const entry = entryData as EntryRow;

  const { data: brandData } = await db
    .from("brands")
    .select("voice_config, dna_markdown")
    .eq("id", entry.brand_id)
    .single();
  const brand = brandData as BrandRow | null;
  const voiceConfig = brand?.voice_config ?? {};

  const openaiRes = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: METHOD_POST,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: openaiModel,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(
            entry,
            voiceConfig,
            brand?.dna_markdown ?? null,
            parsed.data.quickFixes,
          ),
        },
        {
          role: "user",
          content: buildUserPrompt({
            currentScript: parsed.data.currentScript,
            revisionNotes: parsed.data.revisionNotes ?? null,
          }),
        },
      ],
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    return jsonError(ERROR_INTERNAL, `AI error: ${errText.slice(0, 200)}`, STATUS_INTERNAL);
  }

  const aiData = (await openaiRes.json()) as OpenAIResponse;
  const revisedScript = cleanRevisedScript(
    aiData.choices[0]?.message?.content ?? "",
  );
  if (!revisedScript) {
    return jsonError(ERROR_INTERNAL, MESSAGE_EMPTY_AI_RESPONSE, STATUS_INTERNAL);
  }

  const insertClient = db as unknown as InsertClient;
  const { data: revisionData, error: revisionError } = await insertClient
    .from("script_revisions")
    .insert({
      entry_id: parsed.data.entryId,
      previous_script: parsed.data.currentScript,
      revision_notes: parsed.data.revisionNotes?.trim() || null,
      quick_fixes: parsed.data.quickFixes,
      revised_script: revisedScript.slice(0, REVISED_SCRIPT_MAX),
      model: openaiModel,
      created_by: auth.userId,
    })
    .select()
    .single();

  if (revisionError) {
    return jsonError(ERROR_INTERNAL, revisionError.message, STATUS_INTERNAL);
  }

  return jsonSuccess(toCamel(revisionData), STATUS_OK);
});
