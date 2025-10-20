"use client";

import clsx from "clsx";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import ReactMarkdown from "react-markdown";

export interface TextCellEditorHandle {
  insert: (text: string, cursorOffset?: number) => void;
  focus: () => void;
}

interface TextCellEditorProps {
  readonly value: string;
  readonly label: string;
  readonly placeholder?: string;
  readonly previewLabel: string;
  readonly emptyPreviewMessage: string;
  readonly onChange: (value: string) => void;
  readonly onFocus?: () => void;
  readonly selected?: boolean;
  readonly testId?: string;
}

type Ref = TextCellEditorHandle;

export const TextCellEditor = forwardRef<Ref, TextCellEditorProps>(
  (
    {
      value,
      label,
      placeholder,
      previewLabel,
      emptyPreviewMessage,
      onChange,
      onFocus,
      selected,
      testId,
    },
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

    const handleFocus = () => {
      onFocus?.();
    };

    return (
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="axion-shell__eyebrow text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
            {label}
          </span>
          <textarea
            ref={textareaRef}
            value={value}
            placeholder={placeholder}
            spellCheck
            onChange={(event) => onChange(event.target.value)}
            onFocus={handleFocus}
            className={clsx(
              "min-h-[160px] w-full resize-y rounded-xl border bg-[rgba(6,10,18,0.4)] px-4 py-3 text-base leading-6 text-[var(--ax-text)] focus-visible:outline-none",
              selected
                ? "border-[rgba(0,255,242,0.4)] focus-visible:border-[rgba(0,255,242,0.8)]"
                : "border-transparent focus-visible:border-[rgba(0,255,242,0.5)]",
            )}
            aria-label={label}
          />
        </label>
        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">{previewLabel}</h3>
          {value.trim() ? (
            <div
              className="space-y-3 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.3)] px-4 py-3 text-base leading-6 text-[rgba(255,255,255,0.85)]"
              data-testid={testId}
            >
              <ReactMarkdown className="space-y-3 [&_code]:rounded [&_code]:bg-[rgba(255,255,255,0.08)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_strong]:text-[rgba(255,255,255,0.95)]">
                {value}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-[rgba(255,255,255,0.45)]">{emptyPreviewMessage}</p>
          )}
        </section>
      </div>
    );
  },
);

TextCellEditor.displayName = "TextCellEditor";
