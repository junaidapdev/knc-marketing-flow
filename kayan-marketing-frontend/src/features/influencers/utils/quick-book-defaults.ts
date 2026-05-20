import { addDays, format } from "date-fns";
import { CONTENT_FORMATS } from "../../../constants/content-formats";
import { BUDGET_CATEGORIES } from "../../../constants/budget-categories";
import type { CreateEntryInput } from "../../calendar/hooks/use-calendar-entries";
import type { Influencer } from "../../../types/influencer";
import type { Brand } from "../../../types/brand";

// Brand defaults — used when the brand row hasn't loaded yet (popover
// can render before the brand query resolves) OR when a future chunk
// adds a quick-book path that doesn't already have brand data on hand.
export const QUICK_BOOK_FALLBACK_SCHEDULING_BUFFER = 3;
export const QUICK_BOOK_FALLBACK_EDITOR_OFFSET = 2;

export interface QuickBookDefaultsArgs {
  influencer: Influencer;
  primaryName: string;
  targetDate: Date;
  brand: Brand | null | undefined;
  // Optional overrides used by the QuickBookPopover, where the user
  // can edit title / budget / shoot date before clicking Book. The
  // CalendarStrip drop path doesn't pass any of these.
  titleOverride?: string;
  budgetOverride?: number;
  shootDateOverride?: string | null;
}

// Single source of truth for "what would Quick Book send to
// create_entry_with_tasks given this influencer + date?". The popover
// and the calendar-strip drop handler both call this so neither can
// drift from the other.
export function buildQuickBookEntryInput(
  args: QuickBookDefaultsArgs,
): CreateEntryInput {
  const { influencer, primaryName, targetDate, brand } = args;
  const schedulingBuffer =
    brand?.defaultSchedulingBuffer ?? QUICK_BOOK_FALLBACK_SCHEDULING_BUFFER;
  const editorOffset =
    brand?.defaultEditorOffset ?? QUICK_BOOK_FALLBACK_EDITOR_OFFSET;

  const targetDateIso = format(targetDate, "yyyy-MM-dd");
  const defaultShootDateIso = format(
    addDays(targetDate, -schedulingBuffer),
    "yyyy-MM-dd",
  );

  return {
    brandId: influencer.brandId,
    format: CONTENT_FORMATS.INFLUENCER_COLLAB,
    platforms: [],
    title: args.titleOverride ?? `Collab with ${primaryName}`,
    description: null,
    targetDate: targetDateIso,
    // V1 single-user. Swap for auth user when the second influencer
    // manager arrives — the contract here doesn't change.
    assignee: "junaid",
    budgetAllocated:
      args.budgetOverride ?? influencer.standardRate ?? 0,
    budgetCategory: BUDGET_CATEGORIES.INFLUENCER,
    notes: null,
    autoCreateTasks: true,
    branchId: null,
    influencerId: influencer.id,
    productionMode: "batch",
    // `shootDateOverride === null` means "explicitly no shoot date".
    // `undefined` means "use the default offset".
    shootDate:
      args.shootDateOverride !== undefined
        ? args.shootDateOverride
        : defaultShootDateIso,
    editorDaysOffset: editorOffset,
    patternId: null,
    theme: null,
  };
}
