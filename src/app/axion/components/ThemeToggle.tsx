"use client";

import "../styles.css";

interface ThemeToggleProps {
  readonly enabled: boolean;
  readonly onToggle: () => void;
  readonly enabledLabel: string;
  readonly disabledLabel: string;
}

/**
 * ThemeToggle switches between neon and a calmer dark theme.
 * Preference persistence is managed by the parent.
 */
export function ThemeToggle({
  enabled,
  onToggle,
  enabledLabel,
  disabledLabel,
}: ThemeToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      className="axion-button flex items-center gap-2 text-sm"
      onClick={onToggle}
    >
      <span aria-hidden>{enabled ? "🌌" : "🌑"}</span>
      <span>{enabled ? enabledLabel : disabledLabel}</span>
    </button>
  );
}
