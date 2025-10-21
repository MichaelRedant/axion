import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { EvaluationSuccess } from "@/app/axion/lib/algebra/engine";
import type { ProblemDescriptor } from "@/app/axion/lib/algebra/problems";

vi.mock("@/app/axion/lib/i18n/context", () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? "",
  }),
}));

let ResultPane: typeof import("@/app/axion/components/ResultPane")["ResultPane"];

describe("ResultPane", () => {
  beforeAll(async () => {
    ({ ResultPane } = await import("@/app/axion/components/ResultPane"));
  });

  it("allows toggling a fraction result to its decimal value", () => {
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

    render(
      <ResultPane
        result={evaluation}
        error={null}
        expression="1/2"
        katex={null}
      />,
    );

    const toggle = screen.getByRole("button", { name: /show decimal/i });
    fireEvent.click(toggle);

    expect(screen.getByTestId("result-exact-decimal")).toHaveTextContent("0.5");

    fireEvent.click(toggle);

    expect(screen.queryByTestId("result-exact-decimal")).not.toBeInTheDocument();
    expect(screen.getByText("\\frac{1}{2}")).toBeInTheDocument();
  });
});
