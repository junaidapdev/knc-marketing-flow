// Parses an assistant message into the structured sections that the
// `generate_script` and `caption_hashtags` templates produce. The system
// prompt asks Claude to use exact `## Script` / `## Caption` / `## Hashtags`
// headings — we match those (case-insensitive) and stop at the next ## or end.
//
// Returns nulls when no sections are found (free-form responses) — callers
// should fall back to the plain-text rendering and the generic "Save to
// notes" action.

export interface ParsedAISections {
  script: string | null;
  caption: string | null;
  hashtags: string | null;
}

const SECTION_REGEX =
  /^##\s+(script|caption|hashtags)\s*\n([\s\S]*?)(?=\n##\s+(?:script|caption|hashtags)\b|\s*$)/gim;

export function parseAIResponse(text: string): ParsedAISections {
  const result: ParsedAISections = { script: null, caption: null, hashtags: null };
  const matches = text.matchAll(SECTION_REGEX);
  for (const match of matches) {
    const heading = match[1]?.toLowerCase();
    const content = match[2]?.trim() ?? "";
    if (!content) continue;
    if (heading === "script") result.script = content;
    else if (heading === "caption") result.caption = content;
    else if (heading === "hashtags") result.hashtags = content;
  }
  return result;
}

export function hasParsedSections(parsed: ParsedAISections): boolean {
  return Boolean(parsed.script || parsed.caption || parsed.hashtags);
}
