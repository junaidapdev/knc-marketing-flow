import { CONTENT_FORMATS, type ContentFormat } from "../../constants/content-formats";
import type { CalendarEntry } from "../../types/calendar-entry";

// Which formats expect authored content (script / caption / hashtags).
// Shop activities, influencer collabs, and general tasks don't have a "post"
// to write, so they skip the Content section entirely.

const VIDEO_FORMATS = new Set<ContentFormat>([CONTENT_FORMATS.VIDEO]);
const STORY_FORMATS = new Set<ContentFormat>([CONTENT_FORMATS.STORY]);
const CAPTION_ONLY_FORMATS = new Set<ContentFormat>([CONTENT_FORMATS.OFFER]);

const CONTENT_AWARE_FORMATS = new Set<ContentFormat>([
  ...VIDEO_FORMATS,
  ...STORY_FORMATS,
  ...CAPTION_ONLY_FORMATS,
]);

export function needsContentAuthoring(format: ContentFormat): boolean {
  return CONTENT_AWARE_FORMATS.has(format);
}

export function showsScriptField(format: ContentFormat): boolean {
  return VIDEO_FORMATS.has(format);
}

// Director-facing shot list. Only videos use it — stories and captioned posts
// don't need a separate shot section.
export function showsShotDirectionsField(format: ContentFormat): boolean {
  return VIDEO_FORMATS.has(format);
}

export function showsCaptionField(format: ContentFormat): boolean {
  return (
    VIDEO_FORMATS.has(format) ||
    STORY_FORMATS.has(format) ||
    CAPTION_ONLY_FORMATS.has(format)
  );
}

export function showsHashtagsField(
  format: ContentFormat,
  platforms: readonly string[],
): boolean {
  // Snapchat doesn't use hashtags meaningfully — so for story format we only
  // show the field if it's going to a platform that uses hashtags (Instagram).
  if (VIDEO_FORMATS.has(format)) return true;
  if (format === CONTENT_FORMATS.OFFER) return true;
  if (format === CONTENT_FORMATS.STORY) return platforms.includes("instagram");
  return false;
}

// "Content ready" = the most-important field for this format has been written.
// Drives the small dot on calendar chips so the team can see at a glance
// which upcoming entries still need authoring.
export function isEntryContentReady(
  entry: Pick<CalendarEntry, "format" | "script" | "caption">,
): boolean {
  if (!needsContentAuthoring(entry.format)) return false;
  if (VIDEO_FORMATS.has(entry.format)) return Boolean(entry.script?.trim());
  // Stories + offers: caption is the primary surface.
  return Boolean(entry.caption?.trim());
}
