"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";

import type { ExplainReference } from "../lib/algebra/solution";
import { useI18n } from "../lib/i18n/context";

interface ExplainAccordionProps {
  readonly followUps: readonly ExplainReference[];
  readonly className?: string;
}

export function ExplainAccordion({ followUps, className }: ExplainAccordionProps) {
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
        "space-y-2 rounded border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.24)] p-3",
        className,
      )}
    >
      <summary className="cursor-pointer text-xs uppercase tracking-[0.25em] text-[var(--ax-muted)]">
        {t("notebook.explain", "Explain references")}
      </summary>
      <ul className="space-y-2 text-sm">
        {followUps.map((reference) => (
          <li key={reference.id}>
            <span className="font-semibold text-[rgba(255,255,255,0.85)]">{reference.label}</span>
            {reference.description ? (
              <span className="block text-xs text-[rgba(255,255,255,0.65)]">{reference.description}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
