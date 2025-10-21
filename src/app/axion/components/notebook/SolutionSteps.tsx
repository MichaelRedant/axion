"use client";
import clsx from "clsx";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { ProblemType } from "../../lib/algebra/problems";
import type { SolutionStep } from "../../lib/algebra/solution";
import type { KatexHandle } from "../../lib/hooks/useKatex";
import { useI18n } from "../../lib/i18n/context";

export interface SolutionStepsHandle {
  focusStep: (stepId: string) => void;
}

interface SolutionStepsProps {
  readonly steps: readonly SolutionStep[];
  readonly katex: KatexHandle | null;
  readonly problemType?: ProblemType;
  readonly className?: string;
}

const HIGHLIGHT_CLASSES = [
  "ring-2",
  "ring-[rgba(0,255,242,0.45)]",
  "ring-offset-2",
  "ring-offset-[rgba(6,10,18,0.85)]",
];

export const SolutionSteps = forwardRef<SolutionStepsHandle, SolutionStepsProps>(
  ({ steps, katex, problemType, className }, ref) => {
    const { t } = useI18n();
    const stepRefs = useRef(new Map<string, HTMLDetailsElement>());
    const highlightTimeoutRef = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      focusStep: (stepId: string) => {
        const element = stepRefs.current.get(stepId);
        if (!element) {
          return;
        }

        element.open = true;
        element.scrollIntoView({ behavior: "smooth", block: "center" });

        element.classList.add(...HIGHLIGHT_CLASSES);
        if (highlightTimeoutRef.current) {
          window.clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = window.setTimeout(() => {
          element.classList.remove(...HIGHLIGHT_CLASSES);
        }, 1600);
      },
    }));

    useEffect(() => {
      const firstId = steps[0]?.id;
      stepRefs.current.forEach((element, id) => {
        if (id === firstId) {
          element.open = true;
        } else {
          element.open = false;
        }
        element.classList.remove(...HIGHLIGHT_CLASSES);
      });
    }, [steps]);

    useEffect(
      () => () => {
        if (highlightTimeoutRef.current) {
          window.clearTimeout(highlightTimeoutRef.current);
        }
      },
      [],
    );

    const hasSteps = steps.length > 0;

    const stepCountLabel = useMemo(() => {
      if (!hasSteps) {
        return null;
      }
      if (steps.length === 1) {
        return t("notebook.stepCountSingle", "1 step");
      }
      return t("notebook.stepCountPlural", "{{count}} steps").replace(
        "{{count}}",
        steps.length.toString(),
      );
    }, [hasSteps, steps.length, t]);

    const problemLabel = useMemo(() => {
      if (!problemType) {
        return null;
      }
      return t(`result.problemType.${problemType}`, problemType);
    }, [problemType, t]);

    const introText = hasSteps
      ? t(
          "notebook.stepsIntro",
          "Follow each transformation to understand the solution.",
        )
      : t(
          "notebook.stepsUnavailable",
          "No detailed steps are available for this result yet.",
        );

    if (!hasSteps) {
      return (
        <section
          className={clsx(
            "rounded-lg border border-[rgba(0,255,242,0.12)] bg-[rgba(8,12,20,0.6)] p-4",
            className,
          )}
        >
          <header className="space-y-1">
            <h4 className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
              {t("notebook.stepsHeading", "Step-by-step")}
            </h4>
            <p className="text-xs text-[rgba(255,255,255,0.6)]">{introText}</p>
          </header>
        </section>
      );
    }

    return (
      <section
        className={clsx(
          "space-y-3 rounded-lg border border-[rgba(0,255,242,0.15)] bg-[rgba(8,12,20,0.65)] p-4",
          className,
        )}
      >
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
              {t("notebook.stepsHeading", "Step-by-step")}
            </h4>
            <p className="text-xs text-[rgba(255,255,255,0.6)]">{introText}</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right text-[10px] uppercase tracking-[0.3em] text-[rgba(255,255,255,0.55)]">
            {problemLabel ? <span>{problemLabel}</span> : null}
            {stepCountLabel ? <span>{stepCountLabel}</span> : null}
          </div>
        </header>
        <div className="space-y-2">
          {steps.map((step, index) => {
            const latexHtml = toLatexHtml(katex, step.latex);
            return (
              <details
                key={step.id}
                ref={(element) => {
                  if (!element) {
                    stepRefs.current.delete(step.id);
                    return;
                  }
                  stepRefs.current.set(step.id, element);
                }}
                className="group overflow-hidden rounded-lg border border-[rgba(0,255,242,0.12)] bg-black/35 text-left"
              >
                <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[rgba(181,255,248,0.9)]">
                  <span>{step.title}</span>
                  <span className="text-[10px] uppercase tracking-[0.25em] text-[rgba(255,255,255,0.45)]">
                    {t("notebook.stepsBadge", "Step {{index}}")?.replace(
                      "{{index}}",
                      String(index + 1),
                    )}
                  </span>
                </summary>
                <div className="space-y-2 border-t border-[rgba(0,255,242,0.12)] bg-black/40 px-4 py-3 text-sm text-[rgba(255,255,255,0.75)]">
                  <p>{step.description}</p>
                  {latexHtml ? (
                    <div
                      className="text-base text-[var(--ax-text)]"
                      dangerouslySetInnerHTML={{ __html: latexHtml }}
                    />
                  ) : null}
                  {step.expression ? (
                    <code className="inline-block rounded bg-black/60 px-2 py-1 font-mono text-xs text-[var(--ax-muted)]">
                      {step.expression}
                    </code>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      </section>
    );
  },
);

SolutionSteps.displayName = "SolutionSteps";

function toLatexHtml(
  katex: KatexHandle | null,
  latex?: string | null,
): string | null {
  if (!latex || !katex) {
    return null;
  }

  try {
    return katex.renderToString(latex);
  } catch {
    return null;
  }
}

