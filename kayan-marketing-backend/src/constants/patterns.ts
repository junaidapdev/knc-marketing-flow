// Kayan Recipe Book V2 — the 9 winning Reel patterns derived from analyzing
// 11 high-performing posts. Mirrors `voice_config.patterns` in the brand row
// (seeded by migration 0028). Frontend mirror lives at
// kayan-marketing-frontend/src/constants/patterns.ts — keep them in sync.

export const PATTERNS = [
  { id: "P1", name: "Follower Supermarket Sweep" },
  { id: "P2", name: "Fixed-Price Value Stack" },
  { id: "P3", name: "Generous Upgrade Interview" },
  { id: "P4", name: "Good Samaritan Store Test" },
  { id: "P5", name: "Call-a-Friend Shopping Dash" },
  { id: "P6", name: "Internal Hero Reveal" },
  { id: "P7", name: "Event Prediction Giveaway" },
  { id: "P8", name: "Dual-Commentator Dash" },
  { id: "P9", name: "Quality Objection Rebuttal" },
] as const;

export type PatternId = (typeof PATTERNS)[number]["id"];
export type PatternName = (typeof PATTERNS)[number]["name"];
export type Pattern = (typeof PATTERNS)[number];

export const PATTERN_BY_ID: Record<PatternId, Pattern> = PATTERNS.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<PatternId, Pattern>,
);
