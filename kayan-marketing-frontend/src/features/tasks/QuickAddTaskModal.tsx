import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { ASSIGNEE_VALUES, ASSIGNEE_LABELS, type Assignee } from "../../constants/task-chains";
import { useCreateTask } from "./hooks/use-tasks";
import { logger } from "../../utils/logger";
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters.").max(200),
  dueDate: z.string().regex(DATE_REGEX, "Date is required."),
  assignee: z.enum(ASSIGNEE_VALUES),
  notes: z.string().max(5000).optional(),
});

type FormInput = z.infer<typeof formSchema>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultDueDate?: string;
  defaultAssignee?: Assignee;
}

export function QuickAddTaskModal({
  isOpen,
  onClose,
  defaultDueDate,
  defaultAssignee = "junaid",
}: Props): JSX.Element | null {
  const createTask = useCreateTask();

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
      dueDate: defaultDueDate ?? todayIso(),
      assignee: defaultAssignee,
      notes: "",
    },
  });

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const onSubmit = async (input: FormInput): Promise<void> => {
    try {
      await createTask.mutateAsync({
        title: input.title,
        dueDate: input.dueDate,
        assignee: input.assignee,
        isStandalone: true,
        notes: input.notes?.trim() ? input.notes : null,
      });
      onClose();
    } catch (err) {
      logger.error("quick-add task failed", { err: String(err) });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/40 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-paper rounded-lg shadow-lg text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-serif text-[18px] tracking-tight text-ink">
            Quick add task
          </h2>
          <button onClick={onClose} aria-label="Close" className="iconbtn">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-5 space-y-3">
          <div>
            <label className="field-label">Title</label>
            <input {...register("title")} autoFocus className="form-input" />
            {errors.title && (
              <p className="text-rose-deep text-[12px] mt-1.5">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="field-label">Due date</label>
            <input type="date" {...register("dueDate")} className="form-input" />
            {errors.dueDate && (
              <p className="text-rose-deep text-[12px] mt-1.5">{errors.dueDate.message}</p>
            )}
          </div>

          <div>
            <label className="field-label">Assignee</label>
            <Controller
              name="assignee"
              control={control}
              render={({ field }) => (
                <div className="tab-group">
                  {ASSIGNEE_VALUES.map((a) => (
                    <button
                      type="button"
                      key={a}
                      onClick={() => field.onChange(a)}
                      className={`tab ${field.value === a ? "tab-active" : ""}`}
                    >
                      {ASSIGNEE_LABELS[a]}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div>
            <label className="field-label">Notes</label>
            <textarea rows={2} {...register("notes")} className="form-textarea" />
          </div>

          {createTask.isError && (
            <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] px-3 py-2 text-[12.5px]">
              {createTask.error instanceof Error
                ? createTask.error.message
                : "Failed to create task."}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || createTask.isPending}
              className="btn btn-primary disabled:opacity-50"
            >
              {createTask.isPending ? "Adding…" : "Add task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
