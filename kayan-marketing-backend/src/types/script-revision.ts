import type { SCRIPT_REVISION_QUICK_FIX_VALUES } from "../constants/script-revision";

export type ScriptRevisionQuickFix =
  (typeof SCRIPT_REVISION_QUICK_FIX_VALUES)[number];

export interface ScriptRevision {
  id: string;
  entryId: string;
  previousScript: string;
  revisionNotes: string | null;
  quickFixes: ScriptRevisionQuickFix[];
  revisedScript: string;
  model: string;
  createdBy: string | null;
  createdAt: string;
}
