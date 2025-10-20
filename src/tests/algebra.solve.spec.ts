import { describe, expect, it } from "vitest";
import { analyzeExpression } from "@/app/axion/lib/algebra/engine";

function normalizeLatex(latex: string | undefined) {
  return latex ? latex.replace(/\s+/g, "") : "";
}

describe("solve strategy", () => {
  it("solves linear equations with steps", () => {
    const result = analyzeExpression("solve(2x+4=0)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.solution.details?.degree).toBe(1);
    expect(result.solution.exact).toContain("\\mathrm{x}");
    expect(result.solution.steps).toHaveLength(3);
    expect(result.solution.intervals).toBeUndefined();
    const root = result.solution.roots?.[0];
    expect(typeof root).toBe("number");
    if (typeof root === "number") {
      expect(root).toBeCloseTo(-2, 10);
    }
    const thirdStep = normalizeLatex(result.solution.steps[2]?.latex);
    expect(
      thirdStep.includes("-2") || thirdStep.includes("\\frac{-4}{2}"),
    ).toBe(true);
  });

  it("solves quadratics including complex roots", () => {
    const result = analyzeExpression("solve(x^2+x+2=0)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.solution.details?.degree).toBe(2);
    expect(result.solution.steps).toHaveLength(3);
    expect(result.solution.rationale?.toLowerCase()).toContain("complex");
    const roots = result.solution.roots ?? [];
    expect(roots).toHaveLength(2);
    const formattedRoots = roots.map((root) =>
      typeof root === "number" ? root.toString() : root.approx,
    );
    expect(formattedRoots[0]).toContain("i");
    expect(result.solution.intervals).toBeUndefined();
  });

  it("solves quadratic inequalities with intervals", () => {
    const result = analyzeExpression("solve(x^2-3<0)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.solution.details?.degree).toBe(2);
    const intervals = result.solution.intervals ?? [];
    expect(intervals.length).toBeGreaterThan(0);
    const latexIntervals = intervals.map((item) => item.latex);
    const hasExpected = latexIntervals.some((latex) => latex.includes("\\sqrt"));
    expect(hasExpected).toBe(true);
    expect(result.solution.exact.includes("\\cup")).toBe(false);
  });

  it("solves cubic equations numerically", () => {
    const result = analyzeExpression("solve(x^3-1=0)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.solution.details?.degree).toBe(3);
    expect(result.solution.steps.some((step) => step.id === "numeric")).toBe(true);
    const roots = result.solution.roots ?? [];
    expect(roots.length).toBe(3);
    const approximations = roots.map((root) =>
      typeof root === "number" ? root : root.approx,
    );
    const hasRealRoot = approximations.some((value) =>
      value.toString().includes("1"),
    );
    expect(hasRealRoot).toBe(true);
  });

  it("solves quartic equations numerically", () => {
    const result = analyzeExpression("solve(x^4-5x^2+4=0)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.solution.details?.degree).toBe(4);
    const roots = result.solution.roots ?? [];
    expect(roots.filter((root) => typeof root === "number")).toHaveLength(4);
  });
});
