// Topic queue domain constants. Mirrors the CHECK constraints + occasion
// values used by the topics table (migration 0030). Backend mirror lives at
// kayan-marketing-backend/src/constants/topics.ts — keep them in sync.

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

export const TOPIC_OCCASION_LABELS: Record<TopicOccasion, string> = {
  regular: "Regular",
  ramadan: "Ramadan",
  eid: "Eid",
  national_day: "National Day",
  mothers_day: "Mother's Day",
  fathers_day: "Father's Day",
  back_to_school: "Back to school",
  summer: "Summer",
  derby_weekend: "Derby weekend",
  riyadh_season: "Riyadh Season",
};

export const TOPIC_STATUSES = ["queued", "in_progress", "used", "archived"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  queued: "Queued",
  in_progress: "In progress",
  used: "Used",
  archived: "Archived",
};
