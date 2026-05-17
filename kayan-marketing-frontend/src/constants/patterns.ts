// Kayan Recipe Book — Reel patterns derived from analyzing high-performing
// posts. Mirrors `voice_config.patterns` in the brand row (seeded by
// migration 0028; extended by migration 0053 with P10-P13). Backend mirror
// lives at kayan-marketing-backend/src/constants/patterns.ts — keep them
// in sync. Full pattern descriptions and tier classifications live in the
// brand DNA markdown (editable in Settings → Brand DNA).

export const PATTERNS = [
  { id: "P1", name: "Follower Supermarket Sweep" },
  { id: "P2", name: "Fixed-Price Value Stack" },
  { id: "P3", name: "Generous Upgrade Interview" },
  { id: "P4", name: "Good Samaritan Store Test" },
  { id: "P5", name: "Call-a-Friend Shopping Dash" },
  { id: "P6", name: "Internal Hero Reveal" },
  { id: "P7", name: "Event Prediction Giveaway" },
  { id: "P8", name: "Treasure Hunt Challenge" },
  { id: "P9", name: "Quality Objection Rebuttal" },
  { id: "P10", name: "Visual Shock Prop" },
  { id: "P11", name: "Executive Authority Flex" },
  { id: "P12", name: "Pyrotechnic Reveal" },
  { id: "P13", name: "DIY Problem-Solver" },
] as const;

export type PatternId = (typeof PATTERNS)[number]["id"];
export type PatternName = (typeof PATTERNS)[number]["name"];
export type Pattern = (typeof PATTERNS)[number];

// Convenience lookup by id.
export const PATTERN_BY_ID: Record<PatternId, Pattern> = PATTERNS.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<PatternId, Pattern>,
);
