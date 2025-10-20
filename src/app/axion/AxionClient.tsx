"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxionHero } from "./components/AxionHero";
import { CalcInput, type CalcInputHandle } from "./components/CalcInput";
import { Keypad } from "./components/Keypad";
import { ResultPane } from "./components/ResultPane";
import { HelpModal, type HelpModalHandle } from "./components/HelpModal";
import { ThemeToggle } from "./components/ThemeToggle";
import { LanguageProvider, useI18n, type Locale } from "./lib/i18n/context";
import { useKatex } from "./lib/hooks/useKatex";
import {
  analyzeExpression,
  type EvaluationFailure,
  type EvaluationSuccess,
} from "./lib/algebra/engine";
import type { ShortcutAction } from "./lib/utils/keyboard";
import { NotebookPane } from "./components/NotebookPane";
import { useNotebook } from "./lib/notebook/useNotebook";
import type { NotebookCell } from "./lib/notebook/types";
import { exportNotebookToMarkdown } from "./lib/notebook/export";
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
  const [notebook, notebookActions] = useNotebook();
  const [result, setResult] = useState<EvaluationSuccess | null>(null);
  const [error, setError] = useState<EvaluationFailure | null>(null);
  const pendingEditCellIdRef = useRef<string | null>(null);
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
      pendingEditCellIdRef.current = null;
      return;
    }

    const evaluation = analyzeExpression(input);

    const pendingEditCellId = pendingEditCellIdRef.current;
    if (pendingEditCellId) {
      notebookActions.replaceInput(pendingEditCellId, input);
      pendingEditCellIdRef.current = null;
    }

    if (evaluation.ok) {
      setResult(evaluation);
      setError(null);
      notebookActions.appendSuccess(input, evaluation);
      historyCursorRef.current = null;
    } else {
      setResult(null);
      setError(evaluation);
      notebookActions.appendError(input, evaluation);
    }
  }, [input, notebookActions, pendingEditCellIdRef, t]);

  const navigateHistory = useCallback(
    (direction: HistoryDirection) => {
      const navigable = notebook.cells.filter(
        (cell) => cell.payload.type === "success" && !cell.pinned,
      );
      if (!navigable.length) return;

      let cursor = historyCursorRef.current;

      pendingEditCellIdRef.current = null;

      if (direction === "prev") {
        if (cursor === null) {
          previousInputRef.current = input;
          cursor = 0;
        } else {
          cursor = Math.min(cursor + 1, navigable.length - 1);
        }

        const cell = navigable[cursor]!;
        setInput(cell.input);
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
      const cell = navigable[cursor]!;
      setInput(cell.input);
      historyCursorRef.current = cursor;
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [input, notebook.cells, pendingEditCellIdRef],
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
          pendingEditCellIdRef.current = null;
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
    [evaluateExpression, navigateHistory, pendingEditCellIdRef, toggleTheme],
  );

  const loadCellIntoInput = useCallback(
    (cell: NotebookCell) => {
      setInput(cell.input);
      setResult(null);
      setError(null);
      historyCursorRef.current = null;
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [],
  );

  const handleRestore = useCallback(
    (id: string) => {
      const cell = notebook.cells.find((item) => item.id === id);
      if (!cell) return;
      pendingEditCellIdRef.current = null;
      loadCellIntoInput(cell);
    },
    [loadCellIntoInput, notebook.cells, pendingEditCellIdRef],
  );

  const handleDuplicateAndEdit = useCallback(
    (id: string) => {
      const cell = notebook.cells.find((item) => item.id === id);
      if (!cell) return;
      pendingEditCellIdRef.current = id;
      loadCellIntoInput(cell);
    },
    [loadCellIntoInput, notebook.cells, pendingEditCellIdRef],
  );

  const handleCopy = useCallback(
    async (id: string) => {
      const cell = notebook.cells.find((item) => item.id === id);
      if (!cell || typeof navigator === "undefined" || !navigator.clipboard) {
        return;
      }
      if (cell.payload.type !== "success") {
        const payload = `${cell.input}\nError: ${cell.payload.error.message}`;
        await navigator.clipboard.writeText(payload);
        setClipboardStatus(t("clipboard.success"));
        return;
      }

      const approxText = cell.payload.evaluation.approx ?? "n/a";
      const payload = `${cell.input}\nExact: ${cell.payload.evaluation.exact}\n~= ${approxText}`;
      await navigator.clipboard.writeText(payload);
      setClipboardStatus(t("clipboard.success"));
    },
    [notebook.cells, t],
  );

  const handlePin = useCallback(
    (id: string) => {
      notebookActions.togglePin(id);
    },
    [notebookActions],
  );

  const handleRemove = useCallback(
    (id: string) => {
      notebookActions.remove(id);
    },
    [notebookActions],
  );

  const handleReorder = useCallback(
    (sourceId: string, targetId: string) => {
      notebookActions.reorder(sourceId, targetId);
    },
    [notebookActions],
  );

  const handleExportNotebook = useCallback(async () => {
    try {
      await exportNotebookToMarkdown(notebook.cells);
      setClipboardStatus(t("notebook.exported", "Notebook geëxporteerd"));
    } catch (error) {
      console.warn("Failed to export notebook", error);
      setClipboardStatus(t("notebook.exportError", "Export mislukt"));
    }
  }, [notebook.cells, t]);

  const handleLocaleChange = useCallback(
    (nextLocale: Locale) => {
      setLocale(nextLocale);
    },
    [setLocale],
  );

  const examples = useMemo(() => dictionary.examples ?? [], [dictionary.examples]);

  const workspaceCopy = useMemo(() => {
    const { quickHeading, quickDescription, examplesHeading } = dictionary.workspace ?? {};

    return {
      quickHeading: quickHeading ?? t("help.subtitle"),
      quickDescription: quickDescription ?? t("hero.subtitle"),
      examplesHeading: examplesHeading ?? t("help.examples"),
    };
  }, [dictionary.workspace, t]);

  const exampleSuggestions = useMemo(() => examples.slice(0, 4), [examples]);

  const handleExample = useCallback(
    (example: string) => {
      pendingEditCellIdRef.current = null;
      setInput(example);
      setResult(null);
      setError(null);
      historyCursorRef.current = null;
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [pendingEditCellIdRef],
  );

  return (
    <main
      id="axion-main"
      className="axion-shell mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8"
    >
      <section className="axion-shell__header grid gap-6 xl:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)] xl:items-start">
        <AxionHero />
        <aside className="axion-panel axion-shell__quick space-y-5 p-5">
          <header className="space-y-2 text-left">
            <p className="axion-shell__eyebrow text-xs uppercase tracking-[0.35em] text-[var(--ax-muted)]">
              {workspaceCopy.quickHeading}
            </p>
            <p className="text-sm text-[rgba(255,255,255,0.72)]">
              {workspaceCopy.quickDescription}
            </p>
          </header>
          <div className="flex flex-wrap items-center gap-2">
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
          {exampleSuggestions.length ? (
            <div className="space-y-3">
              <p className="axion-shell__eyebrow text-xs uppercase tracking-[0.35em] text-[var(--ax-muted)]">
                {workspaceCopy.examplesHeading}
              </p>
              <div className="axion-shell__examples flex flex-wrap gap-2">
                {exampleSuggestions.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="axion-shell__example-chip axion-button axion-button--ghost text-xs"
                    onClick={() => handleExample(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="axion-shell__workspace flex flex-col gap-6 xl:grid xl:grid-cols-12 xl:gap-8">
        <div className="order-1 flex flex-col gap-6 xl:order-none xl:col-span-7 xl:row-start-1">
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
        </div>
        <div className="order-2 xl:order-none xl:col-span-5 xl:row-start-1">
          <Keypad
            onInsert={(text, offset) => inputRef.current?.insert(text, offset)}
          />
        </div>
        <div className="order-3 xl:order-none xl:col-span-7 xl:row-start-2">
          <ResultPane
            result={result}
            error={error}
            expression={input}
            katex={katex}
          />
        </div>
        <div className="order-4 xl:order-none xl:col-span-5 xl:row-start-2">
          <NotebookPane
            cells={notebook.cells}
            onRestore={handleRestore}
            onDuplicateAndEdit={handleDuplicateAndEdit}
            onCopy={handleCopy}
            onTogglePin={handlePin}
            onRemove={handleRemove}
            onReorder={handleReorder}
            onExportMarkdown={handleExportNotebook}
            katex={katex}
            statusMessage={clipboardStatus}
          />
        </div>
      </section>
    </main>
  );
}
