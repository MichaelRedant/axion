"use client";

import clsx from "clsx";
import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import type { KatexHandle } from "../../lib/hooks/useKatex";
import { useI18n } from "../../lib/i18n/context";
import type {
  NotebookCell as NotebookCellModel,
  NotebookCellType,
} from "../../lib/notebook/types";
import { MainInput, type MainInputHandle } from "./MainInput";
import { TextCellEditor, type TextCellEditorHandle } from "./TextCellEditor";

export interface NotebookCellHandle {
  insert: (text: string, cursorOffset?: number) => void;
  focus: () => void;
}

interface NotebookCellProps {
  readonly cell: NotebookCellModel;
  readonly index: number;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly isSelected: boolean;
  readonly katex: KatexHandle | null;
  readonly onSelect: () => void;
  readonly onChangeInput: (value: string) => void;
  readonly onEvaluate: () => void;
  readonly onAddBelow: (type: NotebookCellType) => void;
  readonly onRemove: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
}

type Ref = NotebookCellHandle;

export const NotebookCell = forwardRef<Ref, NotebookCellProps>(
  (
    {
      cell,
      index,
      isFirst,
      isLast,
      isSelected,
      katex,
      onSelect,
      onChangeInput,
      onEvaluate,
      onAddBelow,
      onRemove,
      onMoveUp,
      onMoveDown,
    },
    ref,
  ) => {
    const { t, locale } = useI18n();
    const mathInputRef = useRef<MainInputHandle | null>(null);
    const textInputRef = useRef<TextCellEditorHandle | null>(null);

    useImperativeHandle(ref, () => ({
      insert: (text: string, offset?: number) => {
        if (cell.type === "math") {
          mathInputRef.current?.insert(text, offset);
        } else {
          textInputRef.current?.insert(text, offset);
        }
      },
      focus: () => {
        if (cell.type === "math") {
          mathInputRef.current?.focus();
        } else {
          textInputRef.current?.focus();
        }
      },
    }), [cell.type]);

    const formattedTimestamp = useMemo(() => {
      try {
        return new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date(cell.updatedAt));
      } catch {
        return "";
      }
    }, [cell.updatedAt, locale]);

    const exactHtml = useMemo(() => {
      if (cell.type !== "math" || !katex || cell.output?.type !== "success") {
        return null;
      }

      try {
        return katex.renderToString(cell.output.evaluation.exact);
      } catch {
        return null;
      }
    }, [cell.output, cell.type, katex]);

    const statusLabel = useMemo(() => {
      if (cell.type !== "math") {
        return null;
      }
      switch (cell.status) {
        case "running":
          return t("notebook.running", "Evaluating…");
        case "success":
          return t("notebook.success", "Success");
        case "error":
          return t("notebook.error", "Error");
        default:
          return t("notebook.idle", "Idle");
      }
    }, [cell.status, cell.type, t]);

    const showStatus = cell.type === "math" && cell.status !== "idle";

    const cellHeading =
      cell.type === "math"
        ? t("notebook.cellHeading", "Cell {{index}}", { index: index + 1 })
        : t("notebook.textCellHeading", "Text cell {{index}}", { index: index + 1 });

    const handleContainerClick = () => {
      onSelect();
      if (cell.type === "math") {
        mathInputRef.current?.focus();
      } else {
        textInputRef.current?.focus();
      }
    };

    return (
      <article
        className={clsx(
          "axion-panel space-y-4 p-4 sm:p-5 transition",
          isSelected ? "ring-2 ring-[rgba(0,255,242,0.35)]" : "ring-1 ring-transparent",
        )}
        onClick={handleContainerClick}
        data-testid={`notebook-cell-${cell.id}`}
      >
        <header className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.25em] text-[var(--ax-muted)]">
            <span>{cellHeading}</span>
            <span className="text-[rgba(255,255,255,0.4)]">{formattedTimestamp}</span>
          </div>
          {showStatus && statusLabel ? (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.65)]">
              {statusLabel}
            </span>
          ) : null}
        </header>
        {cell.type === "math" ? (
          <>
            <MainInput
              ref={mathInputRef}
              value={cell.input}
              label={t("notebook.inputLabel", "Input")}
              placeholder={t("notebook.inputPlaceholder", "Type an expression")}
              onChange={onChangeInput}
              onEvaluate={onEvaluate}
              onFocus={onSelect}
              selected={isSelected}
            />
            <section className="space-y-3">
              <h3 className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
                {t("notebook.outputHeading", "Output")}
              </h3>
              {cell.output?.type === "success" ? (
                <div className="space-y-2 text-base" data-testid={`notebook-output-${cell.id}`}>
                  {exactHtml ? (
                    <span dangerouslySetInnerHTML={{ __html: exactHtml }} />
                  ) : (
                    <code className="font-mono text-sm text-[var(--ax-muted)]">
                      {cell.output.evaluation.exact}
                    </code>
                  )}
                  {cell.output.evaluation.approx ? (
                    <p className="font-mono text-xs text-amber-200">
                      ~= {cell.output.evaluation.approx}
                    </p>
                  ) : null}
                  {cell.output.evaluation.solution.followUps?.length ? (
                    <details className="space-y-2 rounded border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.24)] p-3">
                      <summary className="cursor-pointer text-xs uppercase tracking-[0.25em] text-[var(--ax-muted)]">
                        {t("notebook.explain", "Explain references")}
                      </summary>
                      <ul className="space-y-2 text-sm">
                        {cell.output.evaluation.solution.followUps.map((reference) => (
                          <li key={reference.id}>
                            <span className="font-semibold text-[rgba(255,255,255,0.85)]">
                              {reference.label}
                            </span>
                            {reference.description ? (
                              <span className="block text-xs text-[rgba(255,255,255,0.65)]">
                                {reference.description}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              ) : cell.output?.type === "error" ? (
                <p className="font-mono text-sm text-rose-200" data-testid={`notebook-output-${cell.id}`}>
                  {cell.output.error.message}
                </p>
              ) : (
                <p className="text-sm text-[rgba(255,255,255,0.45)]">
                  {t("notebook.pending", "No evaluation yet")}
                </p>
              )}
            </section>
          </>
        ) : (
          <TextCellEditor
            ref={textInputRef}
            value={cell.input}
            label={t("notebook.textInputLabel", "Content")}
            placeholder={t("notebook.textInputPlaceholder", "Write notes using Markdown")}
            previewLabel={t("notebook.textPreviewHeading", "Preview")}
            emptyPreviewMessage={t("notebook.textPreviewEmpty", "Nothing to preview yet")}
            onChange={onChangeInput}
            onFocus={onSelect}
            selected={isSelected}
            testId={`notebook-text-preview-${cell.id}`}
          />
        )}
        <footer className="flex flex-wrap gap-2">
          {cell.type === "math" ? (
            <button
              type="button"
              className="axion-button axion-button--primary text-xs"
              onClick={(event) => {
                event.stopPropagation();
                onEvaluate();
              }}
            >
              {t("notebook.evaluate", "Evaluate")}
            </button>
          ) : null}
          <button
            type="button"
            className="axion-button axion-button--ghost text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onAddBelow("math");
            }}
          >
            {t("notebook.addMathBelow", "Add math below")}
          </button>
          <button
            type="button"
            className="axion-button axion-button--ghost text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onAddBelow("text");
            }}
          >
            {t("notebook.addTextBelow", "Add text below")}
          </button>
          <button
            type="button"
            className="axion-button axion-button--ghost text-xs"
            onClick={(event) => {
              event.stopPropagation();
              if (isFirst) return;
              onMoveUp();
            }}
            disabled={isFirst}
          >
            {t("notebook.moveUp", "Move up")}
          </button>
          <button
            type="button"
            className="axion-button axion-button--ghost text-xs"
            onClick={(event) => {
              event.stopPropagation();
              if (isLast) return;
              onMoveDown();
            }}
            disabled={isLast}
          >
            {t("notebook.moveDown", "Move down")}
          </button>
          <button
            type="button"
            className="axion-button axion-button--ghost text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            {t("notebook.remove", "Remove")}
          </button>
        </footer>
      </article>
    );
  },
);

NotebookCell.displayName = "NotebookCell";
