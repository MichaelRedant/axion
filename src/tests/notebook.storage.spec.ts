import { beforeEach, describe, expect, it, vi } from "vitest";

const { generatedIds, nanoidMock } = vi.hoisted(() => {
  const ids = ["generated-1", "generated-2"];
  return {
    generatedIds: ids,
    nanoidMock: vi.fn(() => ids.shift() ?? "generated-fallback"),
  };
});

vi.mock("nanoid", () => ({
  nanoid: nanoidMock,
}));

import { loadNotebookState, persistNotebookState } from "@/app/axion/lib/notebook/storage";
import type {
  NotebookCell,
  NotebookState,
} from "@/app/axion/lib/notebook/types";
import type { EvaluationFailure, EvaluationSuccess } from "@/app/axion/lib/algebra/engine";
import type { ProblemDescriptor } from "@/app/axion/lib/algebra/problems";
import type { Node } from "@/app/axion/lib/algebra/ast";
import type { SolutionBundle } from "@/app/axion/lib/algebra/solution";

type LocalStorageMock = Storage & {
  __setStore: (data: Record<string, string>) => void;
  __getStore: () => Record<string, string>;
};

describe("notebook storage", () => {
  let localStorageMock: LocalStorageMock;

  const sampleNode = { type: "NumberLiteral" } as unknown as Node;
  const sampleDescriptor = { type: "algebra" } as unknown as ProblemDescriptor;
  const sampleSolution: SolutionBundle = {
    type: "algebra",
    descriptor: sampleDescriptor,
    exact: "1",
    approx: "1",
    approxValue: 1,
    steps: [],
    followUps: [],
    plotConfig: null,
  };

  const successEvaluation: EvaluationSuccess = {
    ok: true,
    tokens: [],
    ast: sampleNode,
    simplified: sampleNode,
    solution: sampleSolution,
    exact: "1",
    approx: "1",
    approxValue: 1,
  };

  const errorEvaluation: EvaluationFailure = {
    ok: false,
    message: "error",
    position: 0,
  };

  beforeEach(() => {
    let store: Record<string, string> = {};

    localStorageMock = {
      get length() {
        return Object.keys(store).length;
      },
      clear: vi.fn(() => {
        store = {};
      }),
      getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
      key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      __setStore: (data: Record<string, string>) => {
        store = { ...data };
      },
      __getStore: () => ({ ...store }),
    } as LocalStorageMock;

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageMock,
    });

    generatedIds.splice(0, generatedIds.length, "generated-1", "generated-2");
    nanoidMock.mockClear();
  });

  it("persisted state with mixed cell payloads can be reloaded", () => {
    const state: NotebookState = {
      cells: [
        {
          id: "cell-success",
          input: "1+1",
          createdAt: 1,
          updatedAt: 2,
          status: "success",
          pinned: true,
          payload: { type: "success", evaluation: successEvaluation },
        },
        {
          id: "cell-error",
          input: "2/0",
          createdAt: 3,
          updatedAt: 4,
          status: "error",
          pinned: false,
          payload: { type: "error", error: errorEvaluation },
        },
      ],
    } satisfies NotebookState;

    persistNotebookState(state);

    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "axion-notebook",
      expect.stringContaining("\"version\":1"),
    );

    const reloaded = loadNotebookState();

    expect(localStorageMock.getItem).toHaveBeenCalledWith("axion-notebook");
    expect(reloaded.cells).toHaveLength(2);
    expect(reloaded.cells[0]).toEqual(state.cells[0]);
    expect(reloaded.cells[1]).toEqual(state.cells[1]);
  });

  it("hydrates legacy notebook entries by generating missing identifiers", () => {
    const legacyCells: Array<Omit<NotebookCell, "id"> & { id?: string }> = [
      {
        input: "legacy",
        createdAt: 5,
        updatedAt: 6,
        status: "success",
        pinned: false,
        payload: { type: "success", evaluation: successEvaluation },
      },
      {
        input: "error-legacy",
        createdAt: 7,
        updatedAt: 8,
        status: "error",
        pinned: true,
        payload: { type: "error", error: errorEvaluation },
      },
    ];

    localStorageMock.__setStore({
      "axion-notebook": JSON.stringify(legacyCells),
    });

    const reloaded = loadNotebookState();

    expect(reloaded.cells).toHaveLength(2);
    expect(nanoidMock).toHaveBeenCalledTimes(2);
    expect(reloaded.cells[0]).toMatchObject({
      id: "generated-1",
      input: "legacy",
      pinned: false,
      status: "success",
    });
    expect(reloaded.cells[1]).toMatchObject({
      id: "generated-2",
      input: "error-legacy",
      pinned: true,
      status: "error",
    });
  });
});
