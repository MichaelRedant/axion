"use client";

import { useMemo } from "react";
import { THEMES } from "../theme";
import "../styles.css";

interface ThemeToggleProps {
  readonly value: string;
  readonly onToggle: () => void;
  readonly labels: Record<string, string>;
}

export function ThemeToggle({ value, onToggle, labels }: ThemeToggleProps) {
  const label = useMemo(() => {
    if (value in labels) return labels[value];
    const theme = THEMES.find((item) => item.id === value);
    return theme?.label ?? labels.default ?? "Theme";
  }, [labels, value]);

  return (
    <button
      type="button"
      className="axion-button axion-button--ghost flex items-center gap-2 text-sm"
      onClick={onToggle}
      aria-label="Schakel thema"
    >
      <span aria-hidden>{label}</span>
    </button>
  );
}
