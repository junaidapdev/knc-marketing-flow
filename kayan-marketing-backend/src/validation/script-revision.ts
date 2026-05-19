import { z } from "zod";
import {
  SCRIPT_REVISION_LIMITS,
  SCRIPT_REVISION_QUICK_FIX_VALUES,
} from "../constants/script-revision";

export const createScriptRevisionSchema = z
  .object({
    entryId: z.string().uuid(),
    currentScript: z
      .string()
      .trim()
      .min(1)
      .max(SCRIPT_REVISION_LIMITS.CURRENT_SCRIPT_MAX),
    revisionNotes: z
      .string()
      .trim()
      .max(SCRIPT_REVISION_LIMITS.REVISION_NOTES_MAX)
      .nullable()
      .optional(),
    quickFixes: z
      .array(z.enum(SCRIPT_REVISION_QUICK_FIX_VALUES))
      .default([]),
  })
  .superRefine((data, ctx) => {
    const hasNotes = Boolean(data.revisionNotes?.trim());
    const hasQuickFixes = data.quickFixes.length > 0;
    if (!hasNotes && !hasQuickFixes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["revisionNotes"],
        message: "Add revision notes or select at least one quick fix.",
      });
    }
  });

export type CreateScriptRevisionInput = z.infer<
  typeof createScriptRevisionSchema
>;
