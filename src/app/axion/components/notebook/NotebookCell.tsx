"use client";

import clsx from "clsx";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KatexHandle } from "../../lib/hooks/useKatex";
import { useI18n } from "../../lib/i18n/context";
import type {
  NotebookCell as NotebookCellModel,
  NotebookCellType,
} from "../../lib/notebook/types";
import { MainInput, type MainInputHandle } from "./MainInput";
import { TextCellEditor, type TextCellEditorHandle } from "./TextCellEditor";
import { ExplainAccordion } from "../ExplainAccordion";
import type { ExplainReference } from "../../lib/algebra/solution";
import { SolutionSteps, type SolutionStepsHandle } from "./SolutionSteps";
import { tryConvertLatexFractionToDecimal } from "../../lib/utils/numbers";

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

const RESULT_BADGE_STYLES = {
  idle: {
    container: "border-[rgba(255,255,255,0.25)] text-[rgba(255,255,255,0.65)]",
    dot: "bg-[rgba(255,255,255,0.65)]",
  },
  running: {
    container: "border-[rgba(255,184,0,0.4)] text-[#ffb347]",
    dot: "bg-[#ffb347]",
  },
  success: {
    container: "border-[rgba(0,255,242,0.35)] text-[rgba(181,255,248,0.95)]",
    dot: "bg-[rgba(0,255,242,0.85)]",
  },
  error: {
    container: "border-[rgba(255,84,110,0.45)] text-[#ff8597]",
    dot: "bg-[#ff4f75]",
  },
} as const;

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
    const stepsRef = useRef<SolutionStepsHandle | null>(null);

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

    const exactLatex =
      cell.type === "math" && cell.output?.type === "success"
        ? cell.output.evaluation.exact
        : null;
    const [showExactAsDecimal, setShowExactAsDecimal] = useState(false);

    const exactHtml = useMemo(() => {
      if (cell.type !== "math" || !katex || cell.output?.type !== "success" || showExactAsDecimal) {
        return null;
      }

      try {
        return katex.renderToString(cell.output.evaluation.exact);
      } catch {
        return null;
      }
    }, [cell.output, cell.type, katex, showExactAsDecimal]);

    const exactDecimal = useMemo(() => {
      if (!exactLatex) {
        return null;
      }
      return tryConvertLatexFractionToDecimal(exactLatex);
    }, [exactLatex]);

    useEffect(() => {
      setShowExactAsDecimal(false);
    }, [exactLatex]);

    const solution = cell.type === "math" && cell.output?.type === "success" ? cell.output.evaluation.solution : null;

    const followUps = solution?.followUps ?? [];
    const steps = solution?.steps ?? [];
    const problemType = solution?.type;

    const handleFollowUpNavigate = useCallback(
      (reference: ExplainReference) => {
        if (!reference.targetStepId) {
          return;
        }
        stepsRef.current?.focusStep(reference.targetStepId);
      },
      [],
    );

    const solution =
      cell.type === "math" && cell.output?.type === "success"
        ? cell.output.evaluation.solution
        : null;

    const followUps = solution?.followUps ?? [];
    const steps = solution?.steps ?? [];
    const problemType = solution?.type;

    const handleFollowUpNavigate = useCallback(
      (reference: ExplainReference) => {
        if (!reference.targetStepId) {
          return;
        }
        stepsRef.current?.focusStep(reference.targetStepId);
      },
      [],
    );

    const evaluationSolution =
      cell.type === "math" && cell.output?.type === "success"
        ? cell.output.evaluation.solution
        : null;

    const followUps = evaluationSolution?.followUps ?? [];
    const steps = evaluationSolution?.steps ?? [];
    const problemType = evaluationSolution?.type;

    const handleFollowUpNavigate = useCallback(
      (reference: ExplainReference) => {
        if (!reference.targetStepId) {
          return;
        }
        stepsRef.current?.focusStep(reference.targetStepId);
      },
      [],
    );

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

    const resultBadge = useMemo(() => {
      if (cell.type !== "math") {
        return null;
      }

      const badgeType = (() => {
        if (cell.status === "running") {
          return "running" as const;
        }
        if (cell.output?.type === "error" || cell.status === "error") {
          return "error" as const;
        }
        if (cell.output?.type === "success" || cell.status === "success") {
          return "success" as const;
        }
        return "idle" as const;
      })();

      const label = (() => {
        switch (badgeType) {
          case "running":
            return t("notebook.running", "Evaluating…");
          case "error":
            return t("notebook.error", "Error");
          case "success":
            return t("notebook.success", "Success");
          case "idle":
          default:
            return t("notebook.idle", "Idle");
        }
      })();

      return {
        label,
        styles: RESULT_BADGE_STYLES[badgeType],
      };
    }, [cell.output?.type, cell.status, cell.type, t]);

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
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
                  {t("notebook.outputHeading", "Output")}
                </h3>
                {resultBadge ? (
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]",
                      resultBadge.styles.container,
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={clsx("block h-1.5 w-1.5 rounded-full", resultBadge.styles.dot)}
                    />
                    {resultBadge.label}
                  </span>
                ) : null}
                {exactDecimal ? (
                  <button
                    type="button"
                    className="axion-button axion-button--ghost text-[10px]"
                    onClick={() => setShowExactAsDecimal((current) => !current)}
                    aria-pressed={showExactAsDecimal}
                  >
                    {showExactAsDecimal
                      ? t("common.showFraction", "Show fraction")
                      : t("common.showDecimal", "Show decimal")}
                  </button>
                ) : null}
              </div>
              {cell.output?.type === "success" ? (
                <div className="space-y-4" data-testid={`notebook-output-${cell.id}`}>
                  <div className="space-y-2 text-base">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-h-[32px] flex-1">
                        {showExactAsDecimal && exactDecimal ? (
                          <code
                            className="font-mono text-base text-[var(--ax-text)]"
                            data-testid={`notebook-exact-decimal-${cell.id}`}
                          >
                            {exactDecimal}
                          </code>
                        ) : exactHtml ? (
                          <span dangerouslySetInnerHTML={{ __html: exactHtml }} />
                        ) : (
                          <code className="font-mono text-sm text-[var(--ax-muted)]">
                            {cell.output.evaluation.exact}
                          </code>
                        )}
                      </div>
                      {exactDecimal ? (
                        <button
                          type="button"
                          className="axion-button axion-button--ghost text-[11px]"
                          onClick={() => setShowExactAsDecimal((current) => !current)}
                          aria-pressed={showExactAsDecimal}
                        >
                          {showExactAsDecimal
                            ? t("common.showFraction", "Show fraction")
                            : t("common.showDecimal", "Show decimal")}
                        </button>
                      ) : null}
                    </div>
                    {cell.output.evaluation.approx ? (
                      <p className="font-mono text-xs text-amber-200">
                        ~= {cell.output.evaluation.approx}
                      </p>
                    ) : null}
                  </div>
                  <SolutionSteps
                    ref={stepsRef}
                    steps={steps}
                    katex={katex}
                    problemType={problemType}
                  />
                  <ExplainAccordion
                    followUps={followUps}
                    onReferenceClick={handleFollowUpNavigate}
                  />
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
