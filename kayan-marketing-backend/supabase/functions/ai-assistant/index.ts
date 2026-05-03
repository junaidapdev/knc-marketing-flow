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
const entryContextSchema = z
  .object({
    patternId: z.string().regex(/^P\d{1,2}$/, "Pattern id like P1, P9").optional(),
    branchName: z.string().min(1).max(120).optional(),
    theme: z.string().min(1).max(200).optional(),
    entryType: z.string().min(1).max(40).optional(),
    occasion: z.string().min(1).max(40).optional(),
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
  if (ctx.entryType) lines.push(`Format: ${ctx.entryType}`);
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

function buildSystemPrompt(
  template: string,
  voiceConfig: Record<string, unknown>,
  dnaMarkdown: string | null,
  entryContext?: EntryContext,
): string {
  const baseVoice = `You are an AI assistant for Kayan Sweets, a Saudi confectionery retail chain.
Brand voice: ${JSON.stringify(voiceConfig)}.
Always respect this voice. Provide bilingual output (Arabic + English) when generating content.`;

  // Brand DNA is the marketer's long-form bible — values, pillars, audience,
  // do/don't, examples. Injected verbatim so generation sounds like Kayan,
  // not generic.
  const dnaBlock = dnaMarkdown && dnaMarkdown.trim().length > 0
    ? `\n\n# BRAND DNA (read carefully, every output must reflect this)\n${dnaMarkdown}\n# END BRAND DNA\n`
    : "";

  // Per-call brief — only injected for generate_script when entryContext is
  // supplied. Lands AFTER the BRAND DNA block so the LLM reads "global voice
  // → script-specific anchors → task" in that order.
  const briefBlock = template === "generate_script"
    ? buildEntryBriefBlock(entryContext, voiceConfig)
    : "";

  // Templates that produce content for an entry's authoring fields return
  // structured sections so the frontend can offer per-field "Save" buttons
  // (Save to script / caption / hashtags). Use EXACT headings so the parser
  // matches reliably.
  const STRUCTURED_NOTE = `\nReturn your response in EXACTLY this Markdown structure. Do not add any preamble before the first ## heading. Use these heading names verbatim:`;

  switch (template) {
    case "generate_script":
      return `${baseVoice}${dnaBlock}${briefBlock}
Your task: write a 15-60 second short-form video script with a strong 3-second hook, clear product showcase, and CTA. Provide both Arabic and English versions with shot directions in [brackets].
${STRUCTURED_NOTE}

## Script
[Full script. Include hook (first 3 seconds), body, CTA. Add shot directions in [brackets]. Mark Arabic and English clearly with sub-headings like **Arabic** / **English**.]

## Caption
[Publishing caption — bilingual reads, ready to paste.]

## Hashtags
[5-8 hashtags space-separated, mix of branded (#KayanSweets, #حلويات_كيان) and trending.]`;

    case "suggest_hooks":
      return `${baseVoice}${dnaBlock}
Your task: provide 5 different opening hooks (first 3 seconds) that grab attention differently — curiosity, surprise, question, bold claim, relatable scenario. Numbered list, both languages.`;

    case "caption_hashtags":
      return `${baseVoice}${dnaBlock}
Your task: write a platform-tailored caption with 5-8 relevant hashtags mixing branded and trending tags. Both languages.
${STRUCTURED_NOTE}

## Caption
[The caption — bilingual, ready to paste.]

## Hashtags
[Space-separated hashtags.]`;

    case "content_gap_analysis":
      return `${baseVoice}${dnaBlock}
Kayan content rules: 5 videos per week minimum, daily IG + Snap stories, balance between product showcase and trends.
Your task: analyze the planned content and identify gaps. Suggest specific entries to fill them.`;

    case "trend_brief":
      return `${baseVoice}${dnaBlock}
Your task: when given trending video formats or descriptions, suggest 3 ways Kayan can adapt each, keeping brand voice.`;

    case "monthly_report":
      return `${baseVoice}${dnaBlock}
You are writing the monthly marketing report for Kayan Sweets leadership. Be data-forward, concise, action-oriented. Cover: 1) Content summary, 2) Engagement metrics, 3) Follower growth, 4) Ad performance, 5) Sales impact, 6) Insights & next steps.`;

    case "freeform":
    default:
      return `${baseVoice}${dnaBlock}`;
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
  const openaiModel = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o";

  if (!openaiKey) return jsonError("INTERNAL_ERROR", "AI not configured.", 500);

  const db = createClient(supabaseUrl, serviceKey);

  // Load brand voice config (V1 single-tenant — first brand)
  const { data: brand } = await db
    .from("brands")
    .select("voice_config, dna_markdown")
    .limit(1)
    .single();
  const voiceConfig = (brand?.voice_config as Record<string, unknown>) ?? {};
  const dnaMarkdown = (brand?.dna_markdown as string | null) ?? null;

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

  const systemPrompt = buildSystemPrompt(
    parsed.data.promptTemplate,
    voiceConfig,
    dnaMarkdown,
    parsed.data.entryContext,
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
      max_tokens: 2000,
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
