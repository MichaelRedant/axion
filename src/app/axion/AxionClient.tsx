"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxionHero } from "./components/AxionHero";
import { Keypad } from "./components/Keypad";
import { HelpModal, type HelpModalHandle } from "./components/HelpModal";
import { ThemeToggle } from "./components/ThemeToggle";
import { Notebook, type NotebookCellHandle } from "./components/notebook/Notebook";
import { LanguageProvider, useI18n, type Locale } from "./lib/i18n/context";
import { useKatex } from "./lib/hooks/useKatex";
import { analyzeExpression } from "./lib/algebra/engine";
import { useNotebook } from "./lib/notebook/useNotebook";
import "./styles.css";

const THEME_STORAGE_KEY = "axion-theme"; // legacy key, kept for backward compatibility

const THEME_CLASS_MAP: Record<string, string> = {
  neon: "theme-neon",
  retro: "theme-retro",
  dark: "theme-dark",
};

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

  const [notebook, notebookActions] = useNotebook();
  const [theme, setThemeState] = useState("neon");

  const helpRef = useRef<HelpModalHandle | null>(null);
  const activeInputRef = useRef<NotebookCellHandle | null>(null);

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
    if (!notebook.cells.length) {
      notebookActions.createCell();
      return;
    }
    if (!notebook.selectedId) {
      notebookActions.select(notebook.cells[0]!.id);
    }
  }, [notebook.cells, notebook.selectedId, notebookActions]);

  const ensureActiveCell = useCallback(() => {
    if (notebook.selectedId) {
      return notebook.selectedId;
    }
    if (notebook.cells.length) {
      const firstId = notebook.cells[0]!.id;
      notebookActions.select(firstId);
      return firstId;
    }
    return notebookActions.createCell();
  }, [notebook.cells, notebook.selectedId, notebookActions]);

  const evaluateCell = useCallback(
    (id: string) => {
      const cell = notebook.cells.find((item) => item.id === id);
      if (!cell) {
        return;
      }

      if (cell.type !== "math") {
        return;
      }

      const trimmed = cell.input.trim();
      if (!trimmed) {
        notebookActions.setError(id, { ok: false, message: t("errors.empty"), position: 0 });
        return;
      }

      notebookActions.markEvaluating(id);
      const evaluation = analyzeExpression(cell.input);

      if (evaluation.ok) {
        notebookActions.setSuccess(id, evaluation);
      } else {
        notebookActions.setError(id, evaluation);
      }
    },
    [notebook.cells, notebookActions, t],
  );

  const handleInsert = useCallback((text: string, offset?: number) => {
    activeInputRef.current?.insert(text, offset);
  }, []);

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

  const handleLocaleChange = useCallback(
    (nextLocale: Locale) => {
      setLocale(nextLocale);
    },
    [setLocale],
  );

  const handleExample = useCallback(
    (example: string) => {
      const targetId = ensureActiveCell();
      notebookActions.updateInput(targetId, example);
      notebookActions.select(targetId);
      requestAnimationFrame(() => activeInputRef.current?.focus());
    },
    [ensureActiveCell, notebookActions],
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

  const handleActiveInputChange = useCallback((handle: NotebookCellHandle | null) => {
    activeInputRef.current = handle;
  }, []);

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
        <div className="order-1 flex flex-col gap-6 xl:order-none xl:col-span-7 xl:row-span-2">
          <Notebook
            cells={notebook.cells}
            selectedId={notebook.selectedId}
            katex={katex}
            onCreateCell={(options) => {
              const id = notebookActions.createCell(options);
              notebookActions.select(id);
              return id;
            }}
            onSelect={(id) => {
              notebookActions.select(id);
              requestAnimationFrame(() => activeInputRef.current?.focus());
            }}
            onChangeInput={(id, value) => notebookActions.updateInput(id, value)}
            onEvaluate={evaluateCell}
            onRemove={(id) => notebookActions.remove(id)}
            onReorder={(id, targetOrder) => notebookActions.reorder(id, targetOrder)}
            onActiveInputChange={handleActiveInputChange}
          />
        </div>
        <div className="order-2 xl:order-none xl:col-span-5 xl:row-span-2">
          <Keypad onInsert={handleInsert} />
        </div>
      </section>
    </main>
  );
}
