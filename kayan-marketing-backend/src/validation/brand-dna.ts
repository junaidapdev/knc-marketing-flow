import { z } from "zod";

// PATCH /brand-dna body. The voice_config field is intentionally typed as
// `record(unknown)` — the AI prompt builder reads specific keys but the
// shape is otherwise freeform so the marketer can extend it without a
// schema change.
export const updateBrandDnaSchema = z.object({
  dnaMarkdown: z.string().min(1).max(100000),
  voiceConfig: z.record(z.unknown()),
  changeNote: z.string().max(500).nullable().optional(),
});

export type UpdateBrandDnaInput = z.infer<typeof updateBrandDnaSchema>;
