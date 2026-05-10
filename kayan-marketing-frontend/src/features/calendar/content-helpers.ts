import { ENTRY_TYPES, type EntryType } from "../../constants/entry-types";
import type { CalendarEntry } from "../../types/calendar-entry";

// Which entry types expect authored content (script / caption / hashtags).
// Shop activities, influencer collabs, and general tasks don't have a "post"
// to write, so they skip the Content section entirely.
const VIDEO_TYPES = new Set<EntryType>([ENTRY_TYPES.TIKTOK_VIDEO, ENTRY_TYPES.INSTAGRAM_REEL]);
const STORY_TYPES = new Set<EntryType>([ENTRY_TYPES.INSTAGRAM_STORY, ENTRY_TYPES.SNAPCHAT_STORY]);
const CAPTION_ONLY_TYPES = new Set<EntryType>([ENTRY_TYPES.OFFER]);

const CONTENT_AWARE_TYPES = new Set<EntryType>([
  ...VIDEO_TYPES,
  ...STORY_TYPES,
  ...CAPTION_ONLY_TYPES,
]);

export function needsContentAuthoring(type: EntryType): boolean {
  return CONTENT_AWARE_TYPES.has(type);
}

export function showsScriptField(type: EntryType): boolean {
  return VIDEO_TYPES.has(type);
}

// Director-facing shot list. Only video types use it — stories and
// captioned posts don't need a separate shot section.
export function showsShotDirectionsField(type: EntryType): boolean {
  return VIDEO_TYPES.has(type);
}

export function showsCaptionField(type: EntryType): boolean {
  return VIDEO_TYPES.has(type) || STORY_TYPES.has(type) || CAPTION_ONLY_TYPES.has(type);
}

export function showsHashtagsField(type: EntryType): boolean {
  // Snapchat doesn't use hashtags meaningfully.
  return VIDEO_TYPES.has(type) || type === ENTRY_TYPES.INSTAGRAM_STORY || type === ENTRY_TYPES.OFFER;
}

// "Content ready" = the most-important field for this type has been written.
// Drives the small dot on calendar chips so the team can see at a glance
// which upcoming entries still need authoring.
export function isEntryContentReady(
  entry: Pick<CalendarEntry, "type" | "script" | "caption">,
): boolean {
  if (!needsContentAuthoring(entry.type)) return false;
  if (VIDEO_TYPES.has(entry.type)) return Boolean(entry.script?.trim());
  // Stories + offers: caption is the primary surface.
  return Boolean(entry.caption?.trim());
}
