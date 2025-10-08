"use client";

import React from "react";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import clsx from "clsx";
import type { ShortcutAction } from "../lib/utils/keyboard";
import { matchShortcut } from "../lib/utils/keyboard";
import { tokenize, type Token } from "../lib/algebra/tokenizer";
import "../styles.css";

export interface CalcInputHandle {
  insert: (text: string, cursorOffset?: number) => void;
  focus: () => void;
}

interface CalcInputProps {
  readonly value: string;
  readonly label: string;
  readonly placeholder: string;
  readonly evaluateLabel: string;
  readonly clearLabel: string;
  readonly onChange: (value: string) => void;
  readonly onShortcut: (action: ShortcutAction) => void;
  readonly errorPosition?: number | null;
}

type Segment = {
  readonly text: string;
  readonly className: string;
  readonly start: number;
  readonly end: number;
};

const FUNCTION_SET = new Set(["sin", "cos", "tan", "log", "ln", "sqrt"]);
const CONSTANT_SET = new Set(["pi", "e"]);

type Ref = CalcInputHandle;

export const CalcInput = forwardRef<Ref, CalcInputProps>(
  (
    {
      value,
      label,
      placeholder,
      evaluateLabel,
      clearLabel,
      onChange,
      onShortcut,
      errorPosition,
    },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => ({
      insert: (text: string, cursorOffset = 0) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const { selectionStart = value.length, selectionEnd = value.length } = textarea;
        const nextValue =
          value.slice(0, selectionStart) + text + value.slice(selectionEnd);
        const nextCursor = selectionStart + text.length - cursorOffset;

        onChange(nextValue);

        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(nextCursor, nextCursor);
        });
      },
      focus: () => {
        textareaRef.current?.focus();
      },
    }));

    const segments = useMemo(
      () => buildSegments(value, errorPosition ?? undefined),
      [value, errorPosition],
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const action = matchShortcut(event.nativeEvent);
      if (!action || action === "newline") {
        return;
      }

      if (action === "evaluate" || action === "clear" || action === "help" || action === "toggleTheme") {
        event.preventDefault();
      }

      if (action === "historyPrev" || action === "historyNext") {
        event.preventDefault();
      }

      onShortcut(action);
    };

    return (
      <section className="axion-panel flex flex-col gap-4 p-4">
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
            {label}
          </span>
          <div className="relative">
            <pre
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words rounded-lg bg-black/40 px-3 py-2 font-mono text-base text-[rgba(255,255,255,0.45)]"
            >
              {segments.map((segment, index) => (
                <span key={`${segment.start}-${index}`} className={segment.className}>
                  {segment.text || "\u200b"}
                </span>
              ))}
            </pre>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              spellCheck={false}
              aria-label={label}
              className="relative min-h-[160px] w-full resize-y rounded-lg border border-transparent bg-transparent px-3 py-2 font-mono text-base text-[var(--ax-text)] focus-visible:border-[rgba(0,255,242,0.6)] focus-visible:outline-none"
            />
          </div>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="axion-button"
            onClick={() => onShortcut("evaluate")}
          >
            {evaluateLabel}
          </button>
          <button
            type="button"
            className="axion-button"
            onClick={() => onShortcut("clear")}
          >
            {clearLabel}
          </button>
        </div>
      </section>
    );
  },
);

CalcInput.displayName = "CalcInput";

function buildSegments(source: string, errorPosition?: number): Segment[] {
  try {
    const tokens = tokenize(source);
    const segments: Segment[] = [];
    let position = 0;

    for (const token of tokens) {
      if (position < token.start) {
        const text = source.slice(position, token.start);
        segments.push({
          text,
          className: "text-[rgba(255,255,255,0.35)]",
          start: position,
          end: token.start,
        });
      }

      const tokenText = source.slice(token.start, token.end);
      segments.push({
        text: tokenText,
        className: classForToken(token),
        start: token.start,
        end: token.end,
      });
      position = token.end;
    }

    if (position < source.length) {
      segments.push({
        text: source.slice(position),
        className: "text-[rgba(255,255,255,0.35)]",
        start: position,
        end: source.length,
      });
    }

    return highlightError(segments, errorPosition);
  } catch {
    return highlightError(
      [
        {
          text: source,
          className: "text-[rgba(255,255,255,0.55)]",
          start: 0,
          end: source.length,
        },
      ],
      errorPosition,
    );
  }
}

function classForToken(token: Token): string {
  switch (token.type) {
    case "number":
      return "text-amber-300";
    case "identifier":
      if (FUNCTION_SET.has(token.value)) return "text-neon";
      if (CONSTANT_SET.has(token.value)) return "text-violet";
      return "text-[rgba(255,255,255,0.75)]";
    case "operator":
      return "text-violet";
    case "leftParen":
    case "rightParen":
    case "comma":
      return "text-[rgba(255,255,255,0.45)]";
    default:
      return "text-[rgba(255,255,255,0.45)]";
  }
}

function highlightError(segments: Segment[], errorPosition?: number): Segment[] {
  if (errorPosition === undefined || Number.isNaN(errorPosition)) {
    return segments;
  }

  const highlighted: Segment[] = [];

  for (const segment of segments) {
    if (errorPosition < segment.start || errorPosition >= segment.end) {
      highlighted.push(segment);
      continue;
    }

    const offset = errorPosition - segment.start;
    const before = segment.text.slice(0, offset);
    const target = segment.text.slice(offset, offset + 1) || " ";
    const after = segment.text.slice(offset + 1);

    if (before) {
      highlighted.push({
        text: before,
        className: segment.className,
        start: segment.start,
        end: segment.start + before.length,
      });
    }

    highlighted.push({
      text: target,
      className: clsx("bg-[rgba(255,96,96,0.25)] text-[#ff8686]", segment.className),
      start: errorPosition,
      end: errorPosition + 1,
    });

    if (after) {
      highlighted.push({
        text: after,
        className: segment.className,
        start: errorPosition + 1,
        end: segment.end,
      });
    }
  }

  return highlighted;
}
