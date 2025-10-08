"use client";

import { useMemo } from "react";
import { useI18n } from "../lib/i18n/context";
import "../styles.css";

interface KeypadProps {
  readonly onInsert: (text: string, cursorOffset?: number) => void;
}

type KeypadButton = {
  readonly label: string;
  readonly text: string;
  readonly cursorOffset?: number;
};

const BUTTONS: KeypadButton[] = [
  { label: "sin", text: "sin()", cursorOffset: 1 },
  { label: "cos", text: "cos()", cursorOffset: 1 },
  { label: "tan", text: "tan()", cursorOffset: 1 },
  { label: "ln", text: "ln()", cursorOffset: 1 },
  { label: "log", text: "log()", cursorOffset: 1 },
  { label: "√", text: "sqrt()", cursorOffset: 1 },
  { label: "π", text: "pi" },
  { label: "e", text: "e" },
  { label: "(", text: "(" },
  { label: ")", text: ")" },
  { label: "+", text: "+" },
  { label: "^", text: "^" },
];

export function Keypad({ onInsert }: KeypadProps) {
  const { t } = useI18n();

  const title = useMemo(() => t("keypad.title"), [t]);

  return (
    <section
      aria-label={title}
      className="axion-panel flex flex-col gap-3 p-4"
    >
      <h2 className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
        {title}
      </h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {BUTTONS.map((button) => (
          <button
            key={button.label}
            type="button"
            className="axion-button text-sm"
            aria-label={`${title}: ${button.label}`}
            onClick={() => onInsert(button.text, button.cursorOffset)}
          >
            {button.label}
          </button>
        ))}
      </div>
    </section>
  );
}
