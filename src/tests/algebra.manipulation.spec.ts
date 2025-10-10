import { describe, expect, it } from "vitest";
import { tokenize } from "@/app/axion/lib/algebra/tokenizer";
import { parse } from "@/app/axion/lib/algebra/parser";
import { toKaTeX } from "@/app/axion/lib/algebra/format";
import {
  expand,
  factor,
  partialFraction,
  rationalSimplify,
  simplify,
} from "@/app/axion/lib/algebra/simplify";
import { analyzeExpression } from "@/app/axion/lib/algebra/engine";

function parseExpression(input: string) {
  return parse(tokenize(input));
}

describe("algebra manipulation", () => {
  it("expands binomial products", () => {
    const ast = parseExpression("(x+2)*(x+3)");
    const result = expand(ast);
    const latex = toKaTeX(result);
    expect(latex).toContain("\\mathrm{x}^{2}");
    expect(latex).toContain("+5\\mathrm{x}");
    expect(latex).toContain("+6");
  });

  it("factors simple quadratics", () => {
    const ast = parseExpression("x^2+5x+6");
    const result = factor(ast);
    const latex = toKaTeX(result);
    expect(latex).toContain("\\left(\\mathrm{x}+2\\right)");
    expect(latex).toContain("\\left(\\mathrm{x}+3\\right)");
  });

  it("simplifies rational coefficients", () => {
    const ast = parseExpression("(4*x)/2");
    const result = rationalSimplify(ast);
    expect(toKaTeX(result)).toContain("2\\mathrm{x}");
  });

  it("computes elementary partial fractions", () => {
    const ast = parseExpression("(3*x+5)/((x+1)*(x+2))");
    const result = partialFraction(ast);
    const latex = toKaTeX(result);
    expect(latex).toContain("\\frac");
    expect(latex).toContain("\\mathrm{x}+1");
    expect(latex).toContain("\\mathrm{x}+2");
  });

  it("leaves unsupported expressions untouched", () => {
    const ast = parseExpression("sin(x)/(x^2+1)");
    const simplified = partialFraction(ast);
    expect(toKaTeX(simplified)).toBe(toKaTeX(simplify(ast)));
  });

  it("routes simplify command through the engine", () => {
    const result = analyzeExpression("simplify((x+1)^2)");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.solution.steps).toHaveLength(2);
      expect(result.solution.exact).toContain("\\mathrm{x}^{2}");
    }
  });

  it("routes expand command through the engine", () => {
    const result = analyzeExpression("expand((x+2)*(x+3))");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.solution.exact).toContain("\\mathrm{x}^{2}");
      expect(result.solution.steps[1]?.latex).toContain("+5\\mathrm{x}");
    }
  });
});
