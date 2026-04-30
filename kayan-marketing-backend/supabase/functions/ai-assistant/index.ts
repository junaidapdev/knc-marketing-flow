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

const requestSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  contextType: z.enum(CONTEXT_TYPES),
  contextId: z.string().uuid().nullable().optional(),
  promptTemplate: z.enum(PROMPT_TEMPLATES),
  userMessage: z.string().min(1).max(10000),
  contextPayload: z.record(z.unknown()).optional(),
});

function buildSystemPrompt(
  template: string,
  voiceConfig: Record<string, unknown>,
  dnaMarkdown: string | null,
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

  // Templates that produce content for an entry's authoring fields return
  // structured sections so the frontend can offer per-field "Save" buttons
  // (Save to script / caption / hashtags). Use EXACT headings so the parser
  // matches reliably.
  const STRUCTURED_NOTE = `\nReturn your response in EXACTLY this Markdown structure. Do not add any preamble before the first ## heading. Use these heading names verbatim:`;

  switch (template) {
    case "generate_script":
      return `${baseVoice}${dnaBlock}
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

  const systemPrompt = buildSystemPrompt(parsed.data.promptTemplate, voiceConfig, dnaMarkdown);
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
