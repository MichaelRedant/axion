import { nanoid } from "nanoid";
import type {
  NotebookCell,
  NotebookSerializedCell,
  NotebookSerializedPayload,
  NotebookSerializedState,
  NotebookState,
} from "./types";

const STORAGE_KEY = "axion-notebook";
const CURRENT_VERSION = 1;

export function loadNotebookState(): NotebookState {
  if (typeof window === "undefined") {
    return { cells: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { cells: [] };
    }

    const parsed = JSON.parse(raw) as NotebookSerializedState | NotebookCell[];

    if (Array.isArray(parsed)) {
      return { cells: parsed.map(deserializeCellLegacy) };
    }

    if (typeof parsed !== "object" || parsed === null) {
      return { cells: [] };
    }

    if (parsed.version !== CURRENT_VERSION) {
      return { cells: parsed.cells.map(deserializeCell) };
    }

    return { cells: parsed.cells.map(deserializeCell) };
  } catch (error) {
    console.warn("Failed to load notebook state", error);
    return { cells: [] };
  }
}

export function persistNotebookState(state: NotebookState) {
  if (typeof window === "undefined") {
    return;
  }

  const serializable: NotebookSerializedState = {
    version: CURRENT_VERSION,
    cells: state.cells.map(serializeCell),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.warn("Failed to persist notebook state", error);
  }
}

function serializeCell(cell: NotebookCell): NotebookSerializedCell {
  return {
    ...cell,
    payload: serializePayload(cell.payload),
  };
}

function serializePayload(payload: NotebookCell["payload"]): NotebookSerializedPayload {
  if (payload.type === "success") {
    return {
      type: "success",
      evaluation: payload.evaluation,
    };
  }

  return {
    type: "error",
    error: payload.error,
  };
}

function deserializeCell(serialized: NotebookSerializedCell): NotebookCell {
  return {
    ...serialized,
    payload: deserializePayload(serialized.payload),
  };
}

function deserializePayload(payload: NotebookSerializedPayload): NotebookCell["payload"] {
  if (payload.type === "success") {
    return {
      type: "success",
      evaluation: payload.evaluation,
    };
  }

  return {
    type: "error",
    error: payload.error,
  };
}

function deserializeCellLegacy(cell: NotebookCell): NotebookCell {
  // Legacy entries may have missing identifiers; ensure they exist.
  return {
    ...cell,
    id: cell.id ?? nanoid(),
  };
}
