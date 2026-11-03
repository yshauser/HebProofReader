import { useEffect, useId, useRef } from "react";
import type { TextRange } from "../../domain/document";

interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Half-open UTF-16 range to highlight. Zero-length ranges render as an insertion marker. */
  highlight: TextRange | null;
}

/**
 * A textarea over a transparent "mirror" that renders the same text with a <mark> at the
 * highlighted range. Text is rendered as React text nodes (never as HTML).
 */
export function TextEditor({ value, onChange, highlight }: TextEditorProps) {
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement>(null);

  const start = highlight?.start;
  const end = highlight?.end;

  useEffect(() => {
    const textarea = textareaRef.current;
    const mark = markRef.current;
    if (!textarea || !mark || start === undefined) return;
    const target = Math.max(0, mark.offsetTop - textarea.clientHeight / 2);
    textarea.scrollTop = target;
    if (mirrorRef.current) mirrorRef.current.scrollTop = target;
  }, [start, end]);

  const isInsertion = highlight !== null && highlight.start === highlight.end;
  const trailer = value.endsWith("\n") ? "\u200B" : "";

  return (
    <div className="editor">
      <label htmlFor={id} className="editor__label">
        טקסט לבדיקה
      </label>
      <div className="editor__surface">
        <div ref={mirrorRef} className="editor__text editor__mirror" aria-hidden="true" dir="rtl" lang="he">
          {highlight && start !== undefined && end !== undefined ? (
            <>
              {value.slice(0, start)}
              <mark
                ref={markRef}
                className={isInsertion ? "highlight highlight--insertion" : "highlight"}
                data-testid="highlight"
              >
                {value.slice(start, end)}
              </mark>
              {value.slice(end)}
              {trailer}
            </>
          ) : null}
        </div>
        <textarea
          id={id}
          ref={textareaRef}
          className="editor__text editor__input"
          dir="rtl"
          lang="he"
          spellCheck={false}
          value={value}
          placeholder="הדביקו או הקלידו כאן טקסט בעברית, למשל: שלום ,עולם  טוב."
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            if (mirrorRef.current) mirrorRef.current.scrollTop = event.currentTarget.scrollTop;
          }}
        />
      </div>
    </div>
  );
}
