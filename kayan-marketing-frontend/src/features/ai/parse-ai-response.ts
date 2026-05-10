// Parses an assistant message into the structured sections that the
// `generate_script` and `caption_hashtags` templates produce. The system
// prompt asks Claude to use exact `## Script` / `## Shot directions` /
// `## Caption` / `## Hashtags` headings — we match those (case-
// insensitive, with optional trailing colon) and stop at the next ##.
//
// Returns nulls when no sections are found (free-form responses) — callers
// should fall back to the plain-text rendering and the generic "Save to
// notes" action.

export interface ParsedAISections {
  script: string | null;
  shotDirections: string | null;
  caption: string | null;
  hashtags: string | null;
}

type SectionKey = keyof ParsedAISections;

// Heading → section key. The `shot directions` (with space) form is what
// the AI actually emits as a Markdown heading; we normalize it to the
// camelCase property name on the result object.
const HEADING_TO_KEY: Record<string, SectionKey> = {
  script: "script",
  "shot directions": "shotDirections",
  shotdirections: "shotDirections",
  caption: "caption",
  hashtags: "hashtags",
};

const SECTION_HEADING_REGEX =
  /^##\s+(script|shot\s+directions|shotdirections|caption|hashtags)\s*:?\s*$/i;

export function parseAIResponse(text: string): ParsedAISections {
  const result: ParsedAISections = {
    script: null,
    shotDirections: null,
    caption: null,
    hashtags: null,
  };

  let active: SectionKey | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    if (!active) return;
    const content = buffer.join("\n").trim();
    if (content) result[active] = content;
    buffer = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(SECTION_HEADING_REGEX);
    if (match) {
      const headingRaw = match[1]?.toLowerCase().replace(/\s+/g, " ").trim();
      const key = headingRaw ? HEADING_TO_KEY[headingRaw] : undefined;
      if (key) {
        flush();
        active = key;
        buffer = [];
        continue;
      }
    }
    if (active) buffer.push(line);
  }

  flush();
  return result;
}

export function hasParsedSections(parsed: ParsedAISections): boolean {
  return Boolean(
    parsed.script ||
      parsed.shotDirections ||
      parsed.caption ||
      parsed.hashtags,
  );
}
