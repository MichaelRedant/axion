"use client";

import { useMemo } from "react";
import { THEMES } from "../theme";
import { Tooltip } from "./Tooltip";
import "../styles.css";

interface ThemeToggleProps {
  readonly value: string;
  readonly onToggle: () => void;
  readonly labels: Record<string, string>;
  readonly tooltip: string;
  readonly ariaLabel: string;
}

export function ThemeToggle({ value, onToggle, labels, tooltip, ariaLabel }: ThemeToggleProps) {
  const label = useMemo(() => {
    if (value in labels) return labels[value];
    const theme = THEMES.find((item) => item.id === value);
    return theme?.label ?? labels.default ?? "Theme";
  }, [labels, value]);

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        className="axion-button axion-button--ghost flex items-center gap-2 text-sm"
        onClick={onToggle}
        aria-label={ariaLabel}
      >
        <span aria-hidden>{label}</span>
      </button>
    </Tooltip>
  );
}
