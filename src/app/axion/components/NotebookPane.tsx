"use client";

import { useMemo, useState, type DragEvent } from "react";
import type { KatexHandle } from "../lib/hooks/useKatex";
import { useI18n } from "../lib/i18n/context";
import type { NotebookCell } from "../lib/notebook/types";
import { ExplainAccordion } from "./ExplainAccordion";
import "../styles.css";

interface NotebookPaneProps {
  readonly cells: NotebookCell[];
  readonly katex: KatexHandle | null;
  readonly statusMessage?: string | null;
  readonly onClearUnpinned?: () => void;
  readonly onRestore: (id: string) => void;
  readonly onDuplicateAndEdit: (id: string) => void;
  readonly onCopy: (id: string) => void;
  readonly onTogglePin?: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onReorder: (sourceId: string, targetId: string) => void;
  readonly onExportMarkdown: () => Promise<void> | void;
}

export function NotebookPane({
  cells,
  katex,
  statusMessage,
  onClearUnpinned,
  onRestore,
  onDuplicateAndEdit,
  onCopy,
  onTogglePin,
  onRemove,
  onReorder,
  onExportMarkdown,
}: NotebookPaneProps) {
  const { t, locale } = useI18n();
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [locale],
  );

  const handleDragStart = (id: string, event: DragEvent<HTMLLIElement>) => {
    setDraggedId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const handleDrop = (id: string, event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    const source = draggedId ?? event.dataTransfer.getData("text/plain");
    if (!source || source === id) {
      setDraggedId(null);
      return;
    }
    onReorder(source, id);
    setDraggedId(null);
  };

  return (
    <section className="axion-panel axion-panel--history flex flex-col gap-4 p-5 xl:max-h-[calc(100vh-320px)] xl:overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.3em] text-[var(--ax-muted)]">
        <span>{t("notebook.title", "Notebook")}</span>
        <div className="flex flex-wrap items-center gap-2">
          {onClearUnpinned ? (
            <button
              type="button"
              className="axion-button axion-button--ghost text-[11px]"
              onClick={() => onClearUnpinned()}
            >
              {t("notebook.clearUnpinned", "Wis niet-vastgezette")}
            </button>
          ) : null}
          <button
            type="button"
            className="axion-button axion-button--ghost text-[11px]"
            onClick={() => onExportMarkdown()}
          >
            {t("notebook.export", "Exporteer Markdown")}
          </button>
          {statusMessage ? (
            <span aria-live="assertive" className="text-[11px] uppercase tracking-[0.25em] text-amber-300">
              {statusMessage}
            </span>
          ) : null}
        </div>
      </header>

      {cells.length === 0 ? (
        <p className="text-sm text-[rgba(255,255,255,0.55)]">{t("notebook.empty", "Nog geen cellen")}</p>
      ) : (
        <ul className="axion-history-list flex-1 space-y-3 overflow-y-auto pr-1">
          {cells.map((cell) => {
            const formattedTime = formatter.format(new Date(cell.createdAt));
            const isDragged = draggedId === cell.id;
            const output = cell.output;
            const pinned = ((cell as { pinned?: boolean }).pinned ?? false) === true;

            let exactHtml: string | null = null;
            if (output?.type === "success" && katex) {
              try {
                exactHtml = katex.renderToString(output.evaluation.exact);
              } catch {
                exactHtml = null;
              }
            }

            return (
              <li
                key={cell.id}
                draggable
                onDragStart={(event) => handleDragStart(cell.id, event)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(cell.id, event)}
                onDragEnd={handleDragEnd}
                className={`axion-metric-card space-y-3 ${isDragged ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[rgba(255,255,255,0.55)]">
                  <span>{formattedTime}</span>
                  <div className="flex items-center gap-2">
                    <span className="cursor-grab text-[10px] uppercase tracking-[0.2em] text-[var(--ax-muted)]">
                      {t("notebook.drag", "slepen")}
                    </span>
                    {pinned ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,184,0,0.4)] px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[#ffb347]">
                        {t("history.pinnedLabel")}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <div className="font-mono text-[rgba(255,255,255,0.75)]">{cell.input}</div>
                  <div className="mt-2 text-base" data-testid={`notebook-${cell.id}`}>
                    {output?.type === "success" ? (
                      exactHtml ? (
                        <span dangerouslySetInnerHTML={{ __html: exactHtml }} />
                      ) : (
                        <code className="font-mono text-sm text-[var(--ax-muted)]">
                          {output.evaluation.exact}
                        </code>
                      )
                    ) : output?.type === "error" ? (
                      <p className="font-mono text-sm text-rose-200">{output.error.message}</p>
                    ) : (
                      <p className="text-sm text-[rgba(255,255,255,0.45)]">
                        {t("notebook.pending", "Nog geen evaluatie")}
                      </p>
                    )}
                  </div>
                  {output?.type === "success" && output.evaluation.approx ? (
                    <p className="mt-2 font-mono text-xs text-amber-200">~= {output.evaluation.approx}</p>
                  ) : null}
                  {output?.type === "success" ? (
                    <ExplainAccordion
                      className="mt-3"
                      followUps={output.evaluation.solution.followUps ?? []}
                    />
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="axion-button axion-button--ghost text-xs"
                    onClick={() => onRestore(cell.id)}
                  >
                    {t("history.restore")}
                  </button>
                  <button
                    type="button"
                    className="axion-button axion-button--ghost text-xs"
                    onClick={() => onDuplicateAndEdit(cell.id)}
                  >
                    {t("notebook.duplicateEdit", "Duplicate & edit")}
                  </button>
                  <button
                    type="button"
                    className="axion-button axion-button--ghost text-xs"
                    onClick={() => onCopy(cell.id)}
                  >
                    {t("history.copy")}
                  </button>
                  {onTogglePin ? (
                    <button
                      type="button"
                      className="axion-button axion-button--ghost text-xs"
                      onClick={() => onTogglePin(cell.id)}
                    >
                      {pinned ? t("history.unpin") : t("history.pin")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="axion-button axion-button--ghost text-xs"
                    onClick={() => onRemove(cell.id)}
                  >
                    {t("notebook.remove", "Verwijder")}
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
