import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../../../utils/api-client";
import type { ScriptRevisionQuickFix } from "../../../constants/script-revision";
import type { ScriptRevision } from "../../../types/script-revision";

export interface CreateScriptRevisionInput {
  entryId: string;
  currentScript: string;
  revisionNotes?: string | null;
  quickFixes: ScriptRevisionQuickFix[];
}

export function useCreateScriptRevision() {
  return useMutation({
    mutationFn: async (
      input: CreateScriptRevisionInput,
    ): Promise<ScriptRevision> => {
      const result = await apiRequest<ScriptRevision>("/script-revisions", {
        method: "POST",
        body: input,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });
}
