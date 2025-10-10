import { describe, expect, it } from "vitest";
import { analyzeExpression } from "@/app/axion/lib/algebra/engine";
import { parse } from "@/app/axion/lib/algebra/parser";
import { tokenize } from "@/app/axion/lib/algebra/tokenizer";
import { toKaTeX } from "@/app/axion/lib/algebra/format";
import { differentiate, integrate } from "@/app/axion/lib/algebra/calculus";

function parseExpression(input: string) {
  return parse(tokenize(input));
}

describe("calculus module", () => {
  it("differentiate API produces expected derivative", () => {
    const ast = parseExpression("sin(x)^2");
    const derivative = differentiate(ast, { variable: "x" });
    const latex = toKaTeX(derivative);
    expect(latex).toContain("\\sin");
    expect(latex).toContain("\\cos");
  });

  it("integrate API handles arctan pattern", () => {
    const ast = parseExpression("1/(1+x^2)");
    const primitive = integrate(ast, "x");
    expect(primitive).not.toBeNull();
    if (primitive) {
      expect(toKaTeX(primitive)).toContain("arctan");
    }
  });
});

describe("calculus strategy integration", () => {
  it("diff command explains derivative", () => {
    const result = analyzeExpression("diff(sin(x)^2, x)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.solution.steps.length).toBeGreaterThan(1);
    expect(result.solution.exact).toContain("\\sin");
    expect(result.solution.exact).toContain("\\cos");
  });

  it("integrate command returns arctan + C", () => {
    const result = analyzeExpression("integrate(1/(1+x^2), x)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.solution.exact).toContain("arctan");
    expect(result.solution.exact).toContain("C");
  });

  it("limit command resolves sin(x)/x", () => {
    const result = analyzeExpression("limit((sin(x))/x, x->0)");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Number(result.solution.approx)).toBeCloseTo(1, 4);
  });
});
