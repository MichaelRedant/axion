"use client";

import clsx from "clsx";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import type { KatexHandle } from "../../lib/hooks/useKatex";
import { useI18n } from "../../lib/i18n/context";
import type { NotebookCell as NotebookCellModel } from "../../lib/notebook/types";
import { MainInput, type MainInputHandle } from "./MainInput";

export interface NotebookCellHandle {
  insert: (text: string, cursorOffset?: number) => void;
  focus: () => void;
}

interface NotebookCellProps {
  readonly cell: NotebookCellModel;
  readonly index: number;
  readonly isSelected: boolean;
  readonly katex: KatexHandle | null;
  readonly onSelect: () => void;
  readonly onChangeInput: (value: string) => void;
  readonly onEvaluate: () => void;
  readonly onAddBelow: () => void;
  readonly onRemove: () => void;
}

type Ref = NotebookCellHandle;

export const NotebookCell = forwardRef<Ref, NotebookCellProps>(
  (
    {
      cell,
      index,
      isSelected,
      katex,
      onSelect,
      onChangeInput,
      onEvaluate,
      onAddBelow,
      onRemove,
    },
    ref,
  ) => {
    const { t, locale } = useI18n();
    const inputRef = useRef<MainInputHandle | null>(null);

    useImperativeHandle(ref, () => ({
      insert: (text: string, offset?: number) => inputRef.current?.insert(text, offset),
      focus: () => inputRef.current?.focus(),
    }));

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
      if (!katex || cell.output?.type !== "success") {
        return null;
      }

      try {
        return katex.renderToString(cell.output.evaluation.exact);
      } catch {
        return null;
      }
    }, [cell.output, katex]);

    const statusLabel = useMemo(() => {
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
    }, [cell.status, t]);

    const showStatus = cell.status !== "idle";

    return (
      <article
        className={clsx(
          "axion-panel space-y-4 p-4 sm:p-5 transition",
          isSelected ? "ring-2 ring-[rgba(0,255,242,0.35)]" : "ring-1 ring-transparent",
        )}
        onClick={() => {
          onSelect();
          inputRef.current?.focus();
        }}
        data-testid={`notebook-cell-${cell.id}`}
      >
        <header className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.25em] text-[var(--ax-muted)]">
            <span>
              {t("notebook.cellHeading", "Cell {{index}}", { index: index + 1 })}
            </span>
            <span className="text-[rgba(255,255,255,0.4)]">{formattedTimestamp}</span>
          </div>
          {showStatus ? (
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.65)]">
              {statusLabel}
            </span>
          ) : null}
        </header>
        <MainInput
          ref={inputRef}
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
        <footer className="flex flex-wrap gap-2">
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
          <button
            type="button"
            className="axion-button axion-button--ghost text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onAddBelow();
            }}
          >
            {t("notebook.addBelow", "Add cell below")}
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
