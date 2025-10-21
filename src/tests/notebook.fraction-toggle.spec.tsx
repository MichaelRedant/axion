import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { EvaluationSuccess } from "@/app/axion/lib/algebra/engine";
import type { ProblemDescriptor } from "@/app/axion/lib/algebra/problems";
import type {
  NotebookCell as NotebookCellModel,
  NotebookCellType,
} from "@/app/axion/lib/notebook/types";

vi.mock("@/app/axion/lib/i18n/context", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? "",
    locale: "en",
    setLocale: () => {},
    dictionary: {},
  }),
}));

let NotebookCell: typeof import("@/app/axion/components/notebook/NotebookCell")["NotebookCell"];

describe("NotebookCell", () => {
  beforeAll(async () => {
    ({ NotebookCell } = await import("@/app/axion/components/notebook/NotebookCell"));
  });

  it("toggles a fractional output between latex and decimal", () => {
    const descriptor: ProblemDescriptor = {
      type: "unknown",
      metadata: {
        variables: [],
        primaryVariable: null,
        hasEquality: false,
        operators: [],
        functions: [],
        matrix: null,
        limit: null,
        hasDifferential: false,
        hasProbability: false,
        hasOptimization: false,
      },
    };

    const evaluation: EvaluationSuccess = {
      ok: true,
      engine: "axion",
      solution: {
        type: "unknown",
        descriptor,
        exact: "\\frac{1}{2}",
        approx: null,
        approxValue: null,
        steps: [],
        followUps: [],
        plotConfig: null,
      },
      exact: "\\frac{1}{2}",
      approx: null,
      approxValue: null,
    };

    const cell: NotebookCellModel = {
      id: "cell-1",
      order: 0,
      type: "math",
      input: "1/2",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "success",
      output: {
        type: "success",
        evaluation,
      },
    };

    render(
      <NotebookCell
        cell={cell}
        index={0}
        isFirst
        isLast
        isSelected
        katex={null}
        onSelect={vi.fn()}
        onChangeInput={vi.fn() as (value: string) => void}
        onEvaluate={vi.fn()}
        onAddBelow={vi.fn() as (type: NotebookCellType) => void}
        onRemove={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", { name: /show decimal/i });
    fireEvent.click(toggle);

    expect(screen.getByTestId("notebook-exact-decimal-cell-1")).toHaveTextContent("0.5");

    fireEvent.click(toggle);

    expect(screen.queryByTestId("notebook-exact-decimal-cell-1")).not.toBeInTheDocument();
    expect(screen.getByText("\\frac{1}{2}")).toBeInTheDocument();
  });
});
