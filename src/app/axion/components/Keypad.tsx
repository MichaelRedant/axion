"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { useI18n } from "../lib/i18n/context";
import "../styles.css";

interface KeypadProps {
  readonly onInsert: (text: string, cursorOffset?: number) => void;
}

type KeyVariant = "function" | "operator" | "numeric" | "constant" | "utility" | "variable";

interface KeypadButton {
  readonly label: string;
  readonly text: string;
  readonly cursorOffset?: number;
  readonly ariaLabel?: string;
  readonly variant: KeyVariant;
}

interface KeypadGroup {
  readonly id: string;
  readonly titleKey: string;
  readonly columns: number;
  readonly buttons: KeypadButton[];
  readonly defaultOpen?: boolean;
}

const COLUMN_CLASSES: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

const LETTERS = Array.from({ length: 26 }, (_, index) =>
  String.fromCharCode("a".charCodeAt(0) + index),
);

const KEYPAD_LAYOUT: KeypadGroup[] = [
  {
    id: "trig",
    titleKey: "keypad.groups.trig",
    columns: 3,
    defaultOpen: true,
    buttons: [
      { label: "sin", text: "sin()", cursorOffset: 1, variant: "function" },
      { label: "cos", text: "cos()", cursorOffset: 1, variant: "function" },
      { label: "tan", text: "tan()", cursorOffset: 1, variant: "function" },
      { label: "asin", text: "asin()", cursorOffset: 1, variant: "function" },
      { label: "acos", text: "acos()", cursorOffset: 1, variant: "function" },
      { label: "atan", text: "atan()", cursorOffset: 1, variant: "function" },
    ],
  },
  {
    id: "logarithms",
    titleKey: "keypad.groups.log",
    columns: 3,
    defaultOpen: false,
    buttons: [
      { label: "ln", text: "ln()", cursorOffset: 1, variant: "function" },
      { label: "log", text: "log()", cursorOffset: 1, variant: "function" },
      { label: "log10", text: "log(,10)", cursorOffset: 4, variant: "function", ariaLabel: "log base 10" },
      { label: "exp", text: "exp()", cursorOffset: 1, variant: "function" },
      { label: "sqrt", text: "sqrt()", cursorOffset: 1, variant: "function", ariaLabel: "square root" },
      { label: "abs", text: "abs()", cursorOffset: 1, variant: "function", ariaLabel: "absolute value" },
    ],
  },
  {
    id: "algebra",
    titleKey: "keypad.groups.algebra",
    columns: 4,
    defaultOpen: true,
    buttons: [
      { label: "x^2", text: "^2", variant: "operator", ariaLabel: "square power" },
      { label: "x^3", text: "^3", variant: "operator", ariaLabel: "cube power" },
      { label: "x^y", text: "^", variant: "operator", ariaLabel: "power" },
      { label: "x^-1", text: "^-1", variant: "operator", ariaLabel: "inverse power" },
      { label: "()", text: "()", cursorOffset: 1, variant: "utility", ariaLabel: "parentheses" },
      { label: "[]", text: "[]", cursorOffset: 1, variant: "utility", ariaLabel: "brackets" },
      { label: "{}", text: "{}", cursorOffset: 1, variant: "utility", ariaLabel: "braces" },
      { label: "+", text: "+", variant: "operator" },
      { label: "-", text: "-", variant: "operator" },
      { label: "mul", text: "*", variant: "operator", ariaLabel: "multiply" },
      { label: "div", text: "/", variant: "operator", ariaLabel: "divide" },
      { label: "=", text: "=", variant: "operator" },
      { label: ",", text: ",", variant: "utility", ariaLabel: "comma" },
      { label: "!", text: "fact()", cursorOffset: 1, variant: "operator", ariaLabel: "factorial" },
    ],
  },
  {
    id: "numbers",
    titleKey: "keypad.groups.numbers",
    columns: 4,
    defaultOpen: true,
    buttons: [
      { label: "7", text: "7", variant: "numeric" },
      { label: "8", text: "8", variant: "numeric" },
      { label: "9", text: "9", variant: "numeric" },
      { label: "+/-", text: "-", variant: "operator", ariaLabel: "negate sign" },
      { label: "4", text: "4", variant: "numeric" },
      { label: "5", text: "5", variant: "numeric" },
      { label: "6", text: "6", variant: "numeric" },
      { label: "%", text: "/100", variant: "operator", ariaLabel: "percent" },
      { label: "1", text: "1", variant: "numeric" },
      { label: "2", text: "2", variant: "numeric" },
      { label: "3", text: "3", variant: "numeric" },
      { label: ".", text: ".", variant: "numeric", ariaLabel: "decimal point" },
      { label: "0", text: "0", variant: "numeric" },
      { label: "00", text: "00", variant: "numeric" },
      { label: ":", text: ":", variant: "utility", ariaLabel: "ratio" },
      { label: ";", text: ";", variant: "utility", ariaLabel: "separator" },
    ],
  },
  {
    id: "constants",
    titleKey: "keypad.groups.constants",
    columns: 3,
    defaultOpen: false,
    buttons: [
      { label: "pi", text: "pi", variant: "constant" },
      { label: "e", text: "e", variant: "constant" },
      { label: "phi", text: "1.61803398875", variant: "constant", ariaLabel: "phi constant" },
    ],
  },
  {
    id: "variables",
    titleKey: "keypad.groups.variables",
    columns: 6,
    defaultOpen: false,
    buttons: LETTERS.map((letter) => ({
      label: letter.toUpperCase(),
      text: letter,
      variant: "variable",
      ariaLabel: `insert ${letter}`,
    })),
  },
];

export function Keypad({ onInsert }: KeypadProps) {
  const { t } = useI18n();

  const title = useMemo(() => t("keypad.title"), [t]);
  const legend = useMemo(() => t("keypad.legend"), [t]);
  const groups = useMemo(
    () =>
      KEYPAD_LAYOUT.map((group) => ({
        ...group,
        title: t(group.titleKey),
      })),
    [t],
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        KEYPAD_LAYOUT.map((group) => [group.id, group.defaultOpen ?? false]),
      ),
  );

  return (
    <section
      aria-label={title}
      className="axion-panel axion-panel--keypad flex flex-col gap-5 p-5"
    >
      <header className="flex flex-col gap-2">
        <h2 className="axion-shell__eyebrow text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
          {title}
        </h2>
        <p className="text-[11px] uppercase tracking-[0.25em] text-[rgba(255,255,255,0.45)]">
          {legend}
        </p>
      </header>
      <div className="axion-keypad-groups grid gap-3 md:grid-cols-2 xl:grid-cols-1 xl:max-h-[460px] xl:overflow-y-auto xl:pr-1">
        {groups.map((group) => (
          <details
            key={group.id}
            className={clsx(
              "axion-keypad-group",
              openGroups[group.id] && "axion-keypad-group--open",
            )}
            open={openGroups[group.id]}
            onToggle={(event) => {
              const element = event.currentTarget;
              setOpenGroups((previous) => ({
                ...previous,
                [group.id]: element.open,
              }));
            }}
          >
            <summary className="axion-keypad-summary">
              <span>{group.title}</span>
              <span
                className={clsx(
                  "axion-keypad-caret",
                  openGroups[group.id] && "axion-keypad-caret--open",
                )}
                aria-hidden="true"
              >
                v
              </span>
            </summary>
            <div
              className={clsx(
                "axion-keypad-grid",
                COLUMN_CLASSES[group.columns] ?? "grid-cols-3",
              )}
            >
              {group.buttons.map((button) => (
                <button
                  key={`${group.id}-${button.label}`}
                  type="button"
                  className={clsx(
                    "axion-button text-sm",
                    `axion-button--${button.variant}`,
                  )}
                  aria-label={button.ariaLabel ?? `${group.title}: ${button.label}`}
                  onClick={() => onInsert(button.text, button.cursorOffset)}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
