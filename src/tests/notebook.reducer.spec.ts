import { describe, expect, it, beforeEach, vi } from "vitest";
import type { NotebookState } from "../app/axion/lib/notebook/types";
import { __testing, type NotebookAction } from "../app/axion/lib/notebook/useNotebook";
import type { EvaluationSuccess } from "../app/axion/lib/algebra/engine";

const { notebookReducer } = __testing;

let counter = 0;

vi.mock("nanoid", () => ({
  nanoid: () => `cell-${counter += 1}`,
}));

const baseEvaluation: EvaluationSuccess = {
  ok: true,
  tokens: [],
  ast: {} as never,
  simplified: {} as never,
  solution: {
    type: "algebra" as never,
    descriptor: {} as never,
    exact: "x",
    approx: null,
    steps: [],
    plotConfig: null,
    followUps: [],
  },
  exact: "x",
  approx: null,
  approxValue: null,
};

function reduce(initial: NotebookState, actions: NotebookAction[]): NotebookState {
  return actions.reduce((state, action) => notebookReducer(state, action), initial);
}

describe("notebook reducer", () => {
  beforeEach(() => {
    counter = 0;
  });

  it("appends success cells and keeps pinned cells at the top", () => {
    const state = reduce(
      { cells: [] },
      [
        { type: "appendSuccess", input: "1+1", evaluation: baseEvaluation },
        { type: "appendSuccess", input: "2+2", evaluation: baseEvaluation },
        { type: "togglePin", id: "cell-1" },
        { type: "appendSuccess", input: "3+3", evaluation: baseEvaluation },
      ],
    );

    expect(state.cells).toHaveLength(3);
    expect(state.cells[0]?.id).toBe("cell-1");
    expect(state.cells[1]?.input).toBe("3+3");
  });

  it("reorders cells when dragging", () => {
    const state = reduce(
      { cells: [] },
      [
        { type: "appendSuccess", input: "a", evaluation: baseEvaluation },
        { type: "appendSuccess", input: "b", evaluation: baseEvaluation },
        { type: "reorder", sourceId: "cell-2", targetId: "cell-1" },
      ],
    );

    expect(state.cells[0]?.input).toBe("a");
    expect(state.cells[1]?.input).toBe("b");
  });

  it("clears unpinned cells", () => {
    const state = reduce(
      { cells: [] },
      [
        { type: "appendSuccess", input: "a", evaluation: baseEvaluation },
        { type: "appendSuccess", input: "b", evaluation: baseEvaluation },
        { type: "togglePin", id: "cell-2" },
        { type: "clearUnpinned" },
      ],
    );

    expect(state.cells).toHaveLength(1);
    expect(state.cells[0]?.id).toBe("cell-2");
  });
});
