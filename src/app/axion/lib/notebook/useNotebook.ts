import { useEffect, useMemo, useReducer } from "react";
import { nanoid } from "nanoid";
import type { EvaluationFailure, EvaluationSuccess } from "../algebra/engine";
import { loadNotebookState, persistNotebookState } from "./storage";
import type { NotebookActions, NotebookCell, NotebookState } from "./types";

interface AppendSuccessAction {
  readonly type: "appendSuccess";
  readonly input: string;
  readonly evaluation: EvaluationSuccess;
}

interface AppendErrorAction {
  readonly type: "appendError";
  readonly input: string;
  readonly error: EvaluationFailure;
}

interface TogglePinAction {
  readonly type: "togglePin";
  readonly id: string;
}

interface RemoveAction {
  readonly type: "remove";
  readonly id: string;
}

interface ReorderAction {
  readonly type: "reorder";
  readonly sourceId: string;
  readonly targetId: string;
}

interface ReplaceInputAction {
  readonly type: "replaceInput";
  readonly id: string;
  readonly input: string;
}

interface ClearUnpinnedAction {
  readonly type: "clearUnpinned";
}

interface HydrateAction {
  readonly type: "hydrate";
  readonly payload: NotebookState;
}

export type NotebookAction =
  | AppendSuccessAction
  | AppendErrorAction
  | TogglePinAction
  | RemoveAction
  | ReorderAction
  | ReplaceInputAction
  | ClearUnpinnedAction
  | HydrateAction;

function notebookReducer(state: NotebookState, action: NotebookAction): NotebookState {
  switch (action.type) {
    case "hydrate":
      return action.payload;
    case "appendSuccess":
      return appendCell(state, action.input, "success", action.evaluation);
    case "appendError":
      return appendCell(state, action.input, "error", action.error);
    case "togglePin":
      return {
        cells: state.cells.map((cell) =>
          cell.id === action.id
            ? { ...cell, pinned: !cell.pinned, updatedAt: Date.now() }
            : cell,
        ),
      };
    case "remove":
      return {
        cells: state.cells.filter((cell) => cell.id !== action.id),
      };
    case "reorder":
      return reorderCells(state, action.sourceId, action.targetId);
    case "replaceInput":
      return {
        cells: state.cells.map((cell) =>
          cell.id === action.id ? { ...cell, input: action.input, updatedAt: Date.now() } : cell,
        ),
      };
    case "clearUnpinned":
      return {
        cells: state.cells.filter((cell) => cell.pinned),
      };
    default:
      return state;
  }
}

export const __testing = { notebookReducer } as const;

function appendCell(
  state: NotebookState,
  input: string,
  type: "success" | "error",
  payload: EvaluationSuccess | EvaluationFailure,
): NotebookState {
  const now = Date.now();

  const cell: NotebookCell = {
    id: nanoid(),
    input,
    createdAt: now,
    updatedAt: now,
    status: type,
    pinned: false,
    payload:
      type === "success"
        ? { type, evaluation: payload as EvaluationSuccess }
        : { type, error: payload as EvaluationFailure },
  };

  const pinned = state.cells.filter((item) => item.pinned);
  const rest = state.cells.filter((item) => !item.pinned);

  return {
    cells: [...pinned, cell, ...rest],
  };
}

function reorderCells(state: NotebookState, sourceId: string, targetId: string): NotebookState {
  if (sourceId === targetId) {
    return state;
  }

  const indexMap = new Map(state.cells.map((cell, index) => [cell.id, index] as const));
  const sourceIndex = indexMap.get(sourceId);
  const targetIndex = indexMap.get(targetId);

  if (sourceIndex === undefined || targetIndex === undefined) {
    return state;
  }

  const next = [...state.cells];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  const updatedAt = Date.now();

  return {
    cells: next.map((cell) =>
      cell.id === moved.id ? { ...cell, updatedAt } : cell,
    ),
  };
}

export function useNotebook(): [NotebookState, NotebookActions] {
  const [state, dispatch] = useReducer(notebookReducer, { cells: [] });

  useEffect(() => {
    const loaded = loadNotebookState();
    dispatch({ type: "hydrate", payload: loaded });
  }, []);

  useEffect(() => {
    if (!state.cells.length) {
      persistNotebookState(state);
      return;
    }

    persistNotebookState(state);
  }, [state]);

  const actions = useMemo<NotebookActions>(() => {
    return {
      appendSuccess: (input, evaluation) => dispatch({ type: "appendSuccess", input, evaluation }),
      appendError: (input, error) => dispatch({ type: "appendError", input, error }),
      togglePin: (id) => dispatch({ type: "togglePin", id }),
      remove: (id) => dispatch({ type: "remove", id }),
      reorder: (sourceId, targetId) => dispatch({ type: "reorder", sourceId, targetId }),
      replaceInput: (id, nextInput) => dispatch({ type: "replaceInput", id, input: nextInput }),
      clearUnpinned: () => dispatch({ type: "clearUnpinned" }),
    } satisfies NotebookActions;
  }, []);

  return [state, actions];
}
