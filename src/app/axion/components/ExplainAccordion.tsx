"use client";

import { type ReactNode, useEffect, useRef } from "react";
import clsx from "clsx";

import type { ExplainReference } from "../lib/algebra/solution";
import { useI18n } from "../lib/i18n/context";

interface ExplainAccordionProps {
  readonly followUps: readonly ExplainReference[];
  readonly className?: string;
  readonly intro?: ReactNode;
  readonly listClassName?: string;
  readonly itemClassName?: string;
  readonly renderReference?: (reference: ExplainReference) => ReactNode;
  readonly summary?: ReactNode;
}

export function ExplainAccordion({
  followUps,
  className,
  intro,
  listClassName,
  itemClassName,
  renderReference,
  summary,
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

  const resolvedListClassName = listClassName ?? "space-y-2 text-sm";

  return (
    <details
      ref={detailsRef}
      className={clsx(
        "space-y-2 rounded border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.24)] p-3",
        className,
      )}
    >
      <summary className="cursor-pointer text-xs uppercase tracking-[0.25em] text-[var(--ax-muted)]">
        {summary ?? t("notebook.explain", "Explain references")}
      </summary>
      <div className="mt-3 space-y-3">
        {intro ? <div>{intro}</div> : null}
        <ul className={clsx(resolvedListClassName)}>
          {followUps.map((reference) => (
            <li key={reference.id} className={itemClassName}>
              {renderReference ? (
                renderReference(reference)
              ) : (
                <div className="space-y-1">
                  <span className="font-semibold text-[rgba(255,255,255,0.85)]">{reference.label}</span>
                  {reference.description ? (
                    <span className="block text-xs text-[rgba(255,255,255,0.65)]">{reference.description}</span>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
