import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, AlertTriangle } from "lucide-react";
import { addDays, format, parseISO, isValid } from "date-fns";
import { ENTRY_TYPES, ENTRY_TYPE_LABELS, type EntryType } from "../../constants/entry-types";
import {
  computeTaskChain,
  computeBatchVideoChain,
  ASSIGNEE_VALUES,
  ASSIGNEE_LABELS,
  nextAssignee,
  type Assignee,
  type PreviewTask,
} from "../../constants/task-chains";
import { useCurrentBrand } from "../../hooks/use-current-brand";
import { useBrand } from "../brand/hooks/use-brand";
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABELS,
  type BudgetCategory,
} from "../../constants/budget-categories";
import { useCreateEntry } from "./hooks/use-calendar-entries";
import { BranchSelector } from "../branches/BranchSelector";
import { InfluencerSelector } from "../influencers/InfluencerSelector";
import { PATTERNS, type PatternId } from "../../constants/patterns";
import { logger } from "../../utils/logger";

const ENTRY_TYPE_VALUES = Object.values(ENTRY_TYPES) as [EntryType, ...EntryType[]];
const BUDGET_CATEGORY_VALUES = Object.values(BUDGET_CATEGORIES) as [BudgetCategory, ...BudgetCategory[]];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PRODUCTION_MODES = ["batch", "adhoc"] as const;

// Only these types use the batch shoot-day model. Stories / shop activities
// keep their existing chains regardless of production mode.
const BATCHABLE_TYPES: ReadonlySet<EntryType> = new Set([
  ENTRY_TYPES.TIKTOK_VIDEO,
  ENTRY_TYPES.INSTAGRAM_REEL,
]);

const formSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters.").max(200),
    type: z.enum(ENTRY_TYPE_VALUES),
    targetDate: z.string().regex(DATE_REGEX, "Date is required."),
    assignee: z.enum(ASSIGNEE_VALUES),
    description: z.string().max(2000).optional(),
    budgetAllocated: z.coerce.number().nonnegative(),
    budgetCategory: z.enum(BUDGET_CATEGORY_VALUES).optional(),
    notes: z.string().max(5000).optional(),
    autoCreateTasks: z.boolean(),
    branchId: z.string().optional(),
    influencerId: z.string().optional(),
    productionMode: z.enum(PRODUCTION_MODES),
    shootDate: z.string().optional(),
    editorDaysOffset: z.coerce.number().int().min(0).max(30),
    // Recipe Book V2 tagging — both optional. Empty string in the form maps
    // to null on the wire (clears the field).
    patternId: z.string().regex(/^P\d{1,2}$/).or(z.literal("")).optional(),
    theme: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === ENTRY_TYPES.SHOP_ACTIVITY && !data.branchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["branchId"],
        message: "Please select a branch for shop activity entries.",
      });
    }
    if (data.type === ENTRY_TYPES.INFLUENCER_COLLAB && !data.influencerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["influencerId"],
        message: "Please select an influencer for collaboration entries.",
      });
    }
    // Batch-mode video entries must have a shoot day. Without it the script
    // / shoot / edit / schedule chain has no anchor.
    if (
      data.productionMode === "batch" &&
      BATCHABLE_TYPES.has(data.type) &&
      (!data.shootDate || !DATE_REGEX.test(data.shootDate))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shootDate"],
        message: "Pick a shoot day for batch-mode video entries.",
      });
    }
  });

type FormInput = z.infer<typeof formSchema>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  brandId: string;
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
}

export function AddEntryModal({ brandId, isOpen, onClose, defaultDate }: Props): JSX.Element | null {
  const createEntry = useCreateEntry();
  const { brandId: currentBrandId } = useCurrentBrand();
  const brand = useBrand(currentBrandId);
  const editorOffsetDefault = brand.data?.defaultEditorOffset ?? 2;
  const schedulingBuffer = brand.data?.defaultSchedulingBuffer ?? 3;
  const branchSelectorRef = useRef<HTMLSelectElement | null>(null);
  const influencerSelectorRef = useRef<HTMLSelectElement | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      type: ENTRY_TYPES.TIKTOK_VIDEO,
      targetDate: defaultDate ?? todayIso(),
      assignee: "junaid",
      description: "",
      budgetAllocated: 0,
      budgetCategory: undefined,
      notes: "",
      autoCreateTasks: true,
      branchId: "",
      influencerId: "",
      productionMode: "batch",
      shootDate: "",
      editorDaysOffset: 2,
      patternId: "",
      theme: "",
    },
  });

  // Per-task assignee overrides keyed by phase. Cleared whenever the modal
  // reopens or the entry type/date changes (since the chain itself changes).
  const [assigneeOverrides, setAssigneeOverrides] = useState<Record<string, Assignee>>({});

  useEffect(() => {
    if (isOpen) {
      reset({
        title: "",
        type: ENTRY_TYPES.TIKTOK_VIDEO,
        targetDate: defaultDate ?? todayIso(),
        assignee: "junaid",
        description: "",
        budgetAllocated: 0,
        budgetCategory: undefined,
        notes: "",
        autoCreateTasks: true,
        branchId: "",
        influencerId: "",
        productionMode: "batch",
        shootDate: "",
        editorDaysOffset: 2,
        patternId: "",
        theme: "",
      });
      setAssigneeOverrides({});
    }
  }, [isOpen, defaultDate, reset]);

  const watchedType = watch("type");
  const watchedDate = watch("targetDate");
  const watchedAuto = watch("autoCreateTasks");
  const watchedAssignee = watch("assignee");
  const watchedMode = watch("productionMode");
  const watchedShootDate = watch("shootDate");
  const watchedEditorOffset = watch("editorDaysOffset");
  const isShopActivity = watchedType === ENTRY_TYPES.SHOP_ACTIVITY;
  const isInfluencerCollab = watchedType === ENTRY_TYPES.INFLUENCER_COLLAB;
  const isBatchable = BATCHABLE_TYPES.has(watchedType);
  const useBatchChain = isBatchable && watchedMode === "batch";

  // Reset per-task overrides when the chain shape changes (different recipe).
  useEffect(() => {
    setAssigneeOverrides({});
  }, [watchedType]);

  // When the user switches type, keep branchId consistent: clear it leaving
  // shop_activity, autofocus the selector when entering shop_activity.
  useEffect(() => {
    if (!isShopActivity) {
      setValue("branchId", "");
      return undefined;
    }
    const id = window.setTimeout(() => branchSelectorRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [isShopActivity, setValue]);

  useEffect(() => {
    if (!isInfluencerCollab) {
      setValue("influencerId", "");
      return undefined;
    }
    const id = window.setTimeout(() => influencerSelectorRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [isInfluencerCollab, setValue]);

  const basePreview: PreviewTask[] = useMemo(() => {
    if (!watchedAuto || !DATE_REGEX.test(watchedDate)) return [];
    if (
      useBatchChain &&
      watchedShootDate &&
      DATE_REGEX.test(watchedShootDate)
    ) {
      return computeBatchVideoChain({
        type: watchedType,
        shootDate: watchedShootDate,
        targetDate: watchedDate,
        editorDaysOffset: watchedEditorOffset,
        schedulingBuffer,
      });
    }
    return computeTaskChain(watchedType, watchedDate);
  }, [
    watchedAuto,
    watchedDate,
    watchedType,
    useBatchChain,
    watchedShootDate,
    watchedEditorOffset,
    schedulingBuffer,
  ]);

  const previewWithOverrides: PreviewTask[] = useMemo(
    () =>
      basePreview.map((t) => ({
        ...t,
        assignee: assigneeOverrides[t.phase] ?? t.assignee,
      })),
    [basePreview, assigneeOverrides],
  );

  const cycleRowAssignee = (phase: string, current: Assignee): void => {
    setAssigneeOverrides((prev) => ({ ...prev, [phase]: nextAssignee(current) }));
  };

  // The entry-level Assignee field is only shown when there's no task chain
  // doing the work — either auto-create is off, or the type has an empty
  // recipe (e.g. "general"). Otherwise we derive the entry's assignee from
  // the chain rows so the two fields can't disagree.
  const showEntryAssigneePicker = !watchedAuto || basePreview.length === 0;

  // If the chain has a single assignee across all rows, that's the entry
  // owner. If it's mixed, the entry is co-owned ("both"). When the picker
  // is shown, the user's manual choice wins.
  const deriveEntryAssignee = (input: FormInput): Assignee => {
    if (showEntryAssigneePicker) return input.assignee;
    const unique = new Set(previewWithOverrides.map((r) => r.assignee));
    if (unique.size === 1) {
      const only = previewWithOverrides[0]?.assignee;
      return only ?? input.assignee;
    }
    return "both";
  };

  const onSubmit = async (input: FormInput): Promise<void> => {
    const hasOverrides = Object.keys(assigneeOverrides).length > 0;
    const isBatchSubmit = BATCHABLE_TYPES.has(input.type) && input.productionMode === "batch";
    try {
      const result = await createEntry.mutateAsync({
        brandId,
        type: input.type,
        title: input.title,
        description: input.description?.trim() ? input.description : null,
        targetDate: input.targetDate,
        assignee: deriveEntryAssignee(input),
        budgetAllocated: input.budgetAllocated,
        budgetCategory: input.budgetCategory ?? null,
        notes: input.notes?.trim() ? input.notes : null,
        autoCreateTasks: input.autoCreateTasks,
        branchId: input.branchId ? input.branchId : null,
        influencerId: input.influencerId ? input.influencerId : null,
        // Send the resolved chain only if the user changed any assignee;
        // otherwise let the backend reapply the default recipe.
        taskChainOverride:
          input.autoCreateTasks && hasOverrides ? previewWithOverrides : undefined,
        productionMode: input.productionMode,
        // Recipe Book V2 tagging — empty string from the form maps to null.
        patternId: input.patternId ? (input.patternId as PatternId) : null,
        theme: input.theme?.trim() ? input.theme.trim() : null,
        // Only send a shoot date when it's a batch-mode video entry — for
        // ad-hoc or non-batchable types the field is meaningless.
        shootDate: isBatchSubmit && input.shootDate ? input.shootDate : null,
        editorDaysOffset: input.editorDaysOffset,
      });
      logger.info("created entry from modal", {
        entryId: result.entry.id,
        taskCount: result.tasks.length,
      });
      onClose();
    } catch (err) {
      logger.error("entry create failed", { err: String(err) });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-2 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-paper rounded-lg shadow-lg text-ink max-h-[95vh] sm:max-h-[90vh] overflow-y-auto canvas-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-7 py-4 sm:py-5 border-b border-line sticky top-0 bg-paper z-10">
          <div>
            <h2 className="font-serif text-[22px] tracking-tight text-ink">
              Add calendar entry
            </h2>
            <p className="text-[12.5px] text-ink-3 mt-0.5">
              Plan content, store activities, or one-off tasks.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-4 sm:px-7 py-5 sm:py-6 space-y-4">
          <div>
            <label className="field-label">Title</label>
            <input type="text" {...register("title")} className="form-input" />
            {errors.title && (
              <p className="text-rose-deep text-[12px] mt-1.5">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Type</label>
              <select {...register("type")} className="form-select">
                {ENTRY_TYPE_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {ENTRY_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Target date</label>
              <input type="date" {...register("targetDate")} className="form-input" />
              {errors.targetDate && (
                <p className="text-rose-deep text-[12px] mt-1.5">{errors.targetDate.message}</p>
              )}
            </div>
          </div>

          {isShopActivity && (
            <div>
              <label className="field-label">Branch</label>
              <Controller
                name="branchId"
                control={control}
                render={({ field }) => (
                  <BranchSelector
                    ref={branchSelectorRef}
                    brandId={brandId}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    required
                    ariaLabel="Branch"
                  />
                )}
              />
              {errors.branchId && (
                <p className="text-rose-deep text-[12px] mt-1.5">{errors.branchId.message}</p>
              )}
            </div>
          )}

          {isInfluencerCollab && (
            <div>
              <label className="field-label">Influencer</label>
              <Controller
                name="influencerId"
                control={control}
                render={({ field }) => (
                  <InfluencerSelector
                    ref={influencerSelectorRef}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    required
                    ariaLabel="Influencer"
                  />
                )}
              />
              {errors.influencerId && (
                <p className="text-rose-deep text-[12px] mt-1.5">
                  {errors.influencerId.message}
                </p>
              )}
            </div>
          )}

          {/* Production mode toggle. Only shows for video types — shop
              activities, stories, etc. always run on their legacy chains so
              the toggle would just be noise. */}
          {isBatchable && (
            <div>
              <label className="field-label">Production mode</label>
              <div className="tab-group">
                <button
                  type="button"
                  onClick={() => setValue("productionMode", "batch", { shouldDirty: true })}
                  className={`tab ${watchedMode === "batch" ? "tab-active" : ""}`}
                >
                  Batch shoot
                </button>
                <button
                  type="button"
                  onClick={() => setValue("productionMode", "adhoc", { shouldDirty: true })}
                  className={`tab ${watchedMode === "adhoc" ? "tab-active" : ""}`}
                >
                  Quick post
                </button>
              </div>
              <p className="text-[11.5px] text-ink-3 mt-1.5">
                {watchedMode === "batch"
                  ? "Filmed on a planned shoot day with other entries — script, shoot, edit, schedule chain anchors on the shoot date."
                  : "Made and posted on the fly — used for trends, stories, or anything that bypasses the shoot-day rhythm."}
              </p>
            </div>
          )}

          {/* Shoot day + editor offset — only relevant for batch-mode videos. */}
          {useBatchChain && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Shoot day</label>
                <input
                  type="date"
                  {...register("shootDate")}
                  className="form-input"
                />
                {errors.shootDate && (
                  <p className="text-rose-deep text-[12px] mt-1.5">{errors.shootDate.message}</p>
                )}
              </div>
              <div>
                <label className="field-label">
                  Editor turnaround
                  <span className="text-ink-3 font-normal"> (days)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  {...register("editorDaysOffset")}
                  className="form-input"
                />
                <p className="text-[11.5px] text-ink-3 mt-1">
                  Default {editorOffsetDefault}d · scheduling buffer {schedulingBuffer}d
                </p>
              </div>
            </div>
          )}

          <TimelineWarning
            useBatchChain={useBatchChain}
            shootDate={watchedShootDate}
            targetDate={watchedDate}
            editorDaysOffset={watchedEditorOffset}
            schedulingBuffer={schedulingBuffer}
          />

          <div>
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                {...register("autoCreateTasks")}
                className="accent-obsidian"
              />
              <span>Auto-create task chain</span>
            </label>
            {watchedAuto && basePreview.length > 0 && (
              <p className="text-[11.5px] text-ink-3 mt-1.5 ml-6">
                The entry's owner is set automatically from the task chain below.
              </p>
            )}
          </div>

          {showEntryAssigneePicker && (
            <div>
              <label className="field-label">Assignee</label>
              <div className="tab-group">
                {ASSIGNEE_VALUES.map((a) => (
                  <button
                    type="button"
                    key={a}
                    onClick={() => setValue("assignee", a, { shouldDirty: true })}
                    className={`tab ${watchedAssignee === a ? "tab-active" : ""}`}
                  >
                    {ASSIGNEE_LABELS[a]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recipe Book V2 tagging — both optional. Setting these on
              creation means the very first ✨ Generate produces an
              on-pattern, on-theme script. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Pattern</label>
              <select {...register("patternId")} className="form-select">
                <option value="">— none —</option>
                {PATTERNS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Theme</label>
              <input
                type="text"
                placeholder="e.g., Japanese cake new flavors"
                maxLength={200}
                {...register("theme")}
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Description</label>
            <textarea rows={2} {...register("description")} className="form-textarea" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Budget (SAR)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register("budgetAllocated")}
                className="form-input"
              />
              {errors.budgetAllocated && (
                <p className="text-rose-deep text-[12px] mt-1.5">
                  {errors.budgetAllocated.message}
                </p>
              )}
            </div>
            <div>
              <label className="field-label">Budget category</label>
              <select {...register("budgetCategory")} className="form-select">
                <option value="">— none —</option>
                {BUDGET_CATEGORY_VALUES.map((c) => (
                  <option key={c} value={c}>
                    {BUDGET_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Notes</label>
            <textarea rows={2} {...register("notes")} className="form-textarea" />
          </div>

          {previewWithOverrides.length > 0 && (
            <div className="card card-cream">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="h-card-sm">Task preview</h3>
                <span className="text-[11px] text-ink-3">
                  Click an assignee to cycle Junaid → Ammar → Both
                </span>
              </div>
              <ul className="space-y-2 text-[12.5px]">
                {previewWithOverrides.map((t) => (
                  <li
                    key={t.phase}
                    className="flex justify-between items-center pb-2 border-b border-line last:border-b-0 last:pb-0"
                  >
                    <span>
                      <span className="text-ink-3 mr-2">{t.dueDate}</span>
                      <span className="text-ink">{t.title}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => cycleRowAssignee(t.phase, t.assignee)}
                      className="chip chip-default hover:brightness-95 transition"
                      title="Click to change assignee"
                    >
                      {ASSIGNEE_LABELS[t.assignee]}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {createEntry.isError && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] px-3 py-2 text-[12.5px]">
              {createEntry.error instanceof Error
                ? createEntry.error.message
                : "Failed to create entry."}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || createEntry.isPending}
              className="btn btn-primary disabled:opacity-50"
            >
              {createEntry.isPending ? "Creating…" : "Create entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Inline timeline conflict warning. Catches the most common production
// mistake: setting a live date that's earlier than when editing finishes
// (or earlier than the shoot day itself). The warning is informational —
// it doesn't block save, since marketers sometimes legitimately overlap
// timelines (e.g., expedited edits).
interface TimelineWarningProps {
  useBatchChain: boolean;
  shootDate?: string;
  targetDate: string;
  editorDaysOffset: number;
  schedulingBuffer: number;
}

function TimelineWarning(props: TimelineWarningProps): JSX.Element | null {
  const { useBatchChain, shootDate, targetDate, editorDaysOffset, schedulingBuffer } = props;
  if (!useBatchChain) return null;
  if (!shootDate) return null;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(shootDate) || !dateRegex.test(targetDate)) return null;

  const shoot = parseISO(shootDate);
  const target = parseISO(targetDate);
  if (!isValid(shoot) || !isValid(target)) return null;

  const editFinishes = addDays(shoot, editorDaysOffset);
  const scheduleBy = addDays(target, -schedulingBuffer);

  const issues: string[] = [];

  // Live before shoot — categorically impossible.
  if (target < shoot) {
    issues.push(
      `Live date (${format(target, "MMM d")}) is before the shoot day (${format(
        shoot,
        "MMM d",
      )}). You can't post a video before you film it.`,
    );
  }

  // Live before edit completes — possible only with rushed editing.
  if (target < editFinishes) {
    issues.push(
      `Editing finishes ${format(editFinishes, "MMM d")}, but the live date is ${format(
        target,
        "MMM d",
      )}. Push the live date later, or shorten the editor turnaround.`,
    );
  }

  // Schedule date before edit finishes — content won't exist when it's time to queue.
  if (scheduleBy < editFinishes) {
    issues.push(
      `Editing finishes ${format(editFinishes, "MMM d")}, but the schedule deadline is ${format(
        scheduleBy,
        "MMM d",
      )}. Increase the live date by at least ${
        Math.ceil((editFinishes.getTime() - scheduleBy.getTime()) / 86_400_000)
      } day(s).`,
    );
  }

  if (issues.length === 0) return null;

  return (
    <div className="rounded-md bg-yellow-bg border border-yellow/60 px-3 py-2.5 text-[12.5px] text-ink-2 flex items-start gap-2">
      <AlertTriangle size={14} className="text-yellow-bg-deep flex-shrink-0 mt-0.5" />
      <div className="space-y-1">
        <div className="font-semibold text-ink">Timeline conflict</div>
        {issues.map((m, i) => (
          <div key={i}>{m}</div>
        ))}
      </div>
    </div>
  );
}
