// Topic queue domain constants. Mirrors the CHECK constraints + occasion
// values used by the topics table (migration 0030). Frontend mirror lives at
// kayan-marketing-frontend/src/constants/topics.ts — keep them in sync.

export const TOPIC_OCCASIONS = [
  "regular",
  "ramadan",
  "eid",
  "national_day",
  "mothers_day",
  "fathers_day",
  "back_to_school",
  "summer",
  "derby_weekend",
  "riyadh_season",
] as const;

export type TopicOccasion = (typeof TOPIC_OCCASIONS)[number];

export const TOPIC_STATUSES = ["queued", "in_progress", "used", "archived"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];
