import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { ENTRY_TYPES, ENTRY_TYPE_LABELS, type EntryType } from "../../constants/entry-types";
import { PATTERNS, type PatternId } from "../../constants/patterns";
import {
  TOPIC_OCCASIONS,
  TOPIC_OCCASION_LABELS,
  type TopicOccasion,
} from "../../constants/topics";
import { BranchSelector } from "../branches/BranchSelector";
import { useCreateTopic } from "./hooks/use-topics";
import { logger } from "../../utils/logger";

const ENTRY_TYPE_VALUES = Object.values(ENTRY_TYPES) as [EntryType, ...EntryType[]];

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters.").max(200),
  description: z.string().max(2000).optional(),
  patternId: z.string().regex(/^P\d{1,2}$/).or(z.literal("")).optional(),
  branchId: z.string().optional(),
  theme: z.string().max(200).optional(),
  occasion: z.string().optional(),
  entryType: z.enum(ENTRY_TYPE_VALUES),
  priority: z.coerce.number().int().min(0).max(100),
  notes: z.string().max(5000).optional(),
});

type FormInput = z.infer<typeof formSchema>;

interface Props {
  brandId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AddTopicModal({ brandId, isOpen, onClose }: Props): JSX.Element | null {
  const createTopic = useCreateTopic();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      patternId: "",
      branchId: "",
      theme: "",
      occasion: "regular",
      entryType: ENTRY_TYPES.INSTAGRAM_REEL,
      priority: 0,
      notes: "",
    },
  });

  // Reset on open so the form's clean each time the modal pops.
  useEffect(() => {
    if (isOpen) {
      reset({
        title: "",
        description: "",
        patternId: "",
        branchId: "",
        theme: "",
        occasion: "regular",
        entryType: ENTRY_TYPES.INSTAGRAM_REEL,
        priority: 0,
        notes: "",
      });
    }
  }, [isOpen, reset]);

  const onSubmit = async (input: FormInput): Promise<void> => {
    try {
      await createTopic.mutateAsync({
        brandId,
        title: input.title,
        description: input.description?.trim() ? input.description : null,
        patternId: input.patternId ? (input.patternId as PatternId) : null,
        branchId: input.branchId || null,
        theme: input.theme?.trim() ? input.theme : null,
        occasion: (input.occasion as TopicOccasion) || null,
        entryType: input.entryType,
        priority: input.priority,
        notes: input.notes?.trim() ? input.notes : null,
      });
      onClose();
    } catch (err) {
      logger.error("topic create failed", { err: String(err) });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-paper rounded-lg shadow-lg text-ink max-h-[95vh] sm:max-h-[90vh] overflow-y-auto canvas-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-line sticky top-0 bg-paper z-10">
          <div>
            <h2 className="font-serif text-[20px] tracking-tight text-ink">
              Add a topic
            </h2>
            <p className="text-[12px] text-ink-3 mt-0.5">
              Drop an idea into the queue. Use it later to spawn an entry in one click.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-4 sm:px-6 py-5 space-y-4">
          <div>
            <label className="field-label">Title</label>
            <input
              type="text"
              placeholder="e.g., Boxed chocolates Mother's Day showcase"
              {...register("title")}
              className="form-input"
            />
            {errors.title && (
              <p className="text-rose-deep text-[12px] mt-1.5">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="field-label">Description (optional)</label>
            <textarea rows={2} {...register("description")} className="form-textarea" />
          </div>

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
              <label className="field-label">Entry type</label>
              <select {...register("entryType")} className="form-select">
                {ENTRY_TYPE_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {ENTRY_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Branch (optional)</label>
              <Controller
                name="branchId"
                control={control}
                render={({ field }) => (
                  <BranchSelector
                    brandId={brandId}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    includeAllOption
                    allOptionLabel="— any branch —"
                    ariaLabel="Branch"
                  />
                )}
              />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Occasion</label>
              <select {...register("occasion")} className="form-select">
                {TOPIC_OCCASIONS.map((o) => (
                  <option key={o} value={o}>
                    {TOPIC_OCCASION_LABELS[o]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Priority (0–100)</label>
              <input
                type="number"
                min={0}
                max={100}
                {...register("priority")}
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Notes (optional)</label>
            <textarea rows={2} {...register("notes")} className="form-textarea" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary disabled:opacity-50"
            >
              {isSubmitting ? "Saving…" : "Save topic"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
