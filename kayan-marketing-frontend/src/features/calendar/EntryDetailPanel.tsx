import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  Trash2,
  Copy,
  Check as CheckIcon,
  Sparkles,
  Calendar,
  User,
  Tag,
  Circle,
  MapPin,
  Link2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  CheckSquare,
  FileText,
  MessageSquare,
  Hash,
  Clapperboard,
  Scissors,
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import {
  ENTRY_TYPES,
  ENTRY_TYPE_LABELS,
  type EntryType,
} from "../../constants/entry-types";
import {
  ASSIGNEE_VALUES,
  ASSIGNEE_LABELS,
  type Assignee,
} from "../../constants/task-chains";
import {
  useEntryDetail,
  useUpdateEntry,
  useDeleteEntry,
  type EntryWithTasks,
} from "./hooks/use-calendar-entries";
import { useUpdateTask, useDeleteTask } from "../tasks/hooks/use-tasks";
import { BranchSelector } from "../branches/BranchSelector";
import { useCurrentBrand } from "../../hooks/use-current-brand";
import type { Task, TaskStatus } from "../../types/task";
import type { EntryStatus, ProductionMode } from "../../types/calendar-entry";
import { logger } from "../../utils/logger";
import { useAIStore } from "../../stores/ai-store";
import {
  needsContentAuthoring,
  showsScriptField,
  showsCaptionField,
  showsHashtagsField,
} from "./content-helpers";
import { PROMPT_TEMPLATES, type PromptTemplate } from "../../constants/ai";
import { PATTERNS, PATTERN_BY_ID, type PatternId } from "../../constants/patterns";
import { isAIEnabled } from "../../config/env";
import { RenderedMarkdown } from "./RenderedMarkdown";
import { apiRequest } from "../../utils/api-client";

const STATUS_VALUES: EntryStatus[] = ["planned", "in_progress", "live", "done", "cancelled"];

const STATUS_DOT: Record<EntryStatus, string> = {
  planned: "bg-ink-3",
  in_progress: "bg-yellow",
  live: "bg-sage-deep",
  done: "bg-obsidian",
  cancelled: "bg-rose-deep",
};
const STATUS_LABEL: Record<EntryStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  live: "Live",
  done: "Done",
  cancelled: "Cancelled",
};

// Platform-aware soft limits. The DB allows much more — these are the
// numbers the marketer actually cares about.
const SOFT_LIMIT: Record<"script" | "caption" | "hashtags", number> = {
  script: 4000,
  caption: 2200,
  hashtags: 30,
};

type ContentField = "script" | "caption" | "hashtags";

interface Props {
  entryId: string | null;
  onClose: () => void;
}

export function EntryDetailPanel({ entryId, onClose }: Props): JSX.Element | null {
  const detail = useEntryDetail(entryId);
  const setAIContext = useAIStore((s) => s.setContext);
  const resetAIContext = useAIStore((s) => s.resetContextToFreeform);

  useEffect(() => {
    if (detail.data && entryId) {
      setAIContext({
        type: "entry",
        contextId: entryId,
        label: `Entry · ${detail.data.title}`,
        entryType: detail.data.type as EntryType,
        payload: {
          entry: {
            type: detail.data.type,
            title: detail.data.title,
            description: detail.data.description,
            targetDate: detail.data.targetDate,
            assignee: detail.data.assignee,
            notes: detail.data.notes,
          },
        },
      });
    }
    return () => resetAIContext();
  }, [entryId, detail.data, setAIContext, resetAIContext]);

  useEffect(() => {
    if (entryId === null) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entryId, onClose]);

  useEffect(() => {
    if (entryId === null) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [entryId]);

  if (entryId === null) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center px-4 sm:px-6 py-6 sm:py-10 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close entry"
        onClick={onClose}
        className="fixed inset-0 bg-obsidian/55 backdrop-blur-sm cursor-default"
      />

      <div
        className="relative w-full max-w-[920px] bg-paper rounded-xl border border-line shadow-2xl text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {detail.isLoading && (
          <div className="px-9 py-12 text-ink-3 text-[13px]">Loading…</div>
        )}
        {detail.isError && (
          <div className="m-5 rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-3 text-[13px]">
            {detail.error instanceof Error ? detail.error.message : "Failed to load entry."}
          </div>
        )}
        {detail.data && <Workspace entry={detail.data} onClose={onClose} />}
      </div>
    </div>
  );
}

// ─────────────────── Workspace (two-column layout) ───────────────────

function Workspace({
  entry,
  onClose,
}: {
  entry: EntryWithTasks;
  onClose: () => void;
}): JSX.Element {
  // Which content card is currently expanded. null = all collapsed.
  const [expanded, setExpanded] = useState<ContentField | null>(null);
  // When focus is on, the left rail hides and the expanded card takes the
  // whole width — distraction-free writing mode. Always paired with `expanded`.
  const [focused, setFocused] = useState(false);

  const toggleExpanded = (field: ContentField): void => {
    if (expanded === field) {
      setExpanded(null);
      setFocused(false);
    } else {
      setExpanded(field);
    }
  };

  const enterFocus = (field: ContentField): void => {
    setExpanded(field);
    setFocused(true);
  };
  const exitFocus = (): void => setFocused(false);

  return (
    <>
      <ModalHeader entry={entry} onClose={onClose} focused={focused} onExitFocus={exitFocus} />

      {focused ? (
        // Focus mode: only the expanded card, full width
        <div className="px-4 sm:px-9 py-4 sm:py-6">
          {expanded && (
            <ExpandedCardOnly
              entry={entry}
              field={expanded}
              onCollapse={() => {
                setFocused(false);
                setExpanded(null);
              }}
              onExitFocus={exitFocus}
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0">
          <LeftRail entry={entry} />
          <MainPane
            entry={entry}
            expanded={expanded}
            onToggle={toggleExpanded}
            onEnterFocus={enterFocus}
          />
        </div>
      )}
    </>
  );
}

// ─────────────────── Modal header ───────────────────

function ModalHeader({
  entry,
  onClose,
  focused,
  onExitFocus,
}: {
  entry: EntryWithTasks;
  onClose: () => void;
  focused: boolean;
  onExitFocus: () => void;
}): JSX.Element {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-5 py-3 bg-paper/95 backdrop-blur rounded-t-xl border-b border-line">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
          Entry
        </span>
        <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-cream-2 text-ink-2 truncate">
          {ENTRY_TYPE_LABELS[entry.type as EntryType] ?? entry.type}
        </span>
        {entry.patternId && (
          <span
            className="text-[10.5px] px-2 py-0.5 rounded-full bg-yellow text-obsidian font-bold tracking-wide flex-shrink-0"
            title={`Pattern: ${PATTERN_BY_ID[entry.patternId as PatternId]?.name ?? entry.patternId}`}
          >
            {entry.patternId}
          </span>
        )}
        {focused && (
          <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-yellow-bg text-ink-2">
            Focus mode
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {focused && (
          <button
            onClick={onExitFocus}
            className="iconbtn"
            title="Exit focus mode"
            aria-label="Exit focus mode"
          >
            <Minimize2 size={15} />
          </button>
        )}
        <HeaderMenu entry={entry} onAfterDelete={onClose} />
        <button onClick={onClose} aria-label="Close" className="iconbtn">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function HeaderMenu({
  entry,
  onAfterDelete,
}: {
  entry: EntryWithTasks;
  onAfterDelete: () => void;
}): JSX.Element {
  const deleteEntry = useDeleteEntry();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const onDelete = async (): Promise<void> => {
    setOpen(false);
    const ok = window.confirm("Delete this entry and all its tasks? This cannot be undone.");
    if (!ok) return;
    try {
      await deleteEntry.mutateAsync(entry.id);
      onAfterDelete();
    } catch (err) {
      logger.error("delete entry failed", { err: String(err) });
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="iconbtn"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-1 w-44 bg-paper border border-line rounded-md shadow-lg py-1 z-20"
        >
          <button
            role="menuitem"
            onClick={onDelete}
            disabled={deleteEntry.isPending}
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-rose-deep hover:bg-cream-2 disabled:opacity-50"
          >
            <Trash2 size={13} />
            {deleteEntry.isPending ? "Deleting…" : "Delete entry"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────── Left rail (always visible) ───────────────────

function LeftRail({ entry }: { entry: EntryWithTasks }): JSX.Element {
  const isShopActivity = entry.type === ENTRY_TYPES.SHOP_ACTIVITY;
  const isBatchableType =
    entry.type === ENTRY_TYPES.TIKTOK_VIDEO ||
    entry.type === ENTRY_TYPES.INSTAGRAM_REEL;
  const branchLabel = entry.branch
    ? `${entry.branch.name}, ${entry.branch.city}`
    : null;

  return (
    <div className="border-b md:border-b-0 md:border-r border-line px-4 sm:px-5 py-5 sm:py-6 space-y-5 md:max-h-[calc(100vh-160px)] md:overflow-y-auto canvas-scroll">
      <Title entryId={entry.id} initial={entry.title} />

      <div className="space-y-0.5">
        <RailRow icon={<Calendar size={13} />} label="Live date">
          <DateProperty entryId={entry.id} initial={entry.targetDate} />
        </RailRow>
        <RailRow icon={<User size={13} />} label="Assignee">
          <AssigneeProperty entryId={entry.id} initial={entry.assignee} />
        </RailRow>
        <RailRow icon={<Tag size={13} />} label="Type">
          <span className="text-[12.5px] text-ink">
            {ENTRY_TYPE_LABELS[entry.type as EntryType] ?? entry.type}
          </span>
        </RailRow>
        <RailRow icon={<Sparkles size={13} />} label="Pattern">
          <PatternProperty entryId={entry.id} initial={entry.patternId} />
        </RailRow>
        <RailRow icon={<FileText size={13} />} label="Theme">
          <ThemeProperty entryId={entry.id} initial={entry.theme} />
        </RailRow>
        <RailRow icon={<Circle size={13} />} label="Status">
          <StatusProperty entryId={entry.id} initial={entry.status} />
        </RailRow>
        {isShopActivity && (
          <RailRow icon={<MapPin size={13} />} label="Branch">
            <BranchProperty
              entryId={entry.id}
              initial={entry.branchId}
              currentLabel={branchLabel}
            />
          </RailRow>
        )}
        {isBatchableType && (
          <>
            <RailRow icon={<Clapperboard size={13} />} label="Mode">
              <ProductionModeProperty
                entryId={entry.id}
                initial={entry.productionMode}
              />
            </RailRow>
            {entry.productionMode === "batch" && (
              <RailRow icon={<Calendar size={13} />} label="Shoot day">
                <ShootDateProperty
                  entryId={entry.id}
                  initial={entry.shootDate}
                />
              </RailRow>
            )}
            {entry.productionMode === "batch" && (
              <RailRow icon={<Scissors size={13} />} label="Edit days">
                <EditorOffsetProperty
                  entryId={entry.id}
                  initial={entry.editorDaysOffset}
                />
              </RailRow>
            )}
          </>
        )}
      </div>

      <div className="border-t border-line pt-4">
        <TasksList entry={entry} />
      </div>

      <div className="border-t border-line pt-4 space-y-1">
        <UrlField
          entryId={entry.id}
          fieldName="videoUrl"
          initial={entry.videoUrl}
          placeholder="No video URL"
          icon={<Link2 size={12} />}
          ariaLabel="Video URL"
        />
        <UrlField
          entryId={entry.id}
          fieldName="postUrl"
          initial={entry.postUrl}
          placeholder="No post URL"
          icon={<Link2 size={12} />}
          ariaLabel="Post URL"
        />
      </div>
    </div>
  );
}

function RailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2 min-h-[28px] -mx-1.5 px-1.5 rounded-sm hover:bg-cream-2/50 transition-colors">
      <div className="flex items-center gap-1.5 w-[88px] shrink-0 text-ink-3">
        <span className="opacity-70">{icon}</span>
        <span className="text-[11.5px]">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─────────────────── Main pane (brief + content) ───────────────────

function MainPane({
  entry,
  expanded,
  onToggle,
  onEnterFocus,
}: {
  entry: EntryWithTasks;
  expanded: ContentField | null;
  onToggle: (f: ContentField) => void;
  onEnterFocus: (f: ContentField) => void;
}): JSX.Element {
  return (
    <div className="px-4 sm:px-7 py-5 sm:py-6 md:max-h-[calc(100vh-160px)] md:overflow-y-auto canvas-scroll">
      {/* Brief — short prose blocks, no harsh labels */}
      <Brief entry={entry} />

      {needsContentAuthoring(entry.type) && (
        <div className="mt-6 pt-5 border-t border-line">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles size={11} className="text-ink-3" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              Content
            </span>
          </div>
          <div className="space-y-1.5">
            {showsScriptField(entry.type) && (
              <ContentCard
                entry={entry}
                field="script"
                isExpanded={expanded === "script"}
                onToggle={() => onToggle("script")}
                onEnterFocus={() => onEnterFocus("script")}
              />
            )}
            {showsCaptionField(entry.type) && (
              <ContentCard
                entry={entry}
                field="caption"
                isExpanded={expanded === "caption"}
                onToggle={() => onToggle("caption")}
                onEnterFocus={() => onEnterFocus("caption")}
              />
            )}
            {showsHashtagsField(entry.type) && (
              <ContentCard
                entry={entry}
                field="hashtags"
                isExpanded={expanded === "hashtags"}
                onToggle={() => onToggle("hashtags")}
                onEnterFocus={() => onEnterFocus("hashtags")}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Brief({ entry }: { entry: EntryWithTasks }): JSX.Element {
  return (
    <div>
      <ProseField
        entryId={entry.id}
        fieldName="description"
        initial={entry.description}
        placeholder="What's this entry about?"
        rows={2}
        size="lg"
      />
      <div className="border-t border-line/60 my-2" />
      <ProseField
        entryId={entry.id}
        fieldName="notes"
        initial={entry.notes}
        placeholder="Notes — references, reminders, callouts…"
        rows={2}
        size="sm"
      />
    </div>
  );
}

// ─────────────────── Title (inline edit) ───────────────────

function Title({
  entryId,
  initial,
}: {
  entryId: string;
  initial: string;
}): JSX.Element {
  const updateEntry = useUpdateEntry();
  const [value, setValue] = useState(initial);
  const lastSavedRef = useRef(initial);

  useEffect(() => {
    setValue(initial);
    lastSavedRef.current = initial;
  }, [initial]);

  const save = async (): Promise<void> => {
    const next = value.trim();
    if (next.length < 3 || next === lastSavedRef.current) return;
    try {
      await updateEntry.mutateAsync({ id: entryId, input: { title: next } });
      lastSavedRef.current = next;
    } catch (err) {
      logger.error("save title failed", { err: String(err) });
    }
  };

  return (
    <input
      value={value}
      dir="auto"
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="Untitled"
      className="w-full bg-transparent border-none outline-none font-serif text-[20px] leading-[1.2] tracking-tight text-ink placeholder:text-ink-3/60 focus:ring-0"
      maxLength={200}
    />
  );
}

// ─────────────────── Property editors ───────────────────

function DateProperty({
  entryId,
  initial,
}: {
  entryId: string;
  initial: string;
}): JSX.Element {
  const updateEntry = useUpdateEntry();
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const onChange = async (next: string): Promise<void> => {
    setValue(next);
    if (next === initial) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    try {
      await updateEntry.mutateAsync({ id: entryId, input: { targetDate: next } });
    } catch (err) {
      logger.error("save date failed", { err: String(err) });
    }
  };

  const friendly = (() => {
    if (!value) return "Pick a date";
    const d = parseISO(value);
    return isValid(d) ? format(d, "MMM d, yyyy") : value;
  })();

  return (
    <label className="relative inline-flex items-center cursor-pointer text-[12.5px] text-ink hover:bg-cream-2/60 rounded-sm px-1.5 -ml-1.5 py-0.5">
      <span>{friendly}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </label>
  );
}

function AssigneeProperty({
  entryId,
  initial,
}: {
  entryId: string;
  initial: Assignee;
}): JSX.Element {
  const updateEntry = useUpdateEntry();
  const [value, setValue] = useState<Assignee>(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const onChange = async (next: Assignee): Promise<void> => {
    setValue(next);
    if (next === initial) return;
    try {
      await updateEntry.mutateAsync({ id: entryId, input: { assignee: next } });
    } catch (err) {
      logger.error("save assignee failed", { err: String(err) });
    }
  };

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Assignee)}
      className="bg-transparent border-none text-[12.5px] text-ink hover:bg-cream-2/60 rounded-sm px-1.5 -ml-1.5 py-0.5 cursor-pointer focus:ring-0 focus:outline-none w-full"
    >
      {ASSIGNEE_VALUES.map((a) => (
        <option key={a} value={a}>
          {ASSIGNEE_LABELS[a]}
        </option>
      ))}
    </select>
  );
}

function StatusProperty({
  entryId,
  initial,
}: {
  entryId: string;
  initial: EntryStatus;
}): JSX.Element {
  const updateEntry = useUpdateEntry();
  const [value, setValue] = useState<EntryStatus>(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const onChange = async (next: EntryStatus): Promise<void> => {
    setValue(next);
    if (next === initial) return;
    try {
      await updateEntry.mutateAsync({ id: entryId, input: { status: next } });
    } catch (err) {
      logger.error("save status failed", { err: String(err) });
    }
  };

  return (
    <div className="relative inline-flex items-center gap-2 hover:bg-cream-2/60 rounded-sm px-1.5 -ml-1.5 py-0.5 cursor-pointer">
      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[value]}`} />
      <span className="text-[12.5px] text-ink">{STATUS_LABEL[value]}</span>
      <ChevronDown size={10} className="text-ink-3" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as EntryStatus)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        {STATUS_VALUES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

function ProductionModeProperty({
  entryId,
  initial,
}: {
  entryId: string;
  initial: ProductionMode;
}): JSX.Element {
  const updateEntry = useUpdateEntry();
  const [value, setValue] = useState<ProductionMode>(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const onChange = async (next: ProductionMode): Promise<void> => {
    setValue(next);
    if (next === initial) return;
    try {
      await updateEntry.mutateAsync({
        id: entryId,
        input: { productionMode: next },
      });
    } catch (err) {
      logger.error("save production mode failed", { err: String(err) });
    }
  };

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ProductionMode)}
      className="bg-transparent border-none text-[12.5px] text-ink hover:bg-cream-2/60 rounded-sm px-1.5 -ml-1.5 py-0.5 cursor-pointer focus:ring-0 focus:outline-none"
    >
      <option value="batch">Batch shoot</option>
      <option value="adhoc">Quick post</option>
    </select>
  );
}

function ShootDateProperty({
  entryId,
  initial,
}: {
  entryId: string;
  initial: string | null;
}): JSX.Element {
  const updateEntry = useUpdateEntry();
  const [value, setValue] = useState(initial ?? "");

  useEffect(() => {
    setValue(initial ?? "");
  }, [initial]);

  const onChange = async (next: string): Promise<void> => {
    setValue(next);
    if (next === (initial ?? "")) return;
    if (next && !/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    try {
      await updateEntry.mutateAsync({
        id: entryId,
        input: { shootDate: next || null },
      });
    } catch (err) {
      logger.error("save shoot date failed", { err: String(err) });
    }
  };

  const friendly = (() => {
    if (!value) return "Not set";
    const d = parseISO(value);
    return isValid(d) ? format(d, "MMM d, yyyy") : value;
  })();

  return (
    <label className="relative inline-flex items-center cursor-pointer text-[12.5px] text-ink hover:bg-cream-2/60 rounded-sm px-1.5 -ml-1.5 py-0.5">
      <span className={value ? "" : "text-ink-3 italic"}>{friendly}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </label>
  );
}

function EditorOffsetProperty({
  entryId,
  initial,
}: {
  entryId: string;
  initial: number;
}): JSX.Element {
  const updateEntry = useUpdateEntry();
  const [value, setValue] = useState(String(initial));

  useEffect(() => {
    setValue(String(initial));
  }, [initial]);

  const save = async (): Promise<void> => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 30) {
      setValue(String(initial));
      return;
    }
    if (parsed === initial) return;
    try {
      await updateEntry.mutateAsync({
        id: entryId,
        input: { editorDaysOffset: parsed },
      });
    } catch (err) {
      logger.error("save editor offset failed", { err: String(err) });
    }
  };

  return (
    <input
      type="number"
      min={0}
      max={30}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      className="w-12 bg-transparent border-none text-[12.5px] text-ink hover:bg-cream-2/60 rounded-sm px-1.5 -ml-1.5 py-0.5 focus:ring-0 focus:outline-none"
    />
  );
}

function PatternProperty({
  entryId,
  initial,
}: {
  entryId: string;
  initial: PatternId | null;
}): JSX.Element {
  const updateEntry = useUpdateEntry();
  // Local copy so the select reflects the pending value while the PATCH is
  // in flight (avoids a flash back to the old value).
  const [value, setValue] = useState<PatternId | "">(initial ?? "");

  useEffect(() => {
    setValue(initial ?? "");
  }, [initial]);

  const onChange = async (next: PatternId | ""): Promise<void> => {
    setValue(next);
    if ((next || null) === initial) return;
    try {
      await updateEntry.mutateAsync({
        id: entryId,
        // Empty string from "None" maps to null on the wire — clears the field.
        input: { patternId: next === "" ? null : next },
      });
    } catch (err) {
      logger.error("save pattern failed", { err: String(err) });
    }
  };

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PatternId | "")}
      className="bg-transparent border-none text-[12.5px] text-ink hover:bg-cream-2/60 rounded-sm px-1.5 -ml-1.5 py-0.5 cursor-pointer focus:ring-0 focus:outline-none max-w-full"
    >
      <option value="">None</option>
      {PATTERNS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.id} — {p.name}
        </option>
      ))}
    </select>
  );
}

function ThemeProperty({
  entryId,
  initial,
}: {
  entryId: string;
  initial: string | null;
}): JSX.Element {
  const updateEntry = useUpdateEntry();
  const [value, setValue] = useState(initial ?? "");
  const lastSavedRef = useRef(initial ?? "");

  useEffect(() => {
    setValue(initial ?? "");
    lastSavedRef.current = initial ?? "";
  }, [initial]);

  const save = async (): Promise<void> => {
    const next = value.trim();
    if (next === lastSavedRef.current) return;
    try {
      await updateEntry.mutateAsync({
        id: entryId,
        // Empty string clears the field; non-empty saves the trimmed value.
        input: { theme: next.length === 0 ? null : next },
      });
      lastSavedRef.current = next;
    } catch (err) {
      logger.error("save theme failed", { err: String(err) });
    }
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="e.g., Japanese cake new flavors"
      maxLength={200}
      className="w-full bg-transparent border-none text-[12.5px] text-ink placeholder:text-ink-3/70 placeholder:italic hover:bg-cream-2/60 rounded-sm px-1.5 -ml-1.5 py-0.5 focus:ring-0 focus:outline-none"
    />
  );
}

function BranchProperty({
  entryId,
  initial,
  currentLabel,
}: {
  entryId: string;
  initial: string | null;
  currentLabel: string | null;
}): JSX.Element {
  const updateEntry = useUpdateEntry();
  const { brandId } = useCurrentBrand();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? "");

  useEffect(() => {
    setValue(initial ?? "");
  }, [initial]);

  const onChange = async (next: string): Promise<void> => {
    setValue(next);
    try {
      await updateEntry.mutateAsync({
        id: entryId,
        input: { branchId: next || null },
      });
      setEditing(false);
    } catch (err) {
      logger.error("save branch failed", { err: String(err) });
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-[12.5px] text-ink hover:bg-cream-2/60 rounded-sm px-1.5 -ml-1.5 py-0.5 text-left w-full truncate"
      >
        {currentLabel ?? <span className="text-ink-3 italic">Select branch…</span>}
      </button>
    );
  }

  return (
    <BranchSelector
      brandId={brandId}
      value={value}
      onChange={onChange}
      onBlur={() => setEditing(false)}
      ariaLabel="Branch"
    />
  );
}

// ─────────────────── Prose body fields (description, notes) ───────────────────

function ProseField({
  entryId,
  fieldName,
  initial,
  placeholder,
  rows,
  size,
}: {
  entryId: string;
  fieldName: "description" | "notes";
  initial: string | null;
  placeholder: string;
  rows: number;
  size: "lg" | "sm";
}): JSX.Element {
  const updateEntry = useUpdateEntry();
  const [value, setValue] = useState(initial ?? "");
  const lastSavedRef = useRef(initial ?? "");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setValue(initial ?? "");
    lastSavedRef.current = initial ?? "";
  }, [initial]);

  const save = async (): Promise<void> => {
    const trimmed = value.trim();
    if (value === lastSavedRef.current) return;
    try {
      await updateEntry.mutateAsync({
        id: entryId,
        input: { [fieldName]: trimmed.length === 0 ? null : value },
      });
      lastSavedRef.current = value;
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1200);
    } catch (err) {
      logger.error("save prose field failed", { err: String(err), field: fieldName });
    }
  };

  // Description gets larger, more confident type. Notes is the secondary
  // line — smaller, slightly muted — so the visual hierarchy alone tells
  // the marketer which field is which without explicit labels.
  const sizeCls =
    size === "lg"
      ? "text-[14px] leading-relaxed text-ink"
      : "text-[12.5px] leading-relaxed text-ink-2";

  return (
    <div className="relative group py-1">
      <textarea
        value={value}
        dir="auto"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        rows={rows}
        placeholder={placeholder}
        className={`w-full bg-transparent border-none outline-none placeholder:text-ink-3/70 placeholder:italic resize-none focus:ring-0 px-0 ${sizeCls}`}
      />
      {savedFlash && (
        <span className="absolute top-1 right-0 flex items-center gap-1 text-[10px] text-sage-deep opacity-90 pointer-events-none">
          <CheckIcon size={9} />
          Saved
        </span>
      )}
    </div>
  );
}

// ─────────────────── Content cards (collapsible + language tabs + focus) ───────────────────

interface ContentCardProps {
  entry: EntryWithTasks;
  field: ContentField;
  isExpanded: boolean;
  onToggle: () => void;
  onEnterFocus: () => void;
}

function ContentCard({
  entry,
  field,
  isExpanded,
  onToggle,
  onEnterFocus,
}: ContentCardProps): JSX.Element {
  const meta = META_FOR_FIELD[field];
  const value =
    field === "script"
      ? (entry.script ?? "")
      : field === "caption"
        ? (entry.caption ?? "")
        : (entry.hashtags ?? "");
  const count = field === "hashtags" ? (value.match(/#[^\s#]+/g) ?? []).length : value.length;
  const ratio = count / SOFT_LIMIT[field];
  const overLimit = count > SOFT_LIMIT[field];
  const nearLimit = ratio > 0.8 && !overLimit;
  const counterColor = overLimit
    ? "text-rose-deep"
    : nearLimit
      ? "text-yellow-bg-deep"
      : "text-ink-3";
  const hasContent = value.trim().length > 0;

  // Status dot tells the whole "has content / over limit / empty" story
  // in a single 8px pixel — no need for a separate "has content" pill.
  const dotClass = !hasContent
    ? "bg-transparent border border-ink-3/50"
    : overLimit
      ? "bg-rose-deep"
      : nearLimit
        ? "bg-yellow"
        : "bg-sage-deep";
  const dotTitle = !hasContent
    ? "Empty"
    : overLimit
      ? "Over limit"
      : nearLimit
        ? "Near limit"
        : "Filled";

  return (
    <div
      className={`rounded-md bg-paper border transition-all ${
        isExpanded
          ? "border-ink-3 shadow-sm"
          : "border-line hover:border-ink-3/50"
      }`}
    >
      {/* Summary header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-ink-2 flex-shrink-0">{meta.icon}</span>
          <span className="text-[13px] font-semibold text-ink">{meta.label}</span>
          <span className={`text-[11.5px] tabular-nums ${counterColor}`}>
            {count.toLocaleString()} / {SOFT_LIMIT[field].toLocaleString()}
            {field === "hashtags" ? " tags" : ""}
          </span>
          {overLimit && (
            <span
              className="flex items-center gap-1 text-[10.5px] text-rose-deep"
              title={meta.limitHint}
            >
              <AlertCircle size={10} />
              Over limit
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${dotClass}`}
            title={dotTitle}
            aria-label={dotTitle}
          />
          <span className="text-ink-3">
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </div>
      </button>

      {isExpanded && (
        <ExpandedCardBody
          entry={entry}
          field={field}
          value={value}
          onEnterFocus={onEnterFocus}
        />
      )}
    </div>
  );
}

// buildPrompt now takes the full entry so the script field can produce a
// pattern-aware brief. caption/hashtags don't currently differentiate, but
// they receive the entry for symmetry — the system prompt does the heavy
// lifting; the user message is just the brief.
const META_FOR_FIELD: Record<
  ContentField,
  {
    label: string;
    icon: ReactNode;
    placeholder: string;
    rows: number;
    template: PromptTemplate;
    buildPrompt: (entry: EntryWithTasks) => string;
    limitHint: string;
    supportsLangTabs: boolean;
  }
> = {
  script: {
    label: "Script",
    icon: <FileText size={14} />,
    placeholder: "Hook, body, CTA. Add shot directions in [brackets].",
    rows: 8,
    template: PROMPT_TEMPLATES.GENERATE_SCRIPT,
    buildPrompt: (entry) => {
      // Pattern-aware brief: when a pattern is set on the entry, name the
      // pattern in the brief so the LLM (which already has the pattern
      // structure in BRAND DNA + the script-brief block) anchors fast.
      // Without a pattern, fall back to the generic prompt.
      if (entry.patternId) {
        const patternName = PATTERN_BY_ID[entry.patternId as PatternId]?.name ?? entry.patternId;
        const themeBit = entry.theme ? ` Focus on ${entry.theme}.` : "";
        const branchBit = entry.branch?.name ? ` Feature ${entry.branch.name} in the CTA.` : "";
        return `Generate a ${patternName} script for: "${entry.title}".${themeBit}${branchBit}`;
      }
      return `Generate a full TikTok-style script for this entry: "${entry.title}". Include hook, body, CTA, with shot directions.`;
    },
    limitHint: "Most TikTok scripts work best under 4,000 chars.",
    supportsLangTabs: true,
  },
  caption: {
    label: "Caption",
    icon: <MessageSquare size={14} />,
    placeholder: "The publishing caption — bilingual (Arabic + English) reads best.",
    rows: 4,
    template: PROMPT_TEMPLATES.CAPTION_HASHTAGS,
    buildPrompt: (entry) =>
      `Write a publishing caption and hashtag set for this entry: "${entry.title}".`,
    limitHint: "Instagram truncates captions over 1,500 chars in feed.",
    supportsLangTabs: true,
  },
  hashtags: {
    label: "Hashtags",
    icon: <Hash size={14} />,
    placeholder: "#KayanSweets #حلويات_كيان",
    rows: 2,
    template: PROMPT_TEMPLATES.CAPTION_HASHTAGS,
    buildPrompt: (entry) =>
      `Write a hashtag set (and caption if helpful) for this entry: "${entry.title}".`,
    limitHint: "Instagram allows up to 30 hashtags per post.",
    supportsLangTabs: false,
  },
};

// ─────────────────── Expanded card body ───────────────────

type LangTab = "both" | "arabic" | "english";

interface ExpandedBodyProps {
  entry: EntryWithTasks;
  field: ContentField;
  value: string;
  onEnterFocus: () => void;
}

function ExpandedCardBody({
  entry,
  field,
  value,
  onEnterFocus,
}: ExpandedBodyProps): JSX.Element {
  const meta = META_FOR_FIELD[field];
  const updateEntry = useUpdateEntry();

  // Local working copy — committed back via onBlur. Resyncs if the entry
  // value changes underneath us (e.g. AI panel saved into the field).
  const [draft, setDraft] = useState(value);
  const lastSavedRef = useRef(value);
  const [editing, setEditing] = useState(value.trim().length === 0);
  const [savedFlash, setSavedFlash] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lang, setLang] = useState<LangTab>("both");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(value);
    lastSavedRef.current = value;
    setEditing(value.trim().length === 0);
  }, [value]);

  const save = async (): Promise<void> => {
    if (draft === lastSavedRef.current) {
      if (draft.trim().length > 0) setEditing(false);
      return;
    }
    const trimmed = draft.trim();
    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        input: { [field]: trimmed.length === 0 ? null : draft },
      });
      lastSavedRef.current = draft;
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1200);
    } catch (err) {
      logger.error("entry content save failed", {
        entryId: entry.id,
        field,
        err: String(err),
      });
    }
    if (draft.trim().length > 0) setEditing(false);
  };

  const onCopy = async (): Promise<void> => {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      logger.warn("clipboard write failed", { err: String(err) });
    }
  };

  const onGenerate = async (): Promise<void> => {
    if (generating) return;
    if (draft.trim().length > 0) {
      const ok = window.confirm(
        `Replace the current ${meta.label.toLowerCase()} with AI-generated text?`,
      );
      if (!ok) return;
    }
    setGenerateError(null);
    setGenerating(true);
    try {
      // Build the per-call entryContext sent alongside the user message.
      // Each field is optional — undefined ones are dropped from the body so
      // the backend Zod schema (.strict()) doesn't reject them. The backend
      // omits any line whose source field is missing.
      // Note: `occasion` will come from the entry in Chunk 4 (not on the
      // entry yet), so we leave it undefined.
      const entryContext = {
        patternId: entry.patternId ?? undefined,
        branchName: entry.branch?.name ?? undefined,
        theme: entry.theme ?? undefined,
        entryType: entry.type,
      };

      const result = await apiRequest<{
        conversationId: string;
        assistantMessage: string;
      }>("/ai-assistant", {
        method: "POST",
        body: {
          conversationId: null,
          contextType: "entry",
          contextId: entry.id,
          promptTemplate: meta.template,
          userMessage: meta.buildPrompt(entry),
          entryContext,
        },
      });
      if (!result.success) throw new Error(result.error.message);
      const generated = result.data.assistantMessage;
      // Optimistic local update + persist
      setDraft(generated);
      lastSavedRef.current = generated;
      setEditing(false);
      await updateEntry.mutateAsync({
        id: entry.id,
        input: { [field]: generated },
      });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setGenerateError(message);
      logger.error("inline generation failed", { err: String(err), field });
    } finally {
      setGenerating(false);
    }
  };

  // For Script + Caption: try to split into Arabic / English sections from
  // the `**Arabic**` / `**English**` markers our system prompt produces. If
  // markers aren't present, fall back to "Both".
  const split = meta.supportsLangTabs ? splitByLanguage(draft) : null;
  const showLangTabs = !!split && (split.arabic || split.english);

  // Decide what text to render in preview for the active tab.
  const renderedText = (() => {
    if (!showLangTabs || !split) return draft;
    if (lang === "arabic") return split.arabic || draft;
    if (lang === "english") return split.english || draft;
    return draft;
  })();

  const enterEditMode = (): void => {
    setEditing(true);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <div className="px-3.5 pb-3.5 space-y-2.5">
      {/* Action row inside expanded body — wraps on narrow widths */}
      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {showLangTabs && (
            <div className="flex items-center bg-paper border border-line rounded-full p-0.5">
              {(
                [
                  { key: "both" as const, label: "Both" },
                  { key: "arabic" as const, label: "AR" },
                  { key: "english" as const, label: "EN" },
                ]
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setLang(t.key)}
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition ${
                    lang === t.key
                      ? "bg-obsidian text-yellow"
                      : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {savedFlash && (
            <span className="flex items-center gap-1 text-[11px] text-sage-deep">
              <CheckIcon size={10} />
              Saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onCopy}
            disabled={!draft.trim()}
            className="flex items-center gap-1 text-[11px] text-ink-3 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed px-1.5 py-1"
            aria-label={copied ? "Copied" : "Copy"}
          >
            <Copy size={11} />
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </button>
          {isAIEnabled && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-obsidian text-yellow text-[11px] font-semibold hover:brightness-110 disabled:opacity-60 disabled:cursor-wait"
              title="Generate with AI"
            >
              <Sparkles size={11} className={generating ? "animate-pulse" : ""} />
              {generating ? "Generating…" : "Generate"}
            </button>
          )}
          <button
            type="button"
            onClick={onEnterFocus}
            className="grid place-items-center w-7 h-7 rounded-full text-ink-2 hover:bg-cream-2 hover:text-ink transition"
            title="Focus mode"
            aria-label="Focus mode"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Body — preview or raw textarea */}
      {editing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          dir="auto"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          rows={meta.rows}
          placeholder={meta.placeholder}
          className="w-full bg-paper border border-line rounded-md p-2.5 sm:p-3 text-[16px] sm:text-[13px] leading-relaxed text-ink placeholder:text-ink-3/70 placeholder:italic resize-y focus:ring-2 focus:ring-yellow focus:outline-none min-h-[140px] sm:min-h-0"
        />
      ) : (
        <button
          onClick={enterEditMode}
          className="text-left w-full bg-paper border border-line rounded-md p-2.5 sm:p-3 hover:border-ink-3 transition-colors"
          title="Click to edit"
        >
          {draft.trim().length > 0 ? (
            <RenderedMarkdown text={renderedText} />
          ) : (
            <div className="text-[13px] text-ink-3 italic">{meta.placeholder}</div>
          )}
        </button>
      )}

      {(nearLimit(draft, field) || overLimit(draft, field)) && (
        <div className="text-[11px] text-ink-3 italic">{meta.limitHint}</div>
      )}

      {generateError && (
        <div className="text-[11.5px] text-rose-deep bg-rose/30 border border-rose-deep/30 rounded-md px-2.5 py-1.5">
          Generation failed: {generateError}
        </div>
      )}
    </div>
  );
}

// Helper: same nearLimit / overLimit math used by the summary header
function nearLimit(text: string, field: ContentField): boolean {
  const count = field === "hashtags" ? (text.match(/#[^\s#]+/g) ?? []).length : text.length;
  const ratio = count / SOFT_LIMIT[field];
  return ratio > 0.8 && count <= SOFT_LIMIT[field];
}
function overLimit(text: string, field: ContentField): boolean {
  const count = field === "hashtags" ? (text.match(/#[^\s#]+/g) ?? []).length : text.length;
  return count > SOFT_LIMIT[field];
}

// Split a piece of AI-generated content into Arabic / English sections.
// Our system prompt produces sub-headings `**Arabic**` and `**English**`; we
// look for those markers and grab everything in between. Returns empty
// strings when a marker isn't present so the UI can fall back to "Both".
function splitByLanguage(text: string): { arabic: string; english: string } {
  // Use a non-greedy match for Arabic block, terminated by **English** or end.
  const arRe = /\*\*\s*arabic\s*\*\*\s*([\s\S]*?)(?=\*\*\s*english\s*\*\*|$)/i;
  const enRe = /\*\*\s*english\s*\*\*\s*([\s\S]*)$/i;
  const arabic = (text.match(arRe)?.[1] ?? "").trim();
  const english = (text.match(enRe)?.[1] ?? "").trim();
  return { arabic, english };
}

// ─────────────────── Focus mode (single card, full width) ───────────────────

function ExpandedCardOnly({
  entry,
  field,
  onCollapse,
  onExitFocus,
}: {
  entry: EntryWithTasks;
  field: ContentField;
  onCollapse: () => void;
  onExitFocus: () => void;
}): JSX.Element {
  const meta = META_FOR_FIELD[field];
  const value =
    field === "script"
      ? (entry.script ?? "")
      : field === "caption"
        ? (entry.caption ?? "")
        : (entry.hashtags ?? "");

  return (
    <div className="rounded-md bg-cream-2/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line/60">
        <div className="flex items-center gap-2">
          <span className="text-ink-2">{meta.icon}</span>
          <span className="text-[14px] font-semibold text-ink">{meta.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onExitFocus} className="iconbtn" title="Exit focus mode">
            <Minimize2 size={14} />
          </button>
          <button onClick={onCollapse} className="iconbtn" title="Collapse">
            <ChevronUp size={14} />
          </button>
        </div>
      </div>
      <ExpandedCardBody
        entry={entry}
        field={field}
        value={value}
        onEnterFocus={() => {}}
      />
    </div>
  );
}

// ─────────────────── Tasks list ───────────────────

function TasksList({ entry }: { entry: EntryWithTasks }): JSX.Element {
  const completedCount = entry.tasks.filter((t) => t.status === "completed").length;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-ink">
          <CheckSquare size={13} className="text-ink-2" />
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-3">
            Tasks
          </span>
        </div>
        <span className="text-[11px] text-ink-3">
          {completedCount}/{entry.tasks.length}
        </span>
      </div>
      {entry.tasks.length === 0 ? (
        <p className="text-[12px] text-ink-3 italic">No tasks linked.</p>
      ) : (
        <ul className="space-y-0.5">
          {entry.tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: Task }): JSX.Element {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [pending, setPending] = useState(false);

  const cycleStatus = async (): Promise<void> => {
    const next: Record<TaskStatus, TaskStatus> = {
      pending: "in_progress",
      in_progress: "completed",
      completed: "pending",
    };
    setPending(true);
    try {
      await updateTask.mutateAsync({ id: task.id, input: { status: next[task.status] } });
    } catch (err) {
      logger.error("update task status failed", { err: String(err) });
    } finally {
      setPending(false);
    }
  };

  const onDelete = async (): Promise<void> => {
    const ok = window.confirm("Delete this task?");
    if (!ok) return;
    setPending(true);
    try {
      await deleteTask.mutateAsync(task.id);
    } finally {
      setPending(false);
    }
  };

  const checkboxClass =
    task.status === "completed"
      ? "bg-obsidian border-obsidian"
      : task.status === "in_progress"
        ? "bg-yellow border-yellow"
        : "bg-transparent border-ink-3";

  return (
    <li className="group flex items-start gap-2 py-1 -mx-1 px-1 rounded-sm hover:bg-cream-2/50">
      <button
        onClick={cycleStatus}
        disabled={pending}
        aria-label={`Cycle status — currently ${task.status}`}
        className={`flex-shrink-0 w-3.5 h-3.5 rounded-sm border-[1.5px] transition mt-0.5 ${checkboxClass} disabled:opacity-50`}
      >
        {task.status === "completed" && (
          <CheckIcon size={9} className="text-yellow mx-auto" strokeWidth={3} />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className={`text-[12px] leading-tight ${
            task.status === "completed" ? "text-ink-3 line-through" : "text-ink"
          }`}
        >
          {task.title}
        </div>
        <div className="text-[10.5px] text-ink-3 mt-0.5">
          {task.dueDate} · {ASSIGNEE_LABELS[task.assignee] ?? task.assignee}
        </div>
      </div>
      <button
        onClick={onDelete}
        disabled={pending}
        aria-label="Delete task"
        className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-rose-deep disabled:opacity-50 transition-opacity flex-shrink-0"
      >
        <Trash2 size={11} />
      </button>
    </li>
  );
}

// ─────────────────── URL field (compact, in left rail) ───────────────────

function UrlField({
  entryId,
  fieldName,
  initial,
  placeholder,
  icon,
  ariaLabel,
}: {
  entryId: string;
  fieldName: "videoUrl" | "postUrl";
  initial: string | null;
  placeholder: string;
  icon: ReactNode;
  ariaLabel: string;
}): JSX.Element {
  const updateEntry = useUpdateEntry();
  const [value, setValue] = useState(initial ?? "");
  const lastSavedRef = useRef(initial ?? "");

  useEffect(() => {
    setValue(initial ?? "");
    lastSavedRef.current = initial ?? "";
  }, [initial]);

  const save = async (): Promise<void> => {
    const trimmed = value.trim();
    if (value === lastSavedRef.current) return;
    if (trimmed.length > 0) {
      try {
        new URL(trimmed);
      } catch {
        return;
      }
    }
    try {
      await updateEntry.mutateAsync({
        id: entryId,
        input: { [fieldName]: trimmed.length === 0 ? null : trimmed },
      });
      lastSavedRef.current = value;
    } catch (err) {
      logger.error("save url failed", { err: String(err), field: fieldName });
    }
  };

  return (
    <div className="flex items-center gap-1.5 -mx-1.5 px-1.5 py-0.5 rounded-sm hover:bg-cream-2/50">
      <span className="text-ink-3 flex-shrink-0">{icon}</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="flex-1 min-w-0 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-3/70 placeholder:italic focus:ring-0"
      />
    </div>
  );
}
