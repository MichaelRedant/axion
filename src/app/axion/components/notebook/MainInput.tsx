"use client";

import clsx from "clsx";
import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { MAXIMA_COMMANDS } from "../../lib/algebra/maxima/commands";
import { tokenize, type Token } from "../../lib/algebra/tokenizer";

export interface MainInputHandle {
  insert: (text: string, cursorOffset?: number) => void;
  focus: () => void;
}

interface MainInputProps {
  readonly value: string;
  readonly label: string;
  readonly placeholder?: string;
  readonly onChange: (value: string) => void;
  readonly onEvaluate: () => void;
  readonly onFocus?: () => void;
  readonly errorPosition?: number | null;
  readonly selected?: boolean;
}

type Segment = {
  readonly text: string;
  readonly className: string;
  readonly start: number;
  readonly end: number;
};

const FUNCTION_SET = new Set<string>([
  ...MAXIMA_COMMANDS,
  "fact",
  "partialfraction",
  "partialFraction",
]);
const CONSTANT_SET = new Set(["pi", "e", "phi"]);

type Ref = MainInputHandle;

export const MainInput = forwardRef<Ref, MainInputProps>(
  (
    { value, label, placeholder, onChange, onEvaluate, onFocus, errorPosition, selected },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => ({
      insert: (text: string, cursorOffset = 0) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const { selectionStart = value.length, selectionEnd = value.length } = textarea;
        const nextValue = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
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
      if (event.key === "Enter" && (event.shiftKey || event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onEvaluate();
        return;
      }
    };

    const handleFocus = () => {
      onFocus?.();
    };

    return (
      <label className="flex flex-col gap-2">
        <span className="axion-shell__eyebrow text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
          {label}
        </span>
        <div
          className={clsx(
            "relative rounded-xl border",
            selected ? "border-[rgba(0,255,242,0.4)] bg-[rgba(6,10,18,0.65)]" : "border-transparent bg-[rgba(6,10,18,0.4)]",
          )}
        >
          <pre
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words rounded-xl px-4 py-3 font-mono text-base leading-6 text-[rgba(255,255,255,0.55)]"
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
            placeholder={placeholder}
            spellCheck={false}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            className={clsx(
              "relative min-h-[140px] w-full resize-y rounded-xl border border-transparent bg-transparent px-4 py-3 font-mono text-base leading-6 text-[var(--ax-text)] focus-visible:outline-none",
              selected ? "focus-visible:border-[rgba(0,255,242,0.8)]" : "focus-visible:border-[rgba(0,255,242,0.5)]",
            )}
            aria-label={label}
          />
        </div>
        <p className="text-xs text-[rgba(255,255,255,0.45)]">
          Shift+Enter to evaluate · Cmd/Ctrl+Enter supported
        </p>
      </label>
    );
  },
);

MainInput.displayName = "MainInput";

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
      return "text-[#55f2ff]";
    case "identifier":
      if (FUNCTION_SET.has(token.value.toLowerCase()) || FUNCTION_SET.has(token.value)) {
        return "text-[#f2c94c]";
      }
      if (CONSTANT_SET.has(token.value.toLowerCase()) || CONSTANT_SET.has(token.value)) {
        return "text-[#55f2ff]";
      }
      return "text-[#9dffb0]";
    case "operator":
      return "text-[rgba(255,255,255,0.75)]";
    case "leftParen":
    case "rightParen":
    case "leftBracket":
    case "rightBracket":
    case "leftBrace":
    case "rightBrace":
    case "comma":
    case "semicolon":
      return "text-[rgba(255,255,255,0.55)]";
    case "string":
      return "text-[#ff9a8b]";
    default:
      return "text-[rgba(255,255,255,0.55)]";
  }
}

function highlightError(segments: Segment[], errorPosition?: number): Segment[] {
  if (errorPosition === undefined || errorPosition === null) {
    return segments;
  }

  return segments.map((segment) => {
    if (errorPosition >= segment.start && errorPosition <= segment.end) {
      return {
        ...segment,
        className: clsx(segment.className, "bg-[rgba(255,0,0,0.2)]"),
      };
    }
    return segment;
  });
}
