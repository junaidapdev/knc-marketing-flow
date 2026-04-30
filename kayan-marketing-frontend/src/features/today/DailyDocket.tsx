import type { Task, TaskStatus } from "../../types/task";
import { TaskRow } from "./TaskRow";

// Single-person columns only — a task with assignee="both" appears in BOTH
// of these lists (filter below uses `=== id || === 'both'`).
type SingleAssignee = "junaid" | "ammar";

interface AssigneeMeta {
  id: SingleAssignee;
  initial: string;
  avatarBg: string;
}

const ASSIGNEES: ReadonlyArray<AssigneeMeta> = [
  { id: "ammar", initial: "A", avatarBg: "bg-peach" },
  { id: "junaid", initial: "J", avatarBg: "bg-yellow" },
];

interface Props {
  tasks: Task[];
  onToggleStatus: (taskId: string, nextStatus: TaskStatus) => void;
  onOpenTaskMenu?: (task: Task) => void;
  pendingTaskId?: string | null;
}

export function DailyDocket({
  tasks,
  onToggleStatus,
  onOpenTaskMenu,
  pendingTaskId,
}: Props): JSX.Element {
  const groups = ASSIGNEES.map((meta) => ({
    meta,
    items: tasks.filter((t) => t.assignee === meta.id || t.assignee === "both"),
  }));

  if (tasks.length === 0) {
    return (
      <div className="text-[13px] text-ink-3 py-2">
        Nothing on the docket. Use the buttons above to add a task or entry.
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {groups.map((group) => {
        const doneCount = group.items.filter((t) => t.status === "completed").length;
        return (
          <section key={group.meta.id}>
            <div className="flex items-center gap-3 mb-1">
              <div
                className={`w-7 h-7 rounded-full ${group.meta.avatarBg} grid place-items-center font-serif text-[12px] text-obsidian flex-shrink-0`}
              >
                {group.meta.initial}
              </div>
              <div className="text-[13.5px] font-semibold text-ink capitalize">
                {group.meta.id}
              </div>
              <div className="ml-auto text-[11.5px] text-ink-3">
                {doneCount} of {group.items.length} done
              </div>
            </div>
            {group.items.length === 0 ? (
              <div className="text-[12.5px] text-ink-3 py-3 pl-10">
                Nothing on the docket.
              </div>
            ) : (
              <div>
                {group.items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggleStatus={onToggleStatus}
                    onOpenMenu={onOpenTaskMenu}
                    isPending={pendingTaskId === task.id}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
