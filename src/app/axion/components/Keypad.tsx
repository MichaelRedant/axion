"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { useI18n } from "../lib/i18n/context";
import "../styles.css";

interface KeypadProps {
  readonly onInsert: (text: string, cursorOffset?: number) => void;
  readonly favoriteKeyIds?: readonly string[];
}

type KeyVariant = "function" | "operator" | "numeric" | "constant" | "utility" | "variable";

interface KeypadButton {
  readonly id: string;
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
      {
        id: "trig-sin",
        label: "sin",
        text: "sin()",
        cursorOffset: 1,
        variant: "function",
      },
      {
        id: "trig-cos",
        label: "cos",
        text: "cos()",
        cursorOffset: 1,
        variant: "function",
      },
      {
        id: "trig-tan",
        label: "tan",
        text: "tan()",
        cursorOffset: 1,
        variant: "function",
      },
      {
        id: "trig-asin",
        label: "asin",
        text: "asin()",
        cursorOffset: 1,
        variant: "function",
      },
      {
        id: "trig-acos",
        label: "acos",
        text: "acos()",
        cursorOffset: 1,
        variant: "function",
      },
      {
        id: "trig-atan",
        label: "atan",
        text: "atan()",
        cursorOffset: 1,
        variant: "function",
      },
    ],
  },
  {
    id: "logarithms",
    titleKey: "keypad.groups.log",
    columns: 3,
    defaultOpen: false,
    buttons: [
      { id: "log-ln", label: "ln", text: "ln()", cursorOffset: 1, variant: "function" },
      { id: "log-log", label: "log", text: "log()", cursorOffset: 1, variant: "function" },
      {
        id: "log-log10",
        label: "log10",
        text: "log(,10)",
        cursorOffset: 4,
        variant: "function",
        ariaLabel: "log base 10",
      },
      { id: "log-exp", label: "exp", text: "exp()", cursorOffset: 1, variant: "function" },
      {
        id: "log-sqrt",
        label: "sqrt",
        text: "sqrt()",
        cursorOffset: 1,
        variant: "function",
        ariaLabel: "square root",
      },
      {
        id: "log-abs",
        label: "abs",
        text: "abs()",
        cursorOffset: 1,
        variant: "function",
        ariaLabel: "absolute value",
      },
    ],
  },
  {
    id: "algebra",
    titleKey: "keypad.groups.algebra",
    columns: 4,
    defaultOpen: true,
    buttons: [
      {
        id: "algebra-square",
        label: "x^2",
        text: "^2",
        variant: "operator",
        ariaLabel: "square power",
      },
      {
        id: "algebra-cube",
        label: "x^3",
        text: "^3",
        variant: "operator",
        ariaLabel: "cube power",
      },
      {
        id: "algebra-power",
        label: "x^y",
        text: "^",
        variant: "operator",
        ariaLabel: "power",
      },
      {
        id: "algebra-inverse",
        label: "x^-1",
        text: "^-1",
        variant: "operator",
        ariaLabel: "inverse power",
      },
      {
        id: "algebra-parentheses",
        label: "()",
        text: "()",
        cursorOffset: 1,
        variant: "utility",
        ariaLabel: "parentheses",
      },
      {
        id: "algebra-brackets",
        label: "[]",
        text: "[]",
        cursorOffset: 1,
        variant: "utility",
        ariaLabel: "brackets",
      },
      {
        id: "algebra-braces",
        label: "{}",
        text: "{}",
        cursorOffset: 1,
        variant: "utility",
        ariaLabel: "braces",
      },
      { id: "algebra-plus", label: "+", text: "+", variant: "operator" },
      { id: "algebra-minus", label: "-", text: "-", variant: "operator" },
      {
        id: "algebra-multiply",
        label: "mul",
        text: "*",
        variant: "operator",
        ariaLabel: "multiply",
      },
      {
        id: "algebra-divide",
        label: "div",
        text: "/",
        variant: "operator",
        ariaLabel: "divide",
      },
      { id: "algebra-equals", label: "=", text: "=", variant: "operator" },
      {
        id: "algebra-comma",
        label: ",",
        text: ",",
        variant: "utility",
        ariaLabel: "comma",
      },
      {
        id: "algebra-factorial",
        label: "!",
        text: "fact()",
        cursorOffset: 1,
        variant: "operator",
        ariaLabel: "factorial",
      },
    ],
  },
  {
    id: "numbers",
    titleKey: "keypad.groups.numbers",
    columns: 4,
    defaultOpen: true,
    buttons: [
      { id: "numbers-7", label: "7", text: "7", variant: "numeric" },
      { id: "numbers-8", label: "8", text: "8", variant: "numeric" },
      { id: "numbers-9", label: "9", text: "9", variant: "numeric" },
      {
        id: "numbers-negate",
        label: "+/-",
        text: "-",
        variant: "operator",
        ariaLabel: "negate sign",
      },
      { id: "numbers-4", label: "4", text: "4", variant: "numeric" },
      { id: "numbers-5", label: "5", text: "5", variant: "numeric" },
      { id: "numbers-6", label: "6", text: "6", variant: "numeric" },
      {
        id: "numbers-percent",
        label: "%",
        text: "/100",
        variant: "operator",
        ariaLabel: "percent",
      },
      { id: "numbers-1", label: "1", text: "1", variant: "numeric" },
      { id: "numbers-2", label: "2", text: "2", variant: "numeric" },
      { id: "numbers-3", label: "3", text: "3", variant: "numeric" },
      {
        id: "numbers-decimal",
        label: ".",
        text: ".",
        variant: "numeric",
        ariaLabel: "decimal point",
      },
      { id: "numbers-0", label: "0", text: "0", variant: "numeric" },
      { id: "numbers-00", label: "00", text: "00", variant: "numeric" },
      {
        id: "numbers-colon",
        label: ":",
        text: ":",
        variant: "utility",
        ariaLabel: "ratio",
      },
      {
        id: "numbers-semicolon",
        label: ";",
        text: ";",
        variant: "utility",
        ariaLabel: "separator",
      },
    ],
  },
  {
    id: "constants",
    titleKey: "keypad.groups.constants",
    columns: 3,
    defaultOpen: false,
    buttons: [
      { id: "constants-pi", label: "pi", text: "pi", variant: "constant" },
      { id: "constants-e", label: "e", text: "e", variant: "constant" },
      {
        id: "constants-phi",
        label: "phi",
        text: "1.61803398875",
        variant: "constant",
        ariaLabel: "phi constant",
      },
    ],
  },
  {
    id: "variables",
    titleKey: "keypad.groups.variables",
    columns: 6,
    defaultOpen: false,
    buttons: LETTERS.map((letter) => ({
      id: `variables-${letter}`,
      label: letter.toUpperCase(),
      text: letter,
      variant: "variable",
      ariaLabel: `insert ${letter}`,
    })),
  },
];

const DEFAULT_FAVORITE_KEY_IDS = [
  "trig-sin",
  "trig-cos",
  "log-sqrt",
  "constants-pi",
  "algebra-parentheses",
  "numbers-decimal",
] as const;

export function Keypad({ onInsert, favoriteKeyIds }: KeypadProps) {
  const { t } = useI18n();

  const title = useMemo(() => t("keypad.title"), [t]);
  const legend = useMemo(() => t("keypad.legend"), [t]);
  const quickAccessTitle = useMemo(() => t("keypad.quick.title"), [t]);
  const groups = useMemo(
    () =>
      KEYPAD_LAYOUT.map((group) => ({
        ...group,
        title: t(group.titleKey),
      })),
    [t],
  );
  const buttonLookup = useMemo(() => {
    const lookup = new Map<
      string,
      { button: KeypadButton; groupTitle: string }
    >();

    for (const group of groups) {
      for (const button of group.buttons) {
        lookup.set(button.id, { button, groupTitle: group.title });
      }
    }

    return lookup;
  }, [groups]);
  const favoriteButtons = useMemo(() => {
    const ids = favoriteKeyIds ?? DEFAULT_FAVORITE_KEY_IDS;
    const seen = new Set<string>();
    const entries: Array<{ button: KeypadButton; groupTitle: string }> = [];

    for (const id of ids) {
      if (seen.has(id)) {
        continue;
      }

      const entry = buttonLookup.get(id);
      if (entry) {
        seen.add(id);
        entries.push(entry);
      }
    }

    return entries;
  }, [buttonLookup, favoriteKeyIds]);

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
      {favoriteButtons.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] uppercase tracking-[0.25em] text-[rgba(255,255,255,0.45)]">
            {quickAccessTitle}
          </h3>
          <div className="flex flex-wrap gap-2">
            {favoriteButtons.map(({ button, groupTitle }) => (
              <button
                key={`favorite-${button.id}`}
                type="button"
                className={clsx(
                  "axion-button text-sm",
                  `axion-button--${button.variant}`,
                )}
                aria-label={button.ariaLabel ?? `${groupTitle}: ${button.label}`}
                onClick={() => onInsert(button.text, button.cursorOffset)}
              >
                {button.label}
              </button>
            ))}
          </div>
        </div>
      )}
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
                  key={button.id}
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
