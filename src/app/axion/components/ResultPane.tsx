"use client";

import { useMemo, useState } from "react";
import type { EvaluationFailure, EvaluationSuccess } from "../lib/algebra/engine";
import type { KatexHandle } from "../lib/hooks/useKatex";
import { useI18n } from "../lib/i18n/context";
import { FunctionPlot } from "./plots/FunctionPlot";
import "../styles.css";

type ResultTab = "result" | "steps" | "explain";

interface ResultPaneProps {
  readonly result: EvaluationSuccess | null;
  readonly error: EvaluationFailure | null;
  readonly expression: string;
  readonly katex: KatexHandle | null;
}

export function ResultPane({ result, error, expression, katex }: ResultPaneProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ResultTab>("result");

  const exactHtml = useMemo(() => {
    if (!result || !katex) {
      return null;
    }
    try {
      return katex.renderToString(result.solution.exact);
    } catch {
      return null;
    }
  }, [result, katex]);

  const detailEntries = useMemo(() => {
    if (!result?.solution.details) return [] as Array<[string, unknown]>;
    return Object.entries(result.solution.details);
  }, [result?.solution.details]);

  const hasApprox = Boolean(result?.solution.approx);
  const hasSteps = Boolean(result?.solution.steps.length);
  const hasExplain = Boolean(result?.solution.rationale || detailEntries.length || result?.solution.roots?.length);

  return (
    <section aria-live="polite" aria-label={t("result.title")} className="axion-panel relative flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
        <span>{t("result.title")}</span>
        {result ? (
          <button type="button" className="axion-button text-xs" onClick={() => setActiveTab("explain")}>
            Explain mode
          </button>
        ) : null}
      </header>

      {result ? (
        <>
          <nav className="flex gap-2 text-xs uppercase tracking-[0.3em]">
            <TabButton label="Result" active={activeTab === "result"} onClick={() => setActiveTab("result")} />
            <TabButton label="Steps" active={activeTab === "steps"} disabled={!hasSteps} onClick={() => setActiveTab("steps")} />
            <TabButton label="Explain" active={activeTab === "explain"} disabled={!hasExplain} onClick={() => setActiveTab("explain")} />
          </nav>

          {activeTab === "result" ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-[rgba(0,255,242,0.2)] bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-[rgba(255,255,255,0.55)]">{t("result.exact")}</p>
                <div className="mt-2 min-h-[48px] text-lg" data-testid="result-exact">
                  {exactHtml ? (
                    <span dangerouslySetInnerHTML={{ __html: exactHtml }} />
                  ) : (
                    <code className="font-mono text-sm text-[var(--ax-muted)]">{result.solution.exact}</code>
                  )}
                </div>
              </div>
              {hasApprox ? (
                <div className="rounded-lg border border-[rgba(123,44,191,0.35)] bg-black/40 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-[rgba(255,255,255,0.55)]">{t("result.approx")}</p>
                  <p className="mt-2 font-mono text-base text-amber-200" data-testid="result-approx">
                    ≈ {result.solution.approx}
                  </p>
                </div>
              ) : null}
              {result.solution.plotConfig ? <FunctionPlot config={result.solution.plotConfig} /> : null}
            </div>
          ) : null}

          {activeTab === "steps" ? (
            <div className="space-y-3">
              {result.solution.steps.map((step) => {
                const latex = step.latex && katex ? katex.renderToString(step.latex) : null;
                return (
                  <article key={step.id} className="rounded-lg border border-[rgba(0,255,242,0.15)] bg-black/40 p-4">
                    <h3 className="font-semibold text-sm text-neon">{step.title}</h3>
                    <p className="mt-1 text-sm text-[rgba(255,255,255,0.75)]">{step.description}</p>
                    {latex ? <div className="mt-2 text-base text-[var(--ax-text)]" dangerouslySetInnerHTML={{ __html: latex }} /> : null}
                    {step.expression ? (
                      <code className="mt-2 inline-block rounded bg-black/50 px-2 py-1 font-mono text-xs text-[var(--ax-muted)]">{step.expression}</code>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}

          {activeTab === "explain" ? (
            <div className="space-y-4">
              {result.solution.rationale ? (
                <p className="text-sm text-[rgba(255,255,255,0.75)]">{result.solution.rationale}</p>
              ) : null}
              {detailEntries.length ? (
                <dl className="grid gap-2 text-sm">
                  {detailEntries.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded border border-[rgba(0,255,242,0.15)] bg-black/30 px-3 py-2">
                      <dt className="uppercase tracking-[0.25em] text-[var(--ax-muted)]">{key}</dt>
                      <dd className="font-mono text-[var(--ax-text)]">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {result.solution.roots ? (
                <div className="rounded-lg border border-[rgba(0,255,242,0.15)] bg-black/30 p-4">
                  <h4 className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">Oplossingen</h4>
                  <ul className="mt-2 space-y-1 text-sm font-mono text-[var(--ax-text)]">
                    {result.solution.roots.map((root, index) => (
                      <li key={`root-${index}`}>{typeof root === "number" ? root : root.approx}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {!result && !error ? (
        <p className="rounded-lg border border-dashed border-[rgba(0,255,242,0.25)] bg-black/30 p-4 text-sm text-[rgba(255,255,255,0.55)]">
          {t("result.empty")}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-[rgba(255,96,96,0.35)] bg-[rgba(38,15,24,0.8)] p-4 text-sm text-[#ff9c9c]">
          <p className="font-semibold uppercase tracking-[0.25em]">
            {t("result.errorPrefix")}: {error.message}
          </p>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-[#ffdede]">
            {expression || "□"}
            {"\n"}
            {buildCaretLine(expression, error.position)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}

function TabButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`axion-button ${
        active ? "border-neon text-neon" : "border-[rgba(0,255,242,0.1)] text-[var(--ax-muted)]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {label}
    </button>
  );
}

function buildCaretLine(expression: string, position: number): string {
  const safePosition = Math.max(0, Math.min(position, expression.length));
  const prefix = " ".repeat(safePosition);
  return `${prefix}^`;
}
