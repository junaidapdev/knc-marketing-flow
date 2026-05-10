import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, Copy, RotateCcw, Send, Check } from "lucide-react";
import { useAIStore } from "../../stores/ai-store";
import { useAIChat } from "./use-ai";
import { useUpdateEntry } from "../calendar/hooks/use-calendar-entries";
import { getAvailablePrompts } from "./get-available-prompts";
import {
  PROMPT_TEMPLATES,
  PROMPT_TEMPLATE_LABELS,
  PROMPT_TEMPLATE_PLACEHOLDERS,
} from "../../constants/ai";
import { parseAIResponse, hasParsedSections, type ParsedAISections } from "./parse-ai-response";
import { logger } from "../../utils/logger";

export function AIPanel(): JSX.Element | null {
  const location = useLocation();
  const isOpen = useAIStore((s) => s.isOpen);
  const close = useAIStore((s) => s.close);
  const context = useAIStore((s) => s.context);
  const template = useAIStore((s) => s.template);
  const setTemplate = useAIStore((s) => s.setTemplate);
  const resetContextToFreeform = useAIStore((s) => s.resetContextToFreeform);
  const consumePendingAutoPrompt = useAIStore((s) => s.consumePendingAutoPrompt);

  const { messages, send, isPending, error, resetConversation } = useAIChat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const availablePrompts = useMemo(
    () => getAvailablePrompts(location.pathname, context),
    [location.pathname, context],
  );

  useEffect(() => {
    if (!availablePrompts.includes(template)) {
      setTemplate(availablePrompts[0] ?? PROMPT_TEMPLATES.FREEFORM);
    }
  }, [availablePrompts, template, setTemplate]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isPending]);

  // When the panel is opened by an inline ✨ Generate click, the store carries
  // a pre-built prompt. Consume + send it once on open so the marketer sees
  // the response without typing anything.
  useEffect(() => {
    if (!isOpen) return;
    const pending = consumePendingAutoPrompt();
    if (!pending) return;
    void send({ userMessage: pending }).catch((err) => {
      logger.error("auto-send failed", { err: String(err) });
    });
  }, [isOpen, consumePendingAutoPrompt, send]);

  if (!isOpen) return null;

  const handleSend = async (): Promise<void> => {
    const text = draft.trim();
    if (text.length === 0 || text.length > 10000) return;
    setDraft("");
    try {
      await send({ userMessage: text });
    } catch (err) {
      logger.error("AI panel send failed", { err: String(err) });
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <aside className="fixed inset-2 sm:inset-auto sm:top-4 sm:right-4 sm:bottom-4 sm:w-[400px] bg-paper border border-line rounded-lg shadow-lg z-40 flex flex-col text-ink">
      <header className="flex items-center justify-between px-4 py-3.5 border-b border-line">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-obsidian text-yellow grid place-items-center">
            <Sparkles size={14} />
          </div>
          <h2 className="font-serif text-[16px] tracking-tight text-ink">Kayan AI</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={resetConversation}
            aria-label="New conversation"
            title="New conversation"
            className="grid place-items-center w-8 h-8 rounded-md text-ink-3 hover:bg-cream-2 hover:text-ink"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={close}
            aria-label="Close panel"
            className="grid place-items-center w-8 h-8 rounded-md text-ink-3 hover:bg-cream-2 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="px-4 py-2.5 border-b border-line text-[12px] text-ink-3 flex items-center justify-between gap-2">
        <span className="truncate">
          Context: <span className="text-ink">{context.label}</span>
        </span>
        {context.type !== "freeform" && (
          <button
            onClick={resetContextToFreeform}
            className="text-ink underline underline-offset-2 hover:text-ink shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      <div className="px-4 py-3 border-b border-line flex flex-wrap gap-1.5">
        {availablePrompts.map((p) => (
          <button
            key={p}
            onClick={() => setTemplate(p)}
            className={`text-[11.5px] px-2.5 py-1 rounded-full font-medium transition ${
              template === p
                ? "bg-obsidian text-yellow"
                : "bg-cream-2 text-ink-2 hover:bg-cream"
            }`}
          >
            {PROMPT_TEMPLATE_LABELS[p]}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-[13px] text-ink-3 leading-relaxed">
            Pick a prompt above and send a message — responses arrive in Arabic + English when
            generating content.
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.content} />
        ))}
        {isPending && <MessageBubble role="assistant" content="…thinking…" placeholder />}
        {error && (
          <div className="text-[13px] text-rose-deep bg-rose/40 border border-rose-deep/30 rounded-md p-2.5">
            {error instanceof Error ? error.message : "AI request failed."}
          </div>
        )}
      </div>

      <footer className="border-t border-line p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          rows={3}
          maxLength={10000}
          placeholder={PROMPT_TEMPLATE_PLACEHOLDERS[template]}
          className="form-textarea text-[13px] resize-none"
        />
        <div className="flex items-center justify-between mt-2 text-[11px] text-ink-3">
          <span>
            {draft.length}/10000 · <span className="kbd">⌘</span> /{" "}
            <span className="kbd">Ctrl</span> + Enter to send
          </span>
          <button
            onClick={handleSend}
            disabled={isPending || draft.trim().length === 0}
            className="btn btn-primary text-[12px] py-2 px-3 disabled:opacity-50"
          >
            <Send size={12} />
            {isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </footer>
    </aside>
  );
}

interface BubbleProps {
  role: "user" | "assistant";
  content: string;
  placeholder?: boolean;
}

function MessageBubble({ role, content, placeholder = false }: BubbleProps): JSX.Element {
  const context = useAIStore((s) => s.context);
  const isAssistant = role === "assistant";
  const canSaveToEntry = isAssistant && context.type === "entry" && context.contextId !== null;
  const parsed: ParsedAISections = useMemo(
    () =>
      isAssistant && !placeholder
        ? parseAIResponse(content)
        : { script: null, shotDirections: null, caption: null, hashtags: null },
    [isAssistant, placeholder, content],
  );
  const structured = hasParsedSections(parsed);

  return (
    <div
      className={`rounded-md p-3 text-[13px] whitespace-pre-wrap ${
        isAssistant
          ? "bg-cream-2/40 border border-line"
          : "bg-yellow-bg border border-yellow/40"
      } ${placeholder ? "italic opacity-70" : ""}`}
    >
      <div className="eyebrow mb-1.5">{role}</div>
      <div className="text-ink leading-relaxed">{content}</div>
      {isAssistant && !placeholder && (
        <BubbleActions
          content={content}
          parsed={parsed}
          structured={structured}
          canSaveToEntry={canSaveToEntry}
          entryId={context.contextId}
        />
      )}
    </div>
  );
}

interface BubbleActionsProps {
  content: string;
  parsed: ParsedAISections;
  structured: boolean;
  canSaveToEntry: boolean;
  entryId: string | null;
}

// All the post-response actions live in their own component so each save
// button can carry independent flash state without re-rendering siblings.
function BubbleActions({
  content,
  parsed,
  structured,
  canSaveToEntry,
  entryId,
}: BubbleActionsProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3 mt-2.5 pt-2.5 border-t border-line text-[11.5px]">
      <CopyButton text={content} />
      {/* Per-section save buttons appear when AI returned the structured
          format (## Script / ## Shot directions / ## Caption / ## Hashtags).
          Otherwise we fall back to the generic "Save to notes" button for
          free-form responses. */}
      {canSaveToEntry && structured && parsed.script && entryId && (
        <SaveFieldButton entryId={entryId} field="script" value={parsed.script} label="Save script" />
      )}
      {canSaveToEntry && structured && parsed.shotDirections && entryId && (
        <SaveFieldButton entryId={entryId} field="shotDirections" value={parsed.shotDirections} label="Save shot directions" />
      )}
      {canSaveToEntry && structured && parsed.caption && entryId && (
        <SaveFieldButton entryId={entryId} field="caption" value={parsed.caption} label="Save caption" />
      )}
      {canSaveToEntry && structured && parsed.hashtags && entryId && (
        <SaveFieldButton entryId={entryId} field="hashtags" value={parsed.hashtags} label="Save hashtags" />
      )}
      {canSaveToEntry && !structured && entryId && (
        <SaveFieldButton entryId={entryId} field="notes" value={content} label="Save to notes" />
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      logger.warn("clipboard write failed", { err: String(err) });
    }
  };
  return (
    <button onClick={onCopy} className="flex items-center gap-1 text-ink-3 hover:text-ink">
      <Copy size={12} />
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

interface SaveFieldButtonProps {
  entryId: string;
  field: "script" | "shotDirections" | "caption" | "hashtags" | "notes";
  value: string;
  label: string;
}

function SaveFieldButton({ entryId, field, value, label }: SaveFieldButtonProps): JSX.Element {
  const updateEntry = useUpdateEntry();
  const [saved, setSaved] = useState(false);

  const onSave = async (): Promise<void> => {
    try {
      await updateEntry.mutateAsync({
        id: entryId,
        input: { [field]: value },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      logger.error("save field from AI failed", { entryId, field, err: String(err) });
    }
  };

  return (
    <button
      onClick={onSave}
      disabled={updateEntry.isPending}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-obsidian text-yellow text-[11px] font-semibold hover:brightness-110 disabled:opacity-50"
    >
      {saved ? <Check size={10} /> : <Sparkles size={10} />}
      {saved ? "Saved" : updateEntry.isPending ? "Saving…" : label}
    </button>
  );
}
