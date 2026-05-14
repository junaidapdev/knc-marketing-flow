import { ROUTES } from "../../constants/routes";
import { CONTENT_FORMATS } from "../../constants/content-formats";
import { PROMPT_TEMPLATES, type PromptTemplate } from "../../constants/ai";
import type { AIContext } from "../../stores/ai-store";

const ALWAYS_AVAILABLE: PromptTemplate[] = [
  PROMPT_TEMPLATES.TREND_BRIEF,
  PROMPT_TEMPLATES.FREEFORM,
];

// Returns the prompt templates that should appear at the top of the panel,
// ordered by relevance. The free-form / trend-brief tail is always present.
export function getAvailablePrompts(routePath: string, ctx: AIContext): PromptTemplate[] {
  const head: PromptTemplate[] = [];

  // Format-aware prompts (a video context is the highest-leverage entry).
  if (ctx.type === "entry" && ctx.entryFormat === CONTENT_FORMATS.VIDEO) {
    head.push(
      PROMPT_TEMPLATES.GENERATE_SCRIPT,
      PROMPT_TEMPLATES.SUGGEST_HOOKS,
      PROMPT_TEMPLATES.CAPTION_HASHTAGS,
    );
  } else if (ctx.type === "entry") {
    // Non-video entries still benefit from caption help
    head.push(PROMPT_TEMPLATES.CAPTION_HASHTAGS);
  }

  // Route-based prompts
  if (routePath.startsWith(ROUTES.CALENDAR)) {
    head.push(PROMPT_TEMPLATES.CONTENT_GAP_ANALYSIS);
  }
  if (routePath.startsWith(ROUTES.PERFORMANCE)) {
    head.push(PROMPT_TEMPLATES.MONTHLY_REPORT);
  }

  // De-duplicate while preserving order
  const seen = new Set<PromptTemplate>();
  const ordered: PromptTemplate[] = [];
  for (const t of [...head, ...ALWAYS_AVAILABLE]) {
    if (!seen.has(t)) {
      seen.add(t);
      ordered.push(t);
    }
  }
  return ordered;
}
