import { Sparkles } from "lucide-react";
import { useAIStore } from "../../stores/ai-store";

export function AIFloatingButton(): JSX.Element | null {
  const open = useAIStore((s) => s.open);
  const isOpen = useAIStore((s) => s.isOpen);

  if (isOpen) return null;

  return (
    <button
      onClick={open}
      aria-label="Open AI assistant"
      title="Ask Kayan AI"
      className="absolute bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-obsidian text-yellow grid place-items-center shadow-fab hover:scale-105 transition-transform"
    >
      <span className="ai-fab-pulse" aria-hidden />
      <Sparkles size={22} />
    </button>
  );
}
