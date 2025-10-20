import { nanoid } from "nanoid";
import type {
  NotebookCell,
  NotebookCellErrorOutput,
  NotebookCellSuccessOutput,
  NotebookSerializedCell,
  NotebookSerializedOutput,
  NotebookSerializedState,
  NotebookState,
} from "./types";

const STORAGE_KEY = "axion-notebook";
const CURRENT_VERSION = 4;

type LegacyNotebookCell = {
  readonly id?: string;
  readonly input: string;
  readonly createdAt?: number;
  readonly updatedAt?: number;
  readonly status?: "success" | "error";
  readonly pinned?: boolean;
  readonly payload:
    | { readonly type: "success"; readonly evaluation: NotebookCellSuccessOutput["evaluation"] }
    | { readonly type: "error"; readonly error: NotebookCellErrorOutput["error"] };
};

type LegacySerializedState = {
  readonly version: number;
  readonly cells: LegacyNotebookCell[];
};

export function loadNotebookState(): NotebookState {
  if (typeof window === "undefined") {
    return { cells: [], selectedId: null };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { cells: [], selectedId: null };
    }

    const parsed = JSON.parse(raw) as
      | NotebookSerializedState
      | LegacySerializedState
      | LegacyNotebookCell[];

    if (Array.isArray(parsed)) {
      const cells = parsed.map((cell, index) => deserializeLegacyCell(cell, index));
      return {
        cells,
        selectedId: cells[0]?.id ?? null,
      } satisfies NotebookState;
    }

    if (!parsed || typeof parsed !== "object") {
      return { cells: [], selectedId: null };
    }

    if ("version" in parsed) {
      if (parsed.version === CURRENT_VERSION) {
        const typed = parsed as NotebookSerializedState;
        const cells = typed.cells.map(deserializeCell);
        return { cells, selectedId: typed.selectedId ?? cells[0]?.id ?? null } satisfies NotebookState;
      }

      if (parsed.version === 3) {
        const typed = parsed as NotebookSerializedState;
        const cells = typed.cells.map(deserializeCell);
        return { cells, selectedId: typed.selectedId ?? cells[0]?.id ?? null } satisfies NotebookState;
      }

      if (parsed.version === 2) {
        const typed = parsed as NotebookSerializedState;
        const cells = typed.cells.map((cell) =>
          deserializeCell({
            ...cell,
            type: (cell as NotebookSerializedCell).type ?? "math",
          }),
        );
        return { cells, selectedId: typed.selectedId ?? cells[0]?.id ?? null } satisfies NotebookState;
      }

      if (parsed.version === 1) {
        const typed = parsed as LegacySerializedState;
        const cells = typed.cells.map((cell, index) => deserializeLegacyCell(cell, index));
        return { cells, selectedId: cells[0]?.id ?? null } satisfies NotebookState;
      }
    }

    return { cells: [], selectedId: null } satisfies NotebookState;
  } catch (error) {
    console.warn("Failed to load notebook state", error);
    return { cells: [], selectedId: null } satisfies NotebookState;
  }
}

export function persistNotebookState(state: NotebookState) {
  if (typeof window === "undefined") {
    return;
  }

  const serializable: NotebookSerializedState = {
    version: CURRENT_VERSION,
    selectedId: state.selectedId,
    cells: state.cells.map(serializeCell),
  } satisfies NotebookSerializedState;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.warn("Failed to persist notebook state", error);
  }
}

function serializeCell(cell: NotebookCell): NotebookSerializedCell {
  return {
    ...cell,
    output: cell.output ? serializeOutput(cell.output) : null,
  } satisfies NotebookSerializedCell;
}

function serializeOutput(output: NotebookCellSuccessOutput | NotebookCellErrorOutput): NotebookSerializedOutput {
  if (output.type === "success") {
    return { type: "success", evaluation: output.evaluation } satisfies NotebookCellSuccessOutput;
  }

  if (output.type === "error") {
    return { type: "error", error: output.error } satisfies NotebookCellErrorOutput;
  }

  return output;
}

function deserializeCell(serialized: NotebookSerializedCell): NotebookCell {
  return {
    ...serialized,
    type: serialized.type ?? "math",
    output: serialized.output ? deserializeOutput(serialized.output) : null,
  } satisfies NotebookCell;
}

function deserializeOutput(output: NotebookSerializedOutput): NotebookCell["output"] {
  if (!output) {
    return null;
  }

  if (output.type === "success") {
    return {
      type: "success",
      evaluation: {
        ...output.evaluation,
        engine: output.evaluation.engine ?? "axion",
      },
    } satisfies NotebookCellSuccessOutput;
  }

  return {
    type: "error",
    error: {
      ...output.error,
      engine: output.error.engine ?? "axion",
    },
  } satisfies NotebookCellErrorOutput;
}

function deserializeLegacyCell(cell: LegacyNotebookCell, index: number): NotebookCell {
  const now = Date.now();
  const id = cell.id ?? nanoid();
  const status = cell.status ?? (cell.payload.type === "success" ? "success" : "error");

  const output: NotebookCell["output"] =
    cell.payload.type === "success"
      ? ({
          type: "success",
          evaluation: {
            ...cell.payload.evaluation,
            engine: cell.payload.evaluation.engine ?? "axion",
          },
        } satisfies NotebookCellSuccessOutput)
      : ({
          type: "error",
          error: { ...cell.payload.error, engine: cell.payload.error.engine ?? "axion" },
        } satisfies NotebookCellErrorOutput);

  return {
    id,
    order: index,
    type: "math",
    input: cell.input,
    createdAt: cell.createdAt ?? now,
    updatedAt: cell.updatedAt ?? now,
    status,
    output,
  } satisfies NotebookCell;
}
