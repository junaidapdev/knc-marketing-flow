// Claude-based fit scoring for the merged creator set.
//
// Mirrors the Brand DNA loader pattern from ai-assistant/index.ts (V1
// single-tenant: first brand, brand.dna_markdown is the source of truth).
// Calls Anthropic's /v1/messages directly — the existing ai-assistant
// uses OpenAI, but the Chunk 5 spec calls for Claude Haiku because batch
// scoring is the use case it was built for.

import type { CreatorSearchFilters, NormalizedCreator } from "./types.ts";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_VERSION = "2023-06-01";
// Generous ceiling — 100 creators × ~50 tokens per scored item ~= 5000
// output tokens worst case. We pass a budget instead of being cute.
const SCORING_MAX_TOKENS = 6000;

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface ScoreItem {
  handle: string;
  platform: string;
  score: number;
  rationale: string;
}

export interface ScoringOutcome {
  scored: NormalizedCreator[];
  promptTokens: number;
  completionTokens: number;
  // True when the model's response failed to parse — every creator gets
  // score 0 + rationale "AI scoring failed" so the search still returns
  // results, just unranked.
  parseFailed: boolean;
}

// Loads brand DNA markdown for the V1 single-tenant brand. Mirrors the
// loader pattern in ai-assistant/index.ts.
export async function loadBrandDna(
  // deno-lint-ignore no-explicit-any
  db: any,
  brandId: string,
): Promise<string | null> {
  const { data } = await db
    .from("brands")
    .select("dna_markdown")
    .eq("id", brandId)
    .single();
  const md = (data as { dna_markdown?: string | null } | null)?.dna_markdown;
  return md ?? null;
}

// Scoring rubric + Brand DNA + filter context. The model sees this as the
// system prompt; everything below it is treated as authoritative.
export function buildScoringSystemPrompt(
  brandDna: string | null,
  filters: CreatorSearchFilters,
): string {
  const dnaBlock =
    brandDna && brandDna.trim().length > 0
      ? `\n\n# BRAND DNA\n${brandDna.trim()}\n# END BRAND DNA\n`
      : "";

  const filterBlock = `\n\n# SEARCH FILTERS (what the user is looking for)\n${JSON.stringify(filters, null, 2)}\n# END SEARCH FILTERS\n`;

  const rubric = [
    "You score influencer creators 0-100 for fit with a brand. You will receive a list of creators; you must score every single one.",
    "",
    "Scoring dimensions (combine into a single 0-100 number):",
    "- Audience alignment — region, language, age skew vs the brand and the user's filters",
    "- Content category fit — does their content actually match the brand's category and product set?",
    "- Authenticity — follower-to-engagement ratio plausibility, suspicious patterns",
    "- Brand safety — anything in handle or bio that conflicts with the brand voice",
    "",
    "Scoring scale:",
    "- 80-100: strong fit, would proactively contact",
    "- 60-79: solid fit, worth investigating",
    "- 40-59: neutral, niche overlap only",
    "- 0-39: weak or off-brand fit",
    "",
    "OUTPUT RULES (must follow exactly):",
    "- Return ONLY a JSON array. No markdown fences, no preamble, no postamble.",
    '- Each item: {"handle": string, "platform": "tiktok"|"instagram"|"youtube", "score": integer 0-100, "rationale": string ≤ 140 chars}',
    "- Score every creator you receive — never skip, filter, or reorder.",
    "- Rationale must be ONE plain-text sentence, no quotes, no emoji, ≤ 140 characters.",
    "- Match handle + platform exactly as given so scores can be merged back.",
  ].join("\n");

  return `${rubric}${dnaBlock}${filterBlock}`;
}

// Compact JSON of the merged creator set — only the fields that actually
// inform fit. We slice bios at 200 chars so a long signature can't blow
// out the prompt token budget for a 100-creator batch.
export function buildScoringUserMessage(creators: NormalizedCreator[]): string {
  const minimal = creators.map((c) => {
    const raw = c.raw as Record<string, unknown>;
    const bio =
      typeof raw.signature === "string"
        ? raw.signature
        : typeof raw.biography === "string"
          ? raw.biography
          : typeof raw.channelDescription === "string"
            ? raw.channelDescription
            : null;
    return {
      handle: c.handle,
      platform: c.platform,
      displayName: c.display_name,
      bio: bio ? bio.slice(0, 200) : null,
      followers: c.follower_count,
      engagement: c.engagement_rate,
      language: c.language,
      country: c.country,
    };
  });
  return [
    `Score the fit of these ${minimal.length} creators.`,
    "Return only the JSON array — no other text.",
    "",
    JSON.stringify(minimal, null, 2),
  ].join("\n");
}

// Drives the full scoring pass. On API failure or parse failure, returns
// every creator with score 0 + rationale "AI scoring failed" so the search
// still returns rows. parseFailed is true in that case so the caller can
// log it to failure_reasons.
export async function scoreCreators(
  creators: NormalizedCreator[],
  filters: CreatorSearchFilters,
  brandDna: string | null,
  anthropicKey: string,
): Promise<ScoringOutcome> {
  if (creators.length === 0) {
    return {
      scored: [],
      promptTokens: 0,
      completionTokens: 0,
      parseFailed: false,
    };
  }

  const systemPrompt = buildScoringSystemPrompt(brandDna, filters);
  const userMessage = buildScoringUserMessage(creators);

  const res = await fetch(ANTHROPIC_ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: SCORING_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const text = (await res.text().catch(() => "")) ?? "";
    throw new Error(
      `Anthropic ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as AnthropicResponse;
  const text = data.content?.find((b) => b.type === "text")?.text ?? "";
  const promptTokens = data.usage?.input_tokens ?? 0;
  const completionTokens = data.usage?.output_tokens ?? 0;

  // Try to parse the response as a JSON array. If Claude wrapped it in
  // markdown fences or chatter despite the rubric, the regex pulls the
  // first [ ... ] block out.
  const scoreMap = new Map<string, ScoreItem>();
  let parseFailed = false;
  try {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (!arrayMatch) throw new Error("No JSON array in response");
    const parsed = JSON.parse(arrayMatch[0]) as unknown;
    if (!Array.isArray(parsed)) throw new Error("Response root is not an array");
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      if (
        typeof r.handle !== "string" ||
        typeof r.platform !== "string" ||
        typeof r.score !== "number" ||
        typeof r.rationale !== "string"
      ) {
        continue;
      }
      const score = Math.max(0, Math.min(100, Math.round(r.score)));
      const rationale = r.rationale.slice(0, 140);
      const key = `${r.platform.toLowerCase()}|${r.handle.toLowerCase()}`;
      scoreMap.set(key, {
        handle: r.handle,
        platform: r.platform,
        score,
        rationale,
      });
    }
    if (scoreMap.size === 0) throw new Error("Parsed array contained no valid items");
  } catch {
    parseFailed = true;
  }

  const scored = creators.map((c) => {
    if (parseFailed) {
      return { ...c, fit_score: 0, fit_rationale: "AI scoring failed" };
    }
    const key = `${c.platform}|${c.handle.toLowerCase()}`;
    const found = scoreMap.get(key);
    return {
      ...c,
      fit_score: found?.score ?? 0,
      fit_rationale: found?.rationale ?? "Not scored by AI.",
    };
  });

  return { scored, promptTokens, completionTokens, parseFailed };
}
