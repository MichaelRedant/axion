"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { EvaluationFailure, EvaluationSuccess } from "../lib/algebra/engine";
import type {
  SolutionRationale,
  SolutionRationaleMap,
} from "../lib/algebra/solution";
import type { ProblemDescriptor } from "../lib/algebra/problems";
import type { KatexHandle } from "../lib/hooks/useKatex";
import { useI18n } from "../lib/i18n/context";
import { PlotPanel } from "./plots/PlotPanel";
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
  const [activeTab, setActiveTab] = useState<ResultTab>(() =>
    hasExplainContent(result) ? "explain" : "result",
  );
  const [hasUnreadFollowUps, setHasUnreadFollowUps] = useState(false);
  const stepRefs = useRef<Map<string, HTMLDetailsElement>>(new Map());

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
  }, [result]);

  const followUps = useMemo(() => result?.solution.followUps ?? [], [result]);
  const intervals = useMemo(() => result?.solution.intervals ?? [], [result]);

  const descriptorSummary = useMemo(
    () => buildDescriptorSummary(result?.solution.descriptor, t),
    [result?.solution.descriptor, t],
  );

  const normalizedRationale = useMemo(
    () => normalizeRationale(result?.solution.rationale),
    [result?.solution.rationale],
  );

  const showRationalePreview = Boolean(
    normalizedRationale &&
      (normalizedRationale.summary ||
        normalizedRationale.method ||
        normalizedRationale.validWhen ||
        normalizedRationale.caution ||
        normalizedRationale.notes.length > 0),
  );

  const hasRationaleDetails = Boolean(normalizedRationale?.details.length);

  const hasApprox = Boolean(result?.solution.approx);
  const hasSteps = Boolean(result?.solution.steps.length);
  const hasExplainExtras = useMemo(() => hasExplainContent(result), [result]);
  const explainTabEnabled = Boolean(result);

  useEffect(() => {
    if (!result) {
      setActiveTab("result");
      setHasUnreadFollowUps(false);
      return;
    }

    setActiveTab(hasExplainContent(result) ? "explain" : "result");
  }, [result]);

  useEffect(() => {
    if (!result) {
      setHasUnreadFollowUps(false);
      return;
    }

    setHasUnreadFollowUps(Boolean(followUps.length));
  }, [result, followUps]);

  useEffect(() => {
    if (activeTab === "explain") {
      setHasUnreadFollowUps(false);
    }
  }, [activeTab]);

  const engineLabel = useMemo(() => {
    if (!result) {
      return null;
    }
    return result.engine === "maxima"
      ? t("engine.maximaBadge", "Maxima")
      : t("engine.axionBadge", "Axion");
  }, [result, t]);

  const handleFollowUp = useCallback(
    (targetStepId?: string) => {
      if (!targetStepId) {
        return;
      }
      setActiveTab("steps");
      requestAnimationFrame(() => {
        const element = stepRefs.current.get(targetStepId);
        if (element) {
          element.open = true;
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    },
    [setActiveTab],
  );

  return (
    <section
      aria-live="polite"
      aria-label={t("result.title")}
      className="axion-panel axion-panel--result relative flex flex-col gap-5 p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
        <span>{t("result.title")}</span>
        <div className="flex items-center gap-2">
          {engineLabel ? (
            <span className="rounded-full border border-[rgba(0,255,242,0.25)] px-3 py-1 text-[0.6rem] tracking-[0.35em] text-[rgba(255,255,255,0.7)]">
              {engineLabel}
            </span>
          ) : null}
          {result ? (
            <>
              <button
                type="button"
                className="axion-button axion-button--ghost text-xs"
                onClick={() => hasSteps && setActiveTab("steps")}
                disabled={!hasSteps}
              >
                {t("result.stepsButton", "Show steps")}
              </button>
              <button
                type="button"
                className="axion-button axion-button--ghost text-xs"
                onClick={() => explainTabEnabled && setActiveTab("explain")}
                disabled={!explainTabEnabled}
              >
                {t("result.explainButton")}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {result ? (
        <>
          <nav className="axion-tablist flex flex-wrap gap-2 text-xs uppercase tracking-[0.3em]">
            <TabButton
              label={t("result.nav.result", "Result")}
              active={activeTab === "result"}
              onClick={() => setActiveTab("result")}
            />
            <TabButton
              label={t("result.nav.steps", "Steps")}
              active={activeTab === "steps"}
              disabled={!hasSteps}
              onClick={() => setActiveTab("steps")}
            />
            <TabButton
              label={t("result.nav.explain", "Explain")}
              active={activeTab === "explain"}
              disabled={!explainTabEnabled}
              onClick={() => explainTabEnabled && setActiveTab("explain")}
              indicator={
                explainTabEnabled && hasUnreadFollowUps ? (
                  <span className="relative ml-2 flex h-2 w-2 items-center justify-center">
                    <span className="sr-only">{t("result.unreadExplainBadge", "New explain details available")}</span>
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(255,196,0,0.8)]"
                    />
                  </span>
                ) : null
              }
            />
          </nav>

          {activeTab === "result" ? (
            <div className="space-y-4">
              <div
                className={clsx(
                  "grid gap-4",
                  hasApprox ? "md:grid-cols-2" : "md:grid-cols-1",
                )}
              >
                <div className="axion-metric-card">
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
                  <div className="axion-metric-card border-[rgba(123,44,191,0.35)]">
                    <p className="text-xs uppercase tracking-[0.3em] text-[rgba(255,255,255,0.55)]">{t("result.approx")}</p>
                    <p className="mt-2 font-mono text-base text-amber-200" data-testid="result-approx">
                      ~ {result.solution.approx}
                    </p>
                  </div>
                ) : null}
              </div>
              {showRationalePreview && normalizedRationale ? (
                <div className="border-t border-[rgba(0,255,242,0.15)] pt-4">
                  <div className="flex flex-col gap-3 text-sm text-[rgba(255,255,255,0.75)] md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3 md:max-w-3xl">
                      <p className="text-xs uppercase tracking-[0.3em] text-[rgba(255,255,255,0.55)]">
                        {t("result.rationaleHeading", "Why this works")}
                      </p>
                      {normalizedRationale.summary ? (
                        <p className="text-base text-[var(--ax-text)]">
                          {normalizedRationale.summary}
                        </p>
                      ) : null}
                      {normalizedRationale.method ? (
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-[rgba(255,255,255,0.55)]">
                            {t("result.rationaleMethod", "Method")}
                          </p>
                          <p className="mt-1 text-[var(--ax-text)]">{normalizedRationale.method}</p>
                        </div>
                      ) : null}
                      {normalizedRationale.validWhen ? (
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-[rgba(255,255,255,0.55)]">
                            {t("result.rationaleValidWhen", "Valid when")}
                          </p>
                          <p className="mt-1 text-[var(--ax-text)]">{normalizedRationale.validWhen}</p>
                        </div>
                      ) : null}
                      {normalizedRationale.notes.length ? (
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-[rgba(255,255,255,0.55)]">
                            {t("result.rationaleNotes", "Key takeaways")}
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-5">
                            {normalizedRationale.notes.map((note, index) => (
                              <li key={`rationale-note-${index}`} className="text-[var(--ax-text)]">
                                {note}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {normalizedRationale.caution ? (
                        <div className="rounded-md border border-[rgba(255,196,0,0.25)] bg-[rgba(255,196,0,0.08)] p-3">
                          <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                            {t("result.rationaleCaution", "Caution")}
                          </p>
                          <p className="mt-1 text-sm text-amber-100">{normalizedRationale.caution}</p>
                        </div>
                      ) : null}
                    </div>
                    {hasRationaleDetails && hasExplainExtras ? (
                      <button
                        type="button"
                        className="axion-button axion-button--ghost self-start text-xs"
                        onClick={() => setActiveTab("explain")}
                      >
                        {t("result.openExplain", "Open Explain")}
                      </button>
                    ) : null}
                  </div>
                  {hasRationaleDetails && hasExplainExtras ? (
                    <p className="mt-2 text-xs text-[rgba(255,255,255,0.55)]">
                      {t("result.rationaleMore", "More detail lives in Explain mode.")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {result.solution.plotConfig ? <PlotPanel config={result.solution.plotConfig} /> : null}
            </div>
          ) : null}

          {activeTab === "steps" ? (
            <div className="space-y-3">
              {result.solution.steps.map((step, index) => {
                const latex = step.latex && katex ? katex.renderToString(step.latex) : null;
                return (
                  <details
                    key={step.id}
                    ref={(element) => {
                      if (!element) {
                        stepRefs.current.delete(step.id);
                        return;
                      }
                      stepRefs.current.set(step.id, element);
                      if (!element.dataset.initialized) {
                        element.open = index === 0;
                        element.dataset.initialized = "true";
                      }
                    }}
                    className="overflow-hidden rounded-lg border border-[rgba(0,255,242,0.15)] bg-black/40"
                  >
                    <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3">
                      <span className="font-semibold text-sm text-neon">{step.title}</span>
                      <span className="text-xs uppercase tracking-[0.25em] text-[var(--ax-muted)]">Step {index + 1}</span>
                    </summary>
                    <div className="border-t border-[rgba(0,255,242,0.15)] px-4 py-3">
                      <p className="text-sm text-[rgba(255,255,255,0.75)]">{step.description}</p>
                      {latex ? <div className="mt-2 text-base text-[var(--ax-text)]" dangerouslySetInnerHTML={{ __html: latex }} /> : null}
                      {step.expression ? (
                        <code className="mt-2 inline-block rounded bg-black/50 px-2 py-1 font-mono text-xs text-[var(--ax-muted)]">{step.expression}</code>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : null}

          {activeTab === "explain" ? (
            <div className="space-y-4">
              {descriptorSummary ? (
                <article className="axion-metric-card space-y-3">
                  <header className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
                      {t("result.explainSummaryHeading", "Problem overview")}
                    </p>
                    <p className="text-sm text-[rgba(255,255,255,0.65)]">
                      {t(
                        "result.explainSummaryIntro",
                        "Axion classified this as {{type}}. Key signals:",
                        { type: descriptorSummary.typeLabel },
                      )}
                    </p>
                  </header>
                  {descriptorSummary.fields.length ? (
                    <dl className="grid gap-2 text-sm text-[var(--ax-text)]">
                      {descriptorSummary.fields.map((field) => (
                        <div
                          key={field.id}
                          className="flex items-center justify-between rounded border border-[rgba(0,255,242,0.12)] bg-black/40 px-3 py-2"
                        >
                          <dt className="uppercase tracking-[0.25em] text-[var(--ax-muted)]">{field.label}</dt>
                          <dd className="font-mono text-[var(--ax-text)]">{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-xs text-[rgba(255,255,255,0.55)]">
                      {t("result.explainSummaryEmpty", "No extra signals detected.")}
                    </p>
                  )}
                </article>
              ) : null}
              {followUps.length ? (
                <article className="axion-metric-card space-y-3">
                  <header className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
                      {t("result.followUps")}
                    </p>
                    <p className="text-xs text-[rgba(255,255,255,0.65)]">{t("result.followUpHint")}</p>
                  </header>
                  <div className="flex flex-wrap gap-2">
                    {followUps.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className={clsx(
                          "axion-button text-xs",
                          (!action.targetStepId || !hasSteps) && "cursor-not-allowed opacity-50",
                        )}
                        onClick={() => handleFollowUp(action.targetStepId)}
                        disabled={!action.targetStepId || !hasSteps}
                        title={action.description ?? undefined}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </article>
              ) : null}
              {normalizedRationale ? (
                <article className="axion-metric-card space-y-3 text-sm text-[rgba(255,255,255,0.75)]">
                  <header className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
                      {t("result.rationaleHeading", "Why this works")}
                    </p>
                    {normalizedRationale.summary ? (
                      <p className="text-base text-[var(--ax-text)]">{normalizedRationale.summary}</p>
                    ) : null}
                  </header>
                  {normalizedRationale.method ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[rgba(255,255,255,0.55)]">
                        {t("result.rationaleMethod", "Method")}
                      </p>
                      <p className="mt-1 text-[var(--ax-text)]">{normalizedRationale.method}</p>
                    </div>
                  ) : null}
                  {normalizedRationale.validWhen ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[rgba(255,255,255,0.55)]">
                        {t("result.rationaleValidWhen", "Valid when")}
                      </p>
                      <p className="mt-1 text-[var(--ax-text)]">{normalizedRationale.validWhen}</p>
                    </div>
                  ) : null}
                  {normalizedRationale.notes.length ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[rgba(255,255,255,0.55)]">
                        {t("result.rationaleNotes", "Key takeaways")}
                      </p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-[var(--ax-text)]">
                        {normalizedRationale.notes.map((note, noteIndex) => (
                          <li key={`rationale-note-${noteIndex}`}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {normalizedRationale.caution ? (
                    <div className="rounded-md border border-[rgba(255,196,0,0.25)] bg-[rgba(255,196,0,0.08)] p-3">
                      <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                        {t("result.rationaleCaution", "Caution")}
                      </p>
                      <p className="mt-1 text-sm text-amber-100">{normalizedRationale.caution}</p>
                    </div>
                  ) : null}
                  {normalizedRationale.details.map((detail, index) => (
                    <div
                      key={`rationale-detail-${index}`}
                      className="rounded border border-[rgba(0,255,242,0.15)] bg-black/30 p-4 text-sm text-[rgba(255,255,255,0.75)]"
                    >
                      {detail.title ? (
                        <h5 className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
                          {detail.title}
                        </h5>
                      ) : null}
                      {detail.description ? (
                        <p className={clsx("text-[var(--ax-text)]", detail.title ? "mt-2" : undefined)}>
                          {detail.description}
                        </p>
                      ) : null}
                      {detail.bullets?.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--ax-text)]">
                          {detail.bullets.map((item, bulletIndex) => (
                            <li key={`rationale-detail-${index}-bullet-${bulletIndex}`}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </article>
              ) : null}
              {detailEntries.length ? (
                <article className="axion-metric-card space-y-3">
                  <h4 className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
                    {t("result.explainDetailsHeading", "Extra signals")}
                  </h4>
                  <dl className="grid gap-2 text-sm">
                    {detailEntries.map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded border border-[rgba(0,255,242,0.12)] bg-black/40 px-3 py-2"
                      >
                        <dt className="uppercase tracking-[0.25em] text-[var(--ax-muted)]">{formatLabel(key)}</dt>
                        <dd className="font-mono text-[var(--ax-text)]">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ) : null}
              {intervals.length ? (
                <article className="axion-metric-card space-y-3">
                  <h4 className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">{t("result.intervals")}</h4>
                  <ul className="space-y-1 text-sm font-mono text-[var(--ax-text)]">
                    {intervals.map((interval, index) => (
                      <li key={`interval-${index}`}>{interval.latex}</li>
                    ))}
                  </ul>
                </article>
              ) : null}
              {result.solution.roots ? (
                <article className="axion-metric-card space-y-3">
                  <h4 className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
                    {t("result.explainRootsHeading", "Roots")}
                  </h4>
                  <ul className="space-y-1 text-sm font-mono text-[var(--ax-text)]">
                    {result.solution.roots.map((root, index) => (
                      <li key={`root-${index}`}>{typeof root === "number" ? root : root.approx}</li>
                    ))}
                  </ul>
                </article>
              ) : null}
              {!hasExplainExtras ? (
                <article className="axion-metric-card space-y-2 text-sm text-[rgba(255,255,255,0.7)]">
                  <h4 className="text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
                    {t("result.explainNoDetailsTitle", "No extra explain data yet")}
                  </h4>
                  <p>
                    {t(
                      "result.explainNoDetailsBody",
                      "We still show the classification and metadata above so you can interpret the result.",
                    )}
                  </p>
                </article>
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
  indicator,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  indicator?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "axion-button axion-tab",
        active && "axion-tab--active",
        disabled && "axion-tab--disabled",
      )}
    >
      <span className="inline-flex items-center gap-2">
        {label}
        {indicator}
      </span>
    </button>
  );
}

function buildCaretLine(expression: string, position: number): string {
  const safePosition = Math.max(0, Math.min(position, expression.length));
  const prefix = " ".repeat(safePosition);
  return `${prefix}^`;
}

type Translate = (
  key: string,
  fallback?: string,
  params?: Record<string, unknown>,
) => string;

type DescriptorFieldId =
  | "variables"
  | "primaryVariable"
  | "degree"
  | "operators"
  | "functions"
  | "hasEquality"
  | "hasDifferential"
  | "hasProbability"
  | "hasOptimization"
  | "matrixDimensions"
  | "matrixOperations"
  | "limitSymbol"
  | "limitApproach"
  | "limitVariable";

interface DescriptorSummaryField {
  readonly id: DescriptorFieldId;
  readonly label: string;
  readonly value: string;
}

interface DescriptorSummary {
  readonly typeLabel: string;
  readonly fields: readonly DescriptorSummaryField[];
}

function buildDescriptorSummary(
  descriptor: ProblemDescriptor | undefined,
  t: Translate,
): DescriptorSummary | null {
  if (!descriptor) {
    return null;
  }

  const { metadata } = descriptor;
  const typeLabel = t(`result.problemType.${descriptor.type}`, descriptor.type);
  const fields: DescriptorSummaryField[] = [];

  const addField = (id: DescriptorFieldId, raw: string | null | undefined) => {
    if (!raw) {
      return;
    }
    const label = t(
      `result.explainSummaryField.${id}`,
      formatLabel(id),
    );
    fields.push({ id, label, value: raw });
  };

  const addBooleanField = (id: DescriptorFieldId, flag: boolean | undefined) => {
    if (!flag) {
      return;
    }
    addField(id, t("common.yes", "Yes"));
  };

  addField("variables", formatMetadataList(metadata.variables));
  addField("primaryVariable", metadata.primaryVariable ?? null);
  addField("degree", metadata.degree !== undefined ? String(metadata.degree) : null);
  addField("operators", formatMetadataList(metadata.operators));
  addField("functions", formatMetadataList(metadata.functions));
  addBooleanField("hasEquality", metadata.hasEquality);
  addBooleanField("hasDifferential", metadata.hasDifferential);
  addBooleanField("hasProbability", metadata.hasProbability);
  addBooleanField("hasOptimization", metadata.hasOptimization);

  if (metadata.matrix) {
    addField("matrixDimensions", formatMatrixDimensions(metadata.matrix.dimensions));
    addField("matrixOperations", formatMetadataList(metadata.matrix.operations));
  }

  if (metadata.limit) {
    addField("limitSymbol", metadata.limit.symbol);
    addField("limitApproach", metadata.limit.approaching);
    addField("limitVariable", metadata.limit.variable);
  }

  return { typeLabel, fields };
}

function formatMetadataList(values?: readonly string[]): string | null {
  if (!values || values.length === 0) {
    return null;
  }
  const unique = Array.from(new Set(values)).filter(Boolean);
  if (!unique.length) {
    return null;
  }
  return unique.join(", ");
}

function formatMatrixDimensions(
  dimensions: [number, number] | null | undefined,
): string | null {
  if (!dimensions) {
    return null;
  }
  const [rows, cols] = dimensions;
  if (rows === undefined || cols === undefined) {
    return null;
  }
  return `${rows} x ${cols}`;
}

function hasExplainContent(result: EvaluationSuccess | null): boolean {
  if (!result) {
    return false;
  }

  const { rationale, details, roots, followUps, intervals } = result.solution;
  const normalized = normalizeRationale(rationale);
  const hasExtendedRationale = Boolean(normalized?.details.length);

  return (
    hasExtendedRationale ||
    Boolean(details && Object.keys(details).length > 0) ||
    Boolean(roots?.length) ||
    Boolean(followUps?.length) ||
    Boolean(intervals?.length)
  );
}

interface NormalizedRationaleDetail {
  readonly title?: string;
  readonly description?: string;
  readonly bullets?: readonly string[];
}

interface NormalizedRationale {
  readonly summary?: string;
  readonly method?: string;
  readonly validWhen?: string;
  readonly caution?: string;
  readonly notes: readonly string[];
  readonly details: readonly NormalizedRationaleDetail[];
}

function normalizeRationale(
  rationale: SolutionRationale | undefined,
): NormalizedRationale | null {
  if (!rationale) {
    return null;
  }

  if (typeof rationale === "string") {
    const summary = rationale.trim();
    return {
      summary: summary || undefined,
      method: undefined,
      validWhen: undefined,
      caution: undefined,
      notes: [],
      details: [],
    };
  }

  if (!isRationaleMap(rationale)) {
    return null;
  }

  const handledKeys = new Set<string>();

  const summary = takeStringValue(rationale, handledKeys, [
    "summary",
    "overview",
    "description",
    "quickTake",
  ]);

  const method = takeStringValue(rationale, handledKeys, [
    "method",
    "strategy",
    "approach",
  ]);

  const validWhen = takeStringValue(rationale, handledKeys, [
    "validWhen",
    "domain",
    "conditions",
    "holdsWhen",
    "applicableWhen",
  ]);

  const caution = takeStringValue(rationale, handledKeys, [
    "caution",
    "caveats",
    "warning",
    "warnings",
  ]);

  const notes = collectStringList(rationale, handledKeys, [
    "notes",
    "insights",
    "takeaways",
    "highlights",
    "keyPoints",
  ]);

  const details: NormalizedRationaleDetail[] = [];
  for (const key of ["details", "cases", "explanations"]) {
    if (key in rationale) {
      handledKeys.add(key);
      details.push(...normalizeDetailValue(rationale[key], formatLabel(key)));
    }
  }

  for (const [key, value] of Object.entries(rationale)) {
    if (handledKeys.has(key)) {
      continue;
    }
    const normalizedDetails = normalizeDetailValue(value, formatLabel(key));
    if (normalizedDetails.length) {
      details.push(...normalizedDetails);
    }
  }

  return {
    summary,
    method,
    validWhen,
    caution,
    notes,
    details,
  };
}

function isRationaleMap(value: SolutionRationale): value is SolutionRationaleMap {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function takeStringValue(
  source: SolutionRationaleMap,
  handledKeys: Set<string>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const candidate = source[key];
    const normalized = toSingleString(candidate);
    if (normalized) {
      handledKeys.add(key);
      return normalized;
    }
  }
  return undefined;
}

function collectStringList(
  source: SolutionRationaleMap,
  handledKeys: Set<string>,
  keys: readonly string[],
): string[] {
  const list: string[] = [];
  for (const key of keys) {
    const candidate = source[key];
    const entries = toStringArray(candidate);
    if (entries.length) {
      handledKeys.add(key);
      list.push(...entries);
    }
  }
  return list;
}

function normalizeDetailValue(
  value: unknown,
  fallbackTitle?: string,
): NormalizedRationaleDetail[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    return [
      {
        title: fallbackTitle,
        description: trimmed,
      },
    ];
  }

  if (Array.isArray(value)) {
    const normalized: NormalizedRationaleDetail[] = [];
    const bullets: string[] = [];
    for (const entry of value) {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (trimmed) {
          bullets.push(trimmed);
        }
        continue;
      }
      if (entry && typeof entry === "object") {
        normalized.push(...normalizeDetailValue(entry, fallbackTitle));
      }
    }
    if (bullets.length) {
      normalized.push({ title: fallbackTitle, bullets });
    }
    return normalized;
  }

  if (typeof value === "object") {
    const detail = value as Record<string, unknown>;
    const title =
      toSingleString(detail.title) ??
      toSingleString(detail.heading) ??
      toSingleString(detail.label) ??
      fallbackTitle;
    const description =
      toSingleString(detail.description) ??
      toSingleString(detail.body) ??
      toSingleString(detail.text) ??
      toSingleString(detail.summary);
    const bullets = toStringArray(
      detail.bullets ??
        detail.items ??
        detail.points ??
        detail.steps ??
        detail.lines,
    );

    const normalized: NormalizedRationaleDetail[] = [];
    const base: NormalizedRationaleDetail = {};
    if (title) {
      base.title = title;
    }
    if (description) {
      base.description = description;
    }
    if (bullets.length) {
      base.bullets = bullets;
    }
    if (Object.keys(base).length > 0) {
      normalized.push(base);
    }

    if (detail.details) {
      normalized.push(
        ...normalizeDetailValue(detail.details, title ?? fallbackTitle),
      );
    }
    if (detail.explanations) {
      normalized.push(
        ...normalizeDetailValue(detail.explanations, title ?? fallbackTitle),
      );
    }

    return normalized;
  }

  return [];
}

function toSingleString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean)
      .join(" ");
    const trimmed = joined.trim();
    return trimmed || undefined;
  }
  return undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }
    return [];
  }
  const list: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) {
        list.push(trimmed);
      }
    }
  }
  return list;
}

function formatLabel(key: string): string {
  if (!key) {
    return "";
  }
  const spaced = key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) {
    return "";
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
