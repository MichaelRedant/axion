"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxionHero } from "./components/AxionHero";
import { CalcInput, type CalcInputHandle } from "./components/CalcInput";
import { Keypad } from "./components/Keypad";
import { ResultPane } from "./components/ResultPane";
import { HistoryPane } from "./components/HistoryPane";
import { HelpModal, type HelpModalHandle } from "./components/HelpModal";
import { ThemeToggle } from "./components/ThemeToggle";
import { LanguageProvider, useI18n, type Locale } from "./lib/i18n/context";
import { useKatex } from "./lib/hooks/useKatex";
import {
  analyzeExpression,
  type EvaluationFailure,
  type EvaluationSuccess,
} from "./lib/algebra/engine";
import { addEntry, createEntry, togglePin, type HistoryState } from "./lib/utils/history";
import type { ShortcutAction } from "./lib/utils/keyboard";
import "./styles.css";

const THEME_STORAGE_KEY = "axion-theme"; // legacy key, kept for backward compatibility

const THEME_CLASS_MAP: Record<string, string> = {
  neon: "theme-neon",
  retro: "theme-retro",
  dark: "theme-dark",
};

type HistoryDirection = "prev" | "next";

export default function AxionClient() {
  return (
    <LanguageProvider>
      <AxionShell />
    </LanguageProvider>
  );
}

function AxionShell() {
  const { t, setLocale, dictionary, locale } = useI18n();
  const katex = useKatex();

  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryState>({ entries: [] });
  const [result, setResult] = useState<EvaluationSuccess | null>(null);
  const [error, setError] = useState<EvaluationFailure | null>(null);
  const [clipboardStatus, setClipboardStatus] = useState<string | null>(null);
  const [theme, setThemeState] = useState("neon");

  const inputRef = useRef<CalcInputHandle | null>(null);
  const helpRef = useRef<HelpModalHandle | null>(null);
  const previousInputRef = useRef<string>("");
  const historyCursorRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && stored in THEME_CLASS_MAP) {
      setThemeState(stored);
    } else if (stored === "dark") {
      setThemeState("dark");
    } else {
      setThemeState("neon");
    }
  }, []);

  useEffect(() => {
    const className = THEME_CLASS_MAP[theme] ?? "theme-neon";
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.remove(...Object.values(THEME_CLASS_MAP));
    document.documentElement.classList.add(className);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!clipboardStatus) return;
    const timeout = window.setTimeout(() => setClipboardStatus(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [clipboardStatus]);

  const evaluateExpression = useCallback(() => {
    if (!input.trim()) {
      setResult(null);
      setError({ ok: false, message: t("errors.empty"), position: 0 });
      return;
    }

    const evaluation = analyzeExpression(input);

    if (evaluation.ok) {
      setResult(evaluation);
      setError(null);
      setHistory((state) =>
        addEntry(
          state,
          createEntry({
            input,
            exact: evaluation.exact,
            approx: evaluation.approx,
          }),
        ),
      );
      historyCursorRef.current = null;
    } else {
      setResult(null);
      setError(evaluation);
    }
  }, [input, t]);

  const navigateHistory = useCallback(
    (direction: HistoryDirection) => {
      const navigable = history.entries.filter((entry) => !entry.pinned);
      if (!navigable.length) return;

      let cursor = historyCursorRef.current;

      if (direction === "prev") {
        if (cursor === null) {
          previousInputRef.current = input;
          cursor = 0;
        } else {
          cursor = Math.min(cursor + 1, navigable.length - 1);
        }

        const entry = navigable[cursor]!;
        setInput(entry.input);
        historyCursorRef.current = cursor;
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      if (cursor === null) {
        return;
      }

      if (cursor === 0) {
        historyCursorRef.current = null;
        setInput(previousInputRef.current);
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      cursor -= 1;
      const entry = navigable[cursor]!;
      setInput(entry.input);
      historyCursorRef.current = cursor;
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [history.entries, input],
  );

  const toggleTheme = useCallback(
    (next?: string) => {
      if (next) {
        setThemeState(next);
        return;
      }
      setThemeState((current) => (current === "neon" ? "retro" : current === "retro" ? "dark" : "neon"));
    },
    [],
  );

  const handleShortcut = useCallback(
    (action: ShortcutAction) => {
      switch (action) {
        case "evaluate":
          evaluateExpression();
          break;
        case "clear":
          setInput("");
          setResult(null);
          setError(null);
          historyCursorRef.current = null;
          break;
        case "historyPrev":
          navigateHistory("prev");
          break;
        case "historyNext":
          navigateHistory("next");
          break;
        case "help":
          helpRef.current?.open();
          break;
        case "toggleTheme":
          toggleTheme();
          break;
        default:
          break;
      }
    },
    [evaluateExpression, navigateHistory, toggleTheme],
  );

  const handleRestore = useCallback(
    (id: string) => {
      const entry = history.entries.find((item) => item.id === id);
      if (!entry) return;
      setInput(entry.input);
      setResult(null);
      setError(null);
      historyCursorRef.current = null;
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [history.entries],
  );

  const handleCopy = useCallback(
    async (id: string) => {
      const entry = history.entries.find((item) => item.id === id);
      if (!entry || typeof navigator === "undefined" || !navigator.clipboard) {
        return;
      }
      const approxText = entry.approx ?? "n/a";
      const payload = `${entry.input}\nExact: ${entry.exact}\n~= ${approxText}`;
      await navigator.clipboard.writeText(payload);
      setClipboardStatus(t("clipboard.success"));
    },
    [history.entries, t],
  );

  const handlePin = useCallback(
    (id: string) => {
      setHistory((state) => togglePin(state, id));
    },
    [],
  );

  const handleLocaleChange = useCallback(
    (nextLocale: Locale) => {
      setLocale(nextLocale);
    },
    [setLocale],
  );

  const examples = useMemo(() => dictionary.examples ?? [], [dictionary.examples]);

  return (
    <main
      id="axion-main"
      className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-5 py-10"
    >
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <AxionHero />
        <div className="flex gap-2">
          <ThemeToggle
            value={theme}
            onToggle={() => toggleTheme()}
            labels={{
              neon: t("theme.enable"),
              retro: t("theme.retro"),
              dark: t("theme.disable"),
              default: t("theme.enable"),
            }}

          />
          <HelpModal
            ref={helpRef}
            locale={locale as Locale}
            onLocaleChange={handleLocaleChange}
            examples={examples}
          />
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <CalcInput
            ref={inputRef}
            value={input}
            onChange={(value) => {
              setInput(value);
              historyCursorRef.current = null;
            }}
            onShortcut={handleShortcut}
            label={t("input.label")}
            placeholder={t("input.placeholder")}
            evaluateLabel={t("input.evaluate")}
            clearLabel={t("input.clear")}
            errorPosition={error?.position ?? null}
          />
          <ResultPane
            result={result}
            error={error}
            expression={input}
            katex={katex}
          />
        </div>
        <div className="flex flex-col gap-6">
          <Keypad
            onInsert={(text, offset) => inputRef.current?.insert(text, offset)}
          />
          <HistoryPane
            entries={history.entries}
            onRestore={handleRestore}
            onPin={handlePin}
            onCopy={handleCopy}
            katex={katex}
            statusMessage={clipboardStatus}
          />
        </div>
      </section>
    </main>
  );
}
