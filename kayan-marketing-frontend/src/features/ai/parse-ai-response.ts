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

type SectionKey = keyof ParsedAISections;

const SECTION_HEADING_REGEX = /^##\s+(script|caption|hashtags)\s*:?\s*$/i;

export function parseAIResponse(text: string): ParsedAISections {
  const result: ParsedAISections = { script: null, caption: null, hashtags: null };

  let active: SectionKey | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    if (!active) return;
    const content = buffer.join("\n").trim();
    if (content) result[active] = content;
    buffer = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(SECTION_HEADING_REGEX)?.[1]?.toLowerCase() as
      | SectionKey
      | undefined;
    if (heading) {
      flush();
      active = heading;
      buffer = [];
      continue;
    }
    if (active) buffer.push(line);
  }

  flush();
  return result;
}

export function hasParsedSections(parsed: ParsedAISections): boolean {
  return Boolean(parsed.script || parsed.caption || parsed.hashtags);
}
