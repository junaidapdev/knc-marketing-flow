import { MoreVertical, MapPin, Check } from "lucide-react";
import type { Task, TaskStatus } from "../../types/task";
import { ASSIGNEE_LABELS } from "../../constants/task-chains";

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  pending: "in_progress",
  in_progress: "completed",
  completed: "pending",
};

const STATUS_CHIP: Record<TaskStatus, string> = {
  pending: "status-planned",
  in_progress: "status-active",
  completed: "status-done",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Done",
};

interface Props {
  task: Task;
  onToggleStatus: (taskId: string, nextStatus: TaskStatus) => void;
  onOpenMenu?: (task: Task) => void;
  isPending?: boolean;
}

export function TaskRow({ task, onToggleStatus, onOpenMenu, isPending }: Props): JSX.Element {
  const isCompleted = task.status === "completed";

  const handleToggle = (): void => {
    onToggleStatus(task.id, NEXT_STATUS[task.status]);
  };

  return (
    <div
      className={`flex items-center gap-3.5 py-3 border-b border-line last:border-b-0 ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        aria-label={isCompleted ? "Mark as not done" : "Mark as completed"}
        className={`check-btn ${isCompleted ? "check-btn-done" : ""}`}
      >
        {isCompleted && <Check size={12} strokeWidth={2.5} className="text-yellow" />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className={`text-[13.5px] font-medium leading-snug truncate ${
            isCompleted ? "line-through text-ink-3" : "text-ink"
          }`}
        >
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11.5px] text-ink-3">
          <span>{task.dueDate}</span>
          <span className="text-ink-3/60">·</span>
          <span>{ASSIGNEE_LABELS[task.assignee] ?? task.assignee}</span>
          {task.branch && (
            <>
              <span className="text-ink-3/60">·</span>
              <span
                className="inline-flex items-center gap-1 text-sage-deep"
                title={`${task.branch.name} · ${task.branch.city}`}
              >
                <MapPin size={11} />
                {task.branch.name}
              </span>
            </>
          )}
        </div>
      </div>
      <span className={`chip ${STATUS_CHIP[task.status]}`}>{STATUS_LABEL[task.status]}</span>
      {task.phase && <span className="chip chip-default capitalize">{task.phase}</span>}
      {onOpenMenu && (
        <button
          onClick={() => onOpenMenu(task)}
          aria-label="Task menu"
          className="grid place-items-center w-[30px] h-[30px] rounded-[10px] text-ink-3 hover:bg-cream-2 hover:text-ink"
        >
          <MoreVertical size={15} />
        </button>
      )}
    </div>
  );
}
