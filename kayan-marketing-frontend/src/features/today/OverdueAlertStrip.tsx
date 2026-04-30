import { AlertTriangle } from "lucide-react";

interface Props {
  count: number;
}

export function OverdueAlertStrip({ count }: Props): JSX.Element | null {
  if (count <= 0) return null;
  const label = count === 1 ? "task" : "tasks";
  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-5 rounded-md bg-rose/60 border border-rose-deep/30 text-[#6E2A35]">
      <AlertTriangle size={16} className="shrink-0" />
      <p className="text-[13px]">
        <span className="font-semibold">{count}</span> overdue {label} need attention.
      </p>
    </div>
  );
}
