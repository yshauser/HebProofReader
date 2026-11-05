import { useEffect, useId, useRef } from "react";
import type { TextRange } from "../../domain/document";

interface DocumentPreviewProps {
  /** Normalized document text; lines are paragraphs (and line breaks) separated by "\n". */
  text: string;
  /** Half-open UTF-16 range to highlight. Zero-length ranges render as an insertion marker. */
  highlight: TextRange | null;
}

interface Line {
  text: string;
  start: number;
}

function splitLines(text: string): Line[] {
  let start = 0;
  return text.split("\n").map((line) => {
    const entry = { text: line, start };
    start += line.length + 1;
    return entry;
  });
}

/**
 * Read-only, RTL document view used for DOCX files. It exists for navigation: selecting a finding
 * highlights its exact range (across lines if needed) and scrolls it into view. Text is rendered
 * as React text nodes, never as HTML.
 */
export function DocumentPreview({ text, highlight }: DocumentPreviewProps) {
  const labelId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const start = highlight?.start;
  const end = highlight?.end;

  useEffect(() => {
    if (start === undefined) return;
    surfaceRef.current?.querySelector("mark")?.scrollIntoView?.({ block: "center", behavior: "auto" });
  }, [start, end]);

  const isInsertion = highlight !== null && highlight.start === highlight.end;

  return (
    <div className="preview">
      <h2 id={labelId} className="editor__label">
        תצוגת המסמך
      </h2>
      <div ref={surfaceRef} className="preview__surface" role="region" aria-labelledby={labelId} tabIndex={0} dir="rtl" lang="he" data-testid="document-preview">
        {splitLines(text).map((line, index) => {
          const lineEnd = line.start + line.text.length;
          let content: React.ReactNode = line.text === "" ? "\u200B" : line.text;
          if (highlight && start !== undefined && end !== undefined) {
            const from = Math.max(start, line.start);
            const to = Math.min(end, lineEnd);
            const hit = isInsertion ? start >= line.start && start <= lineEnd : to > from;
            if (hit) {
              const a = from - line.start;
              const b = isInsertion ? a : to - line.start;
              content = (
                <>
                  {line.text.slice(0, a)}
                  <mark
                    className={isInsertion ? "preview__mark preview__mark--insertion" : "preview__mark"}
                    data-testid="highlight"
                  >
                    {line.text.slice(a, b)}
                  </mark>
                  {line.text.slice(b)}
                </>
              );
            }
          }
          return (
            <p key={line.start} className="preview__line" data-line={index + 1}>
              {content}
            </p>
          );
        })}
      </div>
    </div>
  );
}
