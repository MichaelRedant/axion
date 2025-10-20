import { describe, expect, it } from "vitest";
import type { EvaluationFailure, EvaluationSuccess } from "../app/axion/lib/algebra/engine";
import type { NotebookState } from "../app/axion/lib/notebook/types";
import { __testing, type NotebookAction } from "../app/axion/lib/notebook/useNotebook";

const { notebookReducer } = __testing;

const successEvaluation: EvaluationSuccess = {
  ok: true,
  engine: "axion",
  tokens: [],
  ast: {} as never,
  simplified: {} as never,
  solution: {
    type: "algebra" as never,
    descriptor: {} as never,
    exact: "2",
    approx: "2",
    approxValue: 2,
    steps: [],
    followUps: [],
    plotConfig: null,
  },
  exact: "2",
  approx: "2",
  approxValue: 2,
};

const errorEvaluation: EvaluationFailure = {
  ok: false,
  engine: "axion",
  message: "Invalid",
  position: 0,
};

function reduce(initial: NotebookState, actions: NotebookAction[]): NotebookState {
  return actions.reduce((state, action) => notebookReducer(state, action), initial);
}

describe("notebook reducer", () => {
  it("creates cells in the requested order", () => {
    const state = reduce(
      { cells: [], selectedId: null },
      [
        {
          type: "create",
          id: "cell-1",
          input: "",
          afterId: null,
          timestamp: 1,
          cellType: "math",
        },
        {
          type: "create",
          id: "cell-2",
          input: "",
          afterId: "cell-1",
          timestamp: 2,
          cellType: "math",
        },
        {
          type: "create",
          id: "cell-3",
          input: "",
          afterId: "cell-1",
          timestamp: 3,
          cellType: "math",
        },
      ],
    );

    expect(state.cells.map((cell) => cell.id)).toEqual(["cell-1", "cell-3", "cell-2"]);
    expect(state.selectedId).toBe("cell-3");
  });

  it("stores evaluation results for a cell", () => {
    const state = reduce(
      { cells: [], selectedId: null },
      [
        {
          type: "create",
          id: "cell-1",
          input: "1+1",
          afterId: null,
          timestamp: 1,
          cellType: "math",
        },
        { type: "setSuccess", id: "cell-1", evaluation: successEvaluation, timestamp: 2 },
      ],
    );

    expect(state.cells[0]).toMatchObject({
      id: "cell-1",
      type: "math",
      status: "success",
      output: { type: "success", evaluation: successEvaluation },
    });
  });

  it("resets output when input changes", () => {
    const initial = reduce(
      { cells: [], selectedId: null },
      [
        {
          type: "create",
          id: "cell-1",
          input: "1+1",
          afterId: null,
          timestamp: 1,
          cellType: "math",
        },
        { type: "setSuccess", id: "cell-1", evaluation: successEvaluation, timestamp: 2 },
      ],
    );

    const next = notebookReducer(initial, {
      type: "updateInput",
      id: "cell-1",
      input: "2+2",
      timestamp: 3,
    });

    expect(next.cells[0]).toMatchObject({
      id: "cell-1",
      type: "math",
      input: "2+2",
      status: "idle",
      output: null,
    });
  });

  it("captures errors for a cell", () => {
    const state = reduce(
      { cells: [], selectedId: null },
      [
        {
          type: "create",
          id: "cell-1",
          input: "1/0",
          afterId: null,
          timestamp: 1,
          cellType: "math",
        },
        { type: "setError", id: "cell-1", error: errorEvaluation, timestamp: 2 },
      ],
    );

    expect(state.cells[0]).toMatchObject({
      id: "cell-1",
      type: "math",
      status: "error",
      output: { type: "error", error: errorEvaluation },
    });
  });

  it("removes cells and selects the previous entry", () => {
    const state = reduce(
      { cells: [], selectedId: null },
      [
        {
          type: "create",
          id: "cell-1",
          input: "1",
          afterId: null,
          timestamp: 1,
          cellType: "math",
        },
        {
          type: "create",
          id: "cell-2",
          input: "2",
          afterId: "cell-1",
          timestamp: 2,
          cellType: "math",
        },
        {
          type: "create",
          id: "cell-3",
          input: "3",
          afterId: "cell-2",
          timestamp: 3,
          cellType: "math",
        },
        { type: "remove", id: "cell-3" },
      ],
    );

    expect(state.cells.map((cell) => cell.id)).toEqual(["cell-1", "cell-2"]);
    expect(state.selectedId).toBe("cell-2");
  });

  it("keeps text cells idle when updating content", () => {
    const state = reduce(
      { cells: [], selectedId: null },
      [
        {
          type: "create",
          id: "cell-text",
          input: "initial",
          afterId: null,
          timestamp: 1,
          cellType: "text",
        },
      ],
    );

    const next = notebookReducer(state, {
      type: "updateInput",
      id: "cell-text",
      input: "updated",
      timestamp: 2,
    });

    expect(next.cells[0]).toMatchObject({
      id: "cell-text",
      type: "text",
      input: "updated",
      status: "idle",
      output: null,
    });
  });
});
