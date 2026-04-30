import type { RadarSection } from "../../types/today-summary";
import type { Task } from "../../types/task";
import { ASSIGNEE_LABELS } from "../../constants/task-chains";

interface Props {
  radar: RadarSection;
}

interface Bucket {
  label: string;
  tasks: Task[];
}

export function ThreeDayRadar({ radar }: Props): JSX.Element {
  const buckets: Bucket[] = [
    { label: "Tomorrow", tasks: radar.tomorrow },
    { label: "Day +2", tasks: radar.dayAfter },
    { label: "Day +3", tasks: radar.dayThree },
  ];

  return (
    <section className="card">
      <h3 className="h-card-sm mb-4">3-Day Radar</h3>
      <div className="space-y-4">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="border-b border-line last:border-b-0 pb-4 last:pb-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="eyebrow">{bucket.label}</span>
              <span className="text-[11.5px] text-ink-3">{bucket.tasks.length}</span>
            </div>
            {bucket.tasks.length === 0 ? (
              <div className="text-[12.5px] text-ink-3">Clear.</div>
            ) : (
              <ul className="space-y-1">
                {bucket.tasks.slice(0, 4).map((t) => (
                  <li key={t.id} className="text-[12.5px] text-ink truncate">
                    {t.title}
                    <span className="text-ink-3 mx-1">·</span>
                    <span className="text-ink-3">{ASSIGNEE_LABELS[t.assignee] ?? t.assignee}</span>
                  </li>
                ))}
                {bucket.tasks.length > 4 && (
                  <li className="text-[11.5px] text-ink-3">+{bucket.tasks.length - 4} more</li>
                )}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
