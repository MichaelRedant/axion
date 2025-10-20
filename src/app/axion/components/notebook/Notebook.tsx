"use client";

import clsx from "clsx";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import type { KatexHandle } from "../../lib/hooks/useKatex";
import { useI18n } from "../../lib/i18n/context";
import type {
  NotebookCell as NotebookCellModel,
  NotebookCellType,
} from "../../lib/notebook/types";
import { NotebookCell, type NotebookCellHandle } from "./NotebookCell";

interface NotebookProps {
  readonly cells: NotebookCellModel[];
  readonly selectedId: string | null;
  readonly katex: KatexHandle | null;
  readonly onCreateCell: (options?: { afterId?: string | null; type?: NotebookCellType }) => string;
  readonly onSelect: (id: string) => void;
  readonly onChangeInput: (id: string, value: string) => void;
  readonly onEvaluate: (id: string) => Promise<void> | void;
  readonly onRemove: (id: string) => void;
  readonly onReorder: (id: string, targetOrder: number) => void;
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
  onReorder,
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

  const createAndFocus = useCallback(
    (options?: { afterId?: string | null; type?: NotebookCellType }) => {
      const id = onCreateCell(options);
      requestAnimationFrame(() => cellRefs.current.get(id)?.focus());
      return id;
    },
    [onCreateCell],
  );

  const handleAddCell = useCallback(
    (type: NotebookCellType) => {
      const anchorId = selectedId ?? cells[cells.length - 1]?.id ?? null;
      createAndFocus({ afterId: anchorId, type });
    },
    [cells, createAndFocus, selectedId],
  );

  const emptyState = useMemo(
    () => (
      <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.2)] p-8 text-center text-sm text-[rgba(255,255,255,0.55)]">
        <p>{t("notebook.empty", "Add your first cell to get started")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="axion-button axion-button--primary text-xs"
            onClick={() => handleAddCell("math")}
          >
            {t("notebook.addMathCell", "Add math cell")}
          </button>
          <button
            type="button"
            className="axion-button axion-button--ghost text-xs"
            onClick={() => handleAddCell("text")}
          >
            {t("notebook.addTextCell", "Add text cell")}
          </button>
        </div>
      </div>
    ),
    [handleAddCell, t],
  );

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm uppercase tracking-[0.3em] text-[var(--ax-muted)]">
            {t("notebook.title", "Notebook")}
          </h2>
          <p className="text-xs text-[rgba(255,255,255,0.5)]">
            {t("notebook.subtitle", "Evaluate expressions cell by cell.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="axion-button axion-button--ghost text-xs"
            onClick={() => handleAddCell("math")}
          >
            {t("notebook.addMathCell", "Add math cell")}
          </button>
          <button
            type="button"
            className="axion-button axion-button--ghost text-xs"
            onClick={() => handleAddCell("text")}
          >
            {t("notebook.addTextCell", "Add text cell")}
          </button>
        </div>
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
                isFirst={index === 0}
                isLast={index === cells.length - 1}
                isSelected={cell.id === selectedId}
                katex={katex}
                onSelect={() => onSelect(cell.id)}
                onChangeInput={(value) => onChangeInput(cell.id, value)}
                onEvaluate={() => {
                  void onEvaluate(cell.id);
                }}
                onAddBelow={(type) => {
                  createAndFocus({ afterId: cell.id, type });
                }}
                onRemove={() => onRemove(cell.id)}
                onMoveUp={() => {
                  if (index === 0) return;
                  onReorder(cell.id, index - 1);
                }}
                onMoveDown={() => {
                  if (index === cells.length - 1) return;
                  onReorder(cell.id, index + 1);
                }}
              />
            ))}
      </div>
    </section>
  );
}

export type { NotebookCellHandle } from "./NotebookCell";
