export const PROMPT_TEMPLATES = {
  GENERATE_SCRIPT: "generate_script",
  SUGGEST_HOOKS: "suggest_hooks",
  CAPTION_HASHTAGS: "caption_hashtags",
  CONTENT_GAP_ANALYSIS: "content_gap_analysis",
  TREND_BRIEF: "trend_brief",
  MONTHLY_REPORT: "monthly_report",
  FREEFORM: "freeform",
} as const;

export type PromptTemplate = (typeof PROMPT_TEMPLATES)[keyof typeof PROMPT_TEMPLATES];

export const PROMPT_TEMPLATE_LABELS: Record<PromptTemplate, string> = {
  generate_script: "Generate Script",
  suggest_hooks: "Suggest Hooks",
  caption_hashtags: "Caption & Hashtags",
  content_gap_analysis: "Content Gap Analysis",
  trend_brief: "Trend Brief",
  monthly_report: "Monthly Report Draft",
  freeform: "Free-form chat",
};

export const PROMPT_TEMPLATE_PLACEHOLDERS: Record<PromptTemplate, string> = {
  generate_script: "Describe the entry: product, angle, target date…",
  suggest_hooks: "What's the topic, product, or angle for the hook?",
  caption_hashtags: "Paste your draft or describe the content…",
  content_gap_analysis: "Anything specific you want analysed (e.g. next 2 weeks)?",
  trend_brief: "Paste the trending format / sound / video URL or description…",
  monthly_report: "Which month? Any focus areas for the leadership audience?",
  freeform: "Ask anything — brand voice, ideas, planning…",
};

export const AI_CONTEXT_TYPES = {
  ENTRY: "entry",
  CAMPAIGN: "campaign",
  CALENDAR: "calendar",
  PERFORMANCE: "performance",
  FREEFORM: "freeform",
} as const;

export type AIContextType = (typeof AI_CONTEXT_TYPES)[keyof typeof AI_CONTEXT_TYPES];
