"use client";

import { useMemo } from "react";
import type { HistoryEntry } from "../lib/utils/history";
import type { KatexHandle } from "../lib/hooks/useKatex";
import { useI18n } from "../lib/i18n/context";
import "../styles.css";

interface HistoryPaneProps {
  readonly entries: HistoryEntry[];
  readonly onRestore: (id: string) => void;
  readonly onPin: (id: string) => void;
  readonly onCopy: (id: string) => void;
  readonly katex: KatexHandle | null;
  readonly statusMessage?: string | null;
}

export function HistoryPane({
  entries,
  onRestore,
  onPin,
  onCopy,
  katex,
  statusMessage,
}: HistoryPaneProps) {
  const { t, locale } = useI18n();

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [locale],
  );

  return (
    <section className="axion-panel flex max-h-[360px] flex-col gap-3 overflow-hidden p-4">
      <header className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
        <span>{t("history.title")}</span>
        {statusMessage ? (
          <span aria-live="assertive" className="text-amber-300">
            {statusMessage}
          </span>
        ) : null}
      </header>

      {entries.length === 0 ? (
        <p className="text-sm text-[rgba(255,255,255,0.55)]">
          {t("history.empty")}
        </p>
      ) : (
        <ul className="flex-1 space-y-3 overflow-y-auto pr-1">
          {entries.map((entry) => {
            const formattedTime = formatter.format(new Date(entry.timestamp));
            let exactHtml: string | null = null;
            if (katex) {
              try {
                exactHtml = katex.renderToString(entry.exact);
              } catch {
                exactHtml = null;
              }
            }

            return (
              <li
                key={entry.id}
                className="rounded-lg border border-[rgba(0,255,242,0.18)] bg-black/40 p-3"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[rgba(255,255,255,0.55)]">
                  <span>{formattedTime}</span>
                  {entry.pinned ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,184,0,0.4)] px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[#ffb347]">
                      {t("history.pinnedLabel")}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-sm">
                  <div className="font-mono text-[rgba(255,255,255,0.75)]">
                    {entry.input}
                  </div>
                  <div className="mt-2 text-base" data-testid={`history-${entry.id}`}>
                    {exactHtml ? (
                      <span dangerouslySetInnerHTML={{ __html: exactHtml }} />
                    ) : (
                      <code className="font-mono text-sm text-[var(--ax-muted)]">{entry.exact}</code>
                    )}
                  </div>
                  <p className="mt-2 font-mono text-xs text-amber-200">~= {entry.approx}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="axion-button text-xs"
                    onClick={() => onRestore(entry.id)}
                  >
                    {t("history.restore")}
                  </button>
                  <button
                    type="button"
                    className="axion-button text-xs"
                    onClick={() => onCopy(entry.id)}
                  >
                    {t("history.copy")}
                  </button>
                  <button
                    type="button"
                    className="axion-button text-xs"
                    onClick={() => onPin(entry.id)}
                  >
                    {entry.pinned ? t("history.unpin") : t("history.pin")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
