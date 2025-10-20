"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { KatexHandle } from "../../lib/hooks/useKatex";
import { useI18n } from "../../lib/i18n/context";
import type { NotebookCell as NotebookCellModel } from "../../lib/notebook/types";
import { NotebookCell, type NotebookCellHandle } from "./NotebookCell";

interface NotebookProps {
  readonly cells: NotebookCellModel[];
  readonly selectedId: string | null;
  readonly katex: KatexHandle | null;
  readonly onCreateCell: (options?: { afterId?: string | null }) => string;
  readonly onSelect: (id: string) => void;
  readonly onChangeInput: (id: string, value: string) => void;
  readonly onEvaluate: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onActiveInputChange?: (handle: NotebookCellHandle | null) => void;
}

export function Notebook({
  cells,
  selectedId,
  katex,
  onCreateCell,
  onSelect,
  onChangeInput,
  onEvaluate,
  onRemove,
  onActiveInputChange,
}: NotebookProps) {
  const { t } = useI18n();
  const cellRefs = useRef(new Map<string, NotebookCellHandle>());

  const registerRef = useCallback(
    (id: string, handle: NotebookCellHandle | null) => {
      if (handle) {
        cellRefs.current.set(id, handle);
      } else {
        cellRefs.current.delete(id);
      }
      if (selectedId === id) {
        onActiveInputChange?.(handle);
      }
    },
    [selectedId, onActiveInputChange],
  );

  useEffect(() => {
    if (!selectedId) {
      onActiveInputChange?.(null);
      return;
    }
    onActiveInputChange?.(cellRefs.current.get(selectedId) ?? null);
  }, [selectedId, onActiveInputChange]);

  const handleAddCell = useCallback(() => {
    const anchorId = selectedId ?? cells[cells.length - 1]?.id ?? null;
    const id = onCreateCell({ afterId: anchorId });
    requestAnimationFrame(() => cellRefs.current.get(id)?.focus());
  }, [cells, onCreateCell, selectedId]);

  const emptyState = useMemo(
    () => (
      <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.2)] p-8 text-center text-sm text-[rgba(255,255,255,0.55)]">
        <p>{t("notebook.empty", "Add your first cell to get started")}</p>
        <button
          type="button"
          className="mt-4 axion-button axion-button--primary text-xs"
          onClick={handleAddCell}
        >
          {t("notebook.addCell", "Add cell")}
        </button>
      </div>
    ),
    [handleAddCell, t],
  );

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm uppercase tracking-[0.3em] text-[var(--ax-muted)]">
            {t("notebook.title", "Notebook")}
          </h2>
          <p className="text-xs text-[rgba(255,255,255,0.5)]">
            {t("notebook.subtitle", "Evaluate expressions cell by cell.")}
          </p>
        </div>
        <button
          type="button"
          className="axion-button axion-button--ghost text-xs"
          onClick={handleAddCell}
        >
          {t("notebook.addCell", "Add cell")}
        </button>
      </header>
      <div className={clsx("flex flex-col gap-4", cells.length ? "" : "py-6")}>
        {cells.length === 0
          ? emptyState
          : cells.map((cell, index) => (
              <NotebookCell
                key={cell.id}
                ref={(handle) => registerRef(cell.id, handle)}
                cell={cell}
                index={index}
                isSelected={cell.id === selectedId}
                katex={katex}
                onSelect={() => onSelect(cell.id)}
                onChangeInput={(value) => onChangeInput(cell.id, value)}
                onEvaluate={() => onEvaluate(cell.id)}
                onAddBelow={() => {
                  const newId = onCreateCell({ afterId: cell.id });
                  requestAnimationFrame(() => cellRefs.current.get(newId)?.focus());
                }}
                onRemove={() => onRemove(cell.id)}
              />
            ))}
      </div>
    </section>
  );
}

export type { NotebookCellHandle } from "./NotebookCell";
