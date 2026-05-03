// Frontend mirror of kayan-marketing-backend/src/validation/brand-dna.ts.
// voiceConfig is freeform JSON; the AI prompt builder reads specific keys
// (anchor_price, branches, patterns) but the shape is otherwise extensible.

export interface BrandDna {
  brandId: string;
  dnaMarkdown: string;
  voiceConfig: Record<string, unknown>;
  updatedAt: string;
}

export interface UpdateBrandDnaInput {
  dnaMarkdown: string;
  voiceConfig: Record<string, unknown>;
  changeNote?: string | null;
}

// List view metadata only — no full content per row to keep the response
// light. Detail GET adds dnaMarkdown + voiceConfig.
export interface BrandDnaHistoryEntry {
  id: string;
  brandId: string;
  editedBy: string | null;
  editorName: string | null;
  changeNote: string | null;
  createdAt: string;
}

export interface BrandDnaHistoryDetail extends BrandDnaHistoryEntry {
  dnaMarkdown: string;
  voiceConfig: Record<string, unknown>;
}
