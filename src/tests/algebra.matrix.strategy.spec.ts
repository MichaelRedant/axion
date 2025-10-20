import { describe, expect, it } from "vitest";
import { analyzeExpression } from "@/app/axion/lib/algebra/engine";
import { formatMatrix } from "@/app/axion/lib/algebra/matrix";

function toExact(input: string) {
  const result = analyzeExpression(input);
  if (!result.ok) {
    console.log(result);
  }
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("analyse mislukt");
  }
  return result.solution;
}

describe("MatrixStrategy", () => {
  it("voert matAdd uit", () => {
    const solution = toExact("matAdd(matrix(row(1,2),row(3,4)), matrix(row(5,6),row(7,8)))");
    expect(solution.exact).toBe(formatMatrix([[6, 8], [10, 12]]));
    expect(solution.steps).toHaveLength(2);
  });

  it("berekent determinant", () => {
    const solution = toExact("det(matrix(row(2,1),row(5,3)))");
    expect(solution.exact).toContain("\\det");
    expect(solution.approx).toBe("1");
  });

  it("geeft rang terug", () => {
    const solution = toExact("rank(matrix(row(1,2,3),row(2,4,6)))");
    expect(solution.exact).toContain("= 1");
  });

  it("geeft inverse", () => {
    const solution = toExact("inverse(matrix(row(4,7),row(2,6)))");
    expect(solution.exact).toContain("A^{-1}");
  });

  it("bepaalt eigenwaarden", () => {
    const solution = toExact("eig(matrix(row(2,0),row(0,3)))");
    expect(solution.details?.eigenwaarden).toEqual(["2", "3"]);
    expect(solution.plotConfig?.type).toBe("parametric");
  });

  it("bepaalt singular values", () => {
    const solution = toExact("svd(matrix(row(3,0),row(0,4)))");
    expect(solution.details?.singularValues).toEqual(["4", "3"]);
    expect(solution.plotConfig?.type).toBe("surface");
  });

  it("lost lineaire systemen op", () => {
    const solution = toExact("solveSystem(matrix(row(2,1),row(5,3)), vector(1,2))");
    expect(solution.exact).toContain("\\vec{x}");
    expect(solution.details?.variabelen).toEqual(["x_{1} = 1", "x_{2} = -1"]);
    expect(solution.plotConfig?.type).toBe("implicit");
  });
});
