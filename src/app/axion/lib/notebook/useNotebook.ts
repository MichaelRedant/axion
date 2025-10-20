import { useEffect, useMemo, useReducer } from "react";
import { nanoid } from "nanoid";
import type { EvaluationFailure, EvaluationSuccess } from "../algebra/engine";
import { loadNotebookState, persistNotebookState } from "./storage";
import type {
  NotebookActions,
  NotebookCell,
  NotebookCellErrorOutput,
  NotebookCellSuccessOutput,
  NotebookCellType,
  NotebookState,
} from "./types";

interface CreateCellAction {
  readonly type: "create";
  readonly id: string;
  readonly afterId?: string | null;
  readonly input: string;
  readonly cellType: NotebookCellType;
  readonly timestamp: number;
}

interface UpdateInputAction {
  readonly type: "updateInput";
  readonly id: string;
  readonly input: string;
  readonly timestamp: number;
}

interface MarkEvaluatingAction {
  readonly type: "markEvaluating";
  readonly id: string;
  readonly timestamp: number;
}

interface SetSuccessAction {
  readonly type: "setSuccess";
  readonly id: string;
  readonly evaluation: EvaluationSuccess;
  readonly timestamp: number;
}

interface SetErrorAction {
  readonly type: "setError";
  readonly id: string;
  readonly error: EvaluationFailure;
  readonly timestamp: number;
}

interface ClearOutputAction {
  readonly type: "clearOutput";
  readonly id: string;
  readonly timestamp: number;
}

interface RemoveCellAction {
  readonly type: "remove";
  readonly id: string;
}

interface SelectCellAction {
  readonly type: "select";
  readonly id: string | null;
}

interface ReorderAction {
  readonly type: "reorder";
  readonly id: string;
  readonly targetOrder: number;
}

interface HydrateAction {
  readonly type: "hydrate";
  readonly payload: NotebookState;
}

export type NotebookAction =
  | CreateCellAction
  | UpdateInputAction
  | MarkEvaluatingAction
  | SetSuccessAction
  | SetErrorAction
  | ClearOutputAction
  | RemoveCellAction
  | SelectCellAction
  | ReorderAction
  | HydrateAction;

function notebookReducer(state: NotebookState, action: NotebookAction): NotebookState {
  switch (action.type) {
    case "hydrate":
      return normalizeState(action.payload);
    case "create":
      return createCell(state, action);
    case "updateInput":
      return updateCellInput(state, action);
    case "markEvaluating":
      return updateCell(state, action.id, (cell) => {
        if (cell.type !== "math") {
          return cell;
        }
        return {
          ...cell,
          status: "running",
          updatedAt: action.timestamp,
        } satisfies NotebookCell;
      });
    case "setSuccess":
      return updateCell(state, action.id, (cell) => {
        if (cell.type !== "math") {
          return cell;
        }
        return {
          ...cell,
          status: "success",
          updatedAt: action.timestamp,
          output: { type: "success", evaluation: action.evaluation } satisfies NotebookCellSuccessOutput,
        } satisfies NotebookCell;
      });
    case "setError":
      return updateCell(state, action.id, (cell) => {
        if (cell.type !== "math") {
          return cell;
        }
        return {
          ...cell,
          status: "error",
          updatedAt: action.timestamp,
          output: { type: "error", error: action.error } satisfies NotebookCellErrorOutput,
        } satisfies NotebookCell;
      });
    case "clearOutput":
      return updateCell(state, action.id, (cell) => {
        if (cell.type !== "math") {
          return cell;
        }
        return {
          ...cell,
          status: "idle",
          updatedAt: action.timestamp,
          output: null,
        } satisfies NotebookCell;
      });
    case "remove":
      return removeCell(state, action.id);
    case "select":
      return { ...state, selectedId: action.id } satisfies NotebookState;
    case "reorder":
      return reorderCells(state, action.id, action.targetOrder);
    default:
      return state;
  }
}

export const __testing = { notebookReducer } as const;

function normalizeState(state: NotebookState): NotebookState {
  const sorted = [...state.cells].sort((a, b) => a.order - b.order);
  const normalized = sorted.map((cell, index) => ({ ...cell, order: index }));
  const selected = state.selectedId ?? normalized[0]?.id ?? null;
  return { cells: normalized, selectedId: selected } satisfies NotebookState;
}

function createCell(state: NotebookState, action: CreateCellAction): NotebookState {
  const cells = [...state.cells];
  const insertIndex = action.afterId
    ? Math.max(
        0,
        cells.findIndex((cell) => cell.id === action.afterId) + 1,
      )
    : cells.length;

  const nextCell: NotebookCell = {
    id: action.id,
    type: action.cellType,
    input: action.input,
    createdAt: action.timestamp,
    updatedAt: action.timestamp,
    status: "idle",
    order: insertIndex,
    output: null,
  } satisfies NotebookCell;

  cells.splice(insertIndex, 0, nextCell);

  const reordered = cells.map((cell, index) => ({ ...cell, order: index }));

  return {
    cells: reordered,
    selectedId: nextCell.id,
  } satisfies NotebookState;
}

function updateCellInput(state: NotebookState, action: UpdateInputAction): NotebookState {
  const next = updateCell(state, action.id, (cell) => ({
    ...cell,
    input: action.input,
    updatedAt: action.timestamp,
    status: "idle",
    output: null,
  }));
  return next;
}

function updateCell(
  state: NotebookState,
  id: string,
  updater: (cell: NotebookCell) => NotebookCell,
): NotebookState {
  const index = state.cells.findIndex((cell) => cell.id === id);
  if (index === -1) {
    return state;
  }

  const cells = [...state.cells];
  cells[index] = updater(cells[index]!);

  return {
    ...state,
    cells,
  } satisfies NotebookState;
}

function removeCell(state: NotebookState, id: string): NotebookState {
  const index = state.cells.findIndex((cell) => cell.id === id);
  if (index === -1) {
    return state;
  }

  const cells = state.cells.filter((cell) => cell.id !== id).map((cell, order) => ({ ...cell, order }));
  const selected =
    state.selectedId === id
      ? cells[Math.max(0, index - 1)]?.id ?? cells[0]?.id ?? null
      : state.selectedId;

  return { cells, selectedId: selected } satisfies NotebookState;
}

function reorderCells(state: NotebookState, id: string, targetOrder: number): NotebookState {
  const index = state.cells.findIndex((cell) => cell.id === id);
  if (index === -1) {
    return state;
  }

  const normalizedTarget = Math.max(0, Math.min(targetOrder, state.cells.length - 1));
  const cells = [...state.cells];
  const [moved] = cells.splice(index, 1);
  cells.splice(normalizedTarget, 0, moved);

  return {
    ...state,
    cells: cells.map((cell, order) => ({ ...cell, order })),
  } satisfies NotebookState;
}

export function useNotebook(): [NotebookState, NotebookActions] {
  const [state, dispatch] = useReducer(notebookReducer, { cells: [], selectedId: null });

  useEffect(() => {
    const loaded = loadNotebookState();
    dispatch({ type: "hydrate", payload: loaded });
  }, []);

  useEffect(() => {
    persistNotebookState(state);
  }, [state]);

  const actions = useMemo<NotebookActions>(() => {
    return {
      createCell: (options) => {
        const id = nanoid();
        const timestamp = Date.now();
        dispatch({
          type: "create",
          id,
          afterId: options?.afterId ?? null,
          input: options?.input ?? "",
          cellType: options?.type ?? "math",
          timestamp,
        });
        return id;
      },
      updateInput: (id, nextInput) =>
        dispatch({ type: "updateInput", id, input: nextInput, timestamp: Date.now() }),
      markEvaluating: (id) => dispatch({ type: "markEvaluating", id, timestamp: Date.now() }),
      setSuccess: (id, evaluation) =>
        dispatch({ type: "setSuccess", id, evaluation, timestamp: Date.now() }),
      setError: (id, error) => dispatch({ type: "setError", id, error, timestamp: Date.now() }),
      clearOutput: (id) => dispatch({ type: "clearOutput", id, timestamp: Date.now() }),
      remove: (id) => dispatch({ type: "remove", id }),
      select: (id) => dispatch({ type: "select", id }),
      reorder: (id, targetOrder) => dispatch({ type: "reorder", id, targetOrder }),
      hydrate: (payload) => dispatch({ type: "hydrate", payload }),
    } satisfies NotebookActions;
  }, []);

  return [state, actions];
}
