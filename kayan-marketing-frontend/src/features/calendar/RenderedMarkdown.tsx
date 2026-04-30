import { type ReactNode } from "react";

// Lightweight inline markdown renderer for AI-generated content blocks
// (Script / Caption / Hashtags). Handles only the patterns our prompts
// produce — heading levels, **bold**, [bracketed shot directions] — which
// keeps it dependency-free and trivially safe (no dangerouslySetInnerHTML,
// just React nodes).

interface Props {
  text: string;
}

function renderInline(line: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  // Match either **bold** or [bracketed]; everything else falls through as
  // plain text. Order matters — try the longer patterns first.
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\])/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(<span key={key++}>{line.slice(lastIdx, match.index)}</span>);
    }
    const m = match[0];
    if (m.startsWith("**")) {
      tokens.push(
        <strong key={key++} className="font-semibold text-ink">
          {m.slice(2, -2)}
        </strong>,
      );
    } else if (m.startsWith("[")) {
      tokens.push(
        <span key={key++} className="text-ink-3 italic">
          {m}
        </span>,
      );
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < line.length) {
    tokens.push(<span key={key++}>{line.slice(lastIdx)}</span>);
  }
  return tokens;
}

export function RenderedMarkdown({ text }: Props): JSX.Element {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let blockKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <div
          key={blockKey++}
          className="font-semibold text-ink text-[14px] mt-3 first:mt-0"
        >
          {trimmed.slice(3)}
        </div>,
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push(
        <div
          key={blockKey++}
          className="font-bold text-ink text-[15px] mt-3 first:mt-0"
        >
          {trimmed.slice(2)}
        </div>,
      );
      continue;
    }
    if (trimmed === "") {
      blocks.push(<div key={blockKey++} className="h-1.5" />);
      continue;
    }

    blocks.push(
      <p key={blockKey++} dir="auto" className="text-ink-2 leading-relaxed">
        {renderInline(line)}
      </p>,
    );
  }

  return <div className="text-[13.5px]">{blocks}</div>;
}
