"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";

import type { ExplainReference } from "../lib/algebra/solution";
import { useI18n } from "../lib/i18n/context";

interface ExplainAccordionProps {
  readonly followUps: readonly ExplainReference[];
  readonly className?: string;
  readonly onReferenceClick?: (reference: ExplainReference) => void;
}

export function ExplainAccordion({
  followUps,
  className,
  onReferenceClick,
}: ExplainAccordionProps) {
  const { t } = useI18n();
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const element = detailsRef.current;
    if (!element || !followUps.length) {
      return;
    }

    if (!element.dataset.autoOpened) {
      element.open = true;
      element.dataset.autoOpened = "true";
    }
  }, [followUps]);

  if (!followUps.length) {
    return null;
  }

  return (
    <details
      ref={detailsRef}
      className={clsx(
        "space-y-3 rounded border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.24)] p-3",
        className,
      )}
    >
      <summary className="cursor-pointer text-xs uppercase tracking-[0.25em] text-[var(--ax-muted)]">
        {t("notebook.explain", "Explain references")}
      </summary>
      <div className="space-y-3">
        <p className="text-xs text-[rgba(255,255,255,0.6)]">
          {t(
            "notebook.explainIntro",
            "Open a related topic to highlight the corresponding derivation step.",
          )}
        </p>
        <ul className="space-y-2 text-sm">
          {followUps.map((reference) => {
            const isInteractive = Boolean(reference.targetStepId && onReferenceClick);
            const handleClick = () => {
              if (!isInteractive) {
                return;
              }
              onReferenceClick?.(reference);
            };

            return (
              <li key={reference.id}>
                {isInteractive ? (
                  <button
                    type="button"
                    className="text-left font-semibold text-[rgba(255,255,255,0.85)] transition hover:text-neon focus-visible:text-neon focus-visible:outline-none"
                    onClick={handleClick}
                    aria-label={`${t(
                      "notebook.stepsNavigate",
                      "Highlight matching step",
                    )}: ${reference.label}`}
                  >
                    {reference.label}
                  </button>
                ) : (
                  <span className="font-semibold text-[rgba(255,255,255,0.85)]">{reference.label}</span>
                )}
                {reference.description ? (
                  <span className="block text-xs text-[rgba(255,255,255,0.65)]">{reference.description}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
