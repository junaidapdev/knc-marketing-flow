export const SCRIPT_REVISION_QUICK_FIXES = [
  { id: "make_shorter", label: "Make it shorter" },
  { id: "more_saudi_dialect", label: "More Saudi dialect" },
  { id: "less_formal", label: "Less formal" },
  { id: "stronger_hook", label: "Stronger hook" },
  { id: "more_funny", label: "More funny" },
  { id: "more_premium", label: "More premium" },
  { id: "less_shot_directions", label: "Less shot directions" },
  { id: "one_narrator_only", label: "One narrator only" },
] as const;

export type ScriptRevisionQuickFix =
  (typeof SCRIPT_REVISION_QUICK_FIXES)[number]["id"];

export const SCRIPT_REVISION_COPY = {
  title: "Revise with creator notes",
  description:
    "Give feedback, regenerate a better script, then apply it only when it looks right.",
  notesLabel: "Revision notes",
  notesPlaceholder:
    "Example: Make the hook stronger, keep it one narrator, and make the Arabic sound more Saudi.",
  quickFixLabel: "Quick fixes",
  regenerateButton: "Regenerate Script",
  regenerateAgainButton: "Regenerate Again",
  generatingButton: "Revising...",
  previewTitle: "Revised script preview",
  previewHelp: "Preview only. Your current script is not overwritten yet.",
  applyButton: "Apply Revised Script",
  applyingButton: "Applying...",
  cancelButton: "Cancel",
  appliedMessage: "Revised script applied",
  feedbackRequired: "Add notes or select at least one quick fix.",
  emptyCurrentScript: "Generate or write a script first, then revise it.",
  genericError: "Script revision failed.",
} as const;

export const SCRIPT_REVISION_LIMITS = {
  NOTES_MAX: 4000,
} as const;
