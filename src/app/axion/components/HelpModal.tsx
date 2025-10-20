"use client";

import type { ChangeEvent } from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { SHORTCUTS } from "../lib/utils/keyboard";
import { useI18n, type Locale } from "../lib/i18n/context";
import { Tooltip } from "./Tooltip";
import "../styles.css";

export interface HelpModalHandle {
  open: () => void;
  close: () => void;
}

interface HelpModalProps {
  readonly locale: Locale;
  readonly onLocaleChange: (locale: Locale) => void;
  readonly examples: readonly string[];
}

export const HelpModal = forwardRef<HelpModalHandle, HelpModalProps>(
  ({ locale, onLocaleChange, examples }, ref) => {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const dialogRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
    }));

    useEffect(() => {
      function handleKey(event: KeyboardEvent) {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }

      if (open) {
        document.addEventListener("keydown", handleKey);
      }

      return () => document.removeEventListener("keydown", handleKey);
    }, [open]);

    useEffect(() => {
      if (open) {
        dialogRef.current?.focus();
      }
    }, [open]);

    const handleLocaleChange = (event: ChangeEvent<HTMLSelectElement>) => {
      onLocaleChange(event.target.value as Locale);
    };

    return (
      <>
        <Tooltip content={t("help.tooltip")}>
          <button
            type="button"
            className="axion-button axion-button--ghost text-sm"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls="axion-help-dialog"
          >
            {t("help.button")}
          </button>
        </Tooltip>
        {open ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="axion-help-heading"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          >
            <div
              ref={dialogRef}
              tabIndex={-1}
              id="axion-help-dialog"
              className="axion-panel relative max-h-[80vh] w-full max-w-2xl overflow-y-auto space-y-6 p-6"
            >
              <header className="flex flex-col gap-2 text-left">
                <p className="text-xs uppercase tracking-[0.4em] text-neon">
                  {t("help.subtitle")}
                </p>
                <h2
                  id="axion-help-heading"
                  className="font-display text-3xl tracking-[0.3em] text-neon"
                >
                  {t("help.title")}
                </h2>
                <p className="text-sm text-[var(--ax-muted)]">
                  {t("help.disclaimer")}
                </p>
              </header>

              <section aria-labelledby="axion-help-shortcuts" className="space-y-3">
                <h3
                  id="axion-help-shortcuts"
                  className="text-sm uppercase tracking-[0.3em] text-[var(--ax-muted)]"
                >
                  {t("help.shortcuts")}
                </h3>
                <ul className="grid gap-2 text-sm">
                  {SHORTCUTS.filter(
                    (shortcut, index, array) =>
                      array.findIndex(
                        (item) => item.action === shortcut.action && item.keys.join("+") === shortcut.keys.join("+"),
                      ) === index,
                  ).map((shortcut) => (
                    <li
                      key={`${shortcut.action}-${shortcut.keys.join("+")}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[rgba(0,255,242,0.15)] bg-black/40 px-3 py-2"
                    >
                      <span className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">
                        {shortcut.keys.join(" + ")}
                      </span>
                      <span className="text-sm text-[rgba(255,255,255,0.75)]">
                        {t(shortcut.descriptionKey)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="axion-help-examples" className="space-y-3">
                <h3
                  id="axion-help-examples"
                  className="text-sm uppercase tracking-[0.3em] text-[var(--ax-muted)]"
                >
                  {t("help.examples")}
                </h3>
                <div className="grid gap-2 text-sm font-mono">
                  {examples.map((example) => (
                    <code
                      key={example}
                      className="rounded-md border border-[rgba(0,255,242,0.18)] bg-black/50 px-3 py-2 text-[var(--ax-muted)]"
                    >
                      {example}
                    </code>
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-2 text-sm text-[rgba(255,255,255,0.7)] sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2">
                  <span>{t("help.language")}</span>
                  <select
                    value={locale}
                    onChange={handleLocaleChange}
                    className="rounded-md border border-[rgba(0,255,242,0.3)] bg-black/70 px-3 py-2 text-xs uppercase tracking-[0.2em] text-[var(--ax-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon"
                  >
                    <option value="nl">Nederlands</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="axion-button"
                  onClick={() => setOpen(false)}
                >
                  {t("help.close")}
                </button>
              </section>
            </div>
          </div>
        ) : null}
      </>
    );
  },
);

HelpModal.displayName = "HelpModal";
