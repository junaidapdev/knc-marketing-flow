import type { ScriptRevisionQuickFix } from "../constants/script-revision";

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
