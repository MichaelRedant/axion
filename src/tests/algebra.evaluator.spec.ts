import { describe, expect, it } from "vitest";
import { tokenize } from "@/app/axion/lib/algebra/tokenizer";
import { parse } from "@/app/axion/lib/algebra/parser";
import { evaluate } from "@/app/axion/lib/algebra/evaluator";
import { simplify } from "@/app/axion/lib/algebra/simplify";
import { toKaTeX } from "@/app/axion/lib/algebra/format";
import { cloneNode } from "@/app/axion/lib/algebra/ast";
import { EvaluationError } from "@/app/axion/lib/algebra/errors";
import { analyzeExpression } from "@/app/axion/lib/algebra/engine";

function parseExpression(input: string) {
  const tokens = tokenize(input);
  return parse(tokens);
}

describe("evaluate", () => {
  it("evaluates sin(pi/2) close to 1", () => {
    const ast = parseExpression("sin(pi/2)");
    const result = evaluate(ast, { precision: 8 });
    expect(result).toBeCloseTo(1, 5);
  });

  it("evaluates log base 10 correctly", () => {
    const ast = parseExpression("log(100,10)");
    const result = evaluate(ast);
    expect(result).toBeCloseTo(2, 8);
  });

  it("evaluates sqrt(2)^2 close to 2", () => {
    const ast = parseExpression("sqrt(2)^2");
    const result = evaluate(ast, { precision: 8 });
    expect(result).toBeCloseTo(2, 4);
  });

  it("raises for unknown symbols", () => {
    const ast = parseExpression("y + 2");
    expect(() => evaluate(ast)).toThrow(EvaluationError);
  });
});

describe("simplify", () => {
  it("combines like terms into 4x", () => {
    const ast = parseExpression("(x + x) + 2x");
    const simplified = simplify(ast);
    expect(toKaTeX(simplified)).toContain("4");
    expect(toKaTeX(simplified)).toContain("\\mathrm{x}");
  });

  it("reduces x^1 to x", () => {
    const ast = parseExpression("x^1");
    const simplified = simplify(ast);
    expect(simplified).toMatchObject({ type: "Symbol", name: "x" });
  });

  it("reduces x^0 to 1", () => {
    const ast = parseExpression("x^0");
    const simplified = simplify(ast);
    expect(simplified).toMatchObject({ type: "Number", value: "1" });
  });

  it("removes multiplication by 1", () => {
    const ast = parseExpression("1 * x");
    const simplified = simplify(ast);
    expect(simplified).toMatchObject({ type: "Symbol", name: "x" });
  });

  it("turns division by 1 into identity", () => {
    const ast = parseExpression("x / 1");
    const simplified = simplify(ast);
    expect(simplified).toMatchObject({ type: "Symbol", name: "x" });
  });
});

describe("format", () => {
  it("represents logarithm with base in KaTeX", () => {
    const ast = parseExpression("log(100,10)");
    expect(toKaTeX(ast)).toBe("\\log_{10}\\left(100\\right)");
  });

  it("formats nested sqrt expressions", () => {
    const ast = parseExpression("sqrt(2)");
    expect(toKaTeX(ast)).toBe("\\sqrt{2}");
  });
});

describe("ast helpers", () => {
  it("clones nodes deeply", () => {
    const ast = parseExpression("x + 1");
    const copy = cloneNode(ast);
    expect(copy).toEqual(ast);
    expect(copy).not.toBe(ast);
  });
});

describe("engine", () => {
  it("analyzes expressions end to end", () => {
    const result = analyzeExpression("1+2");
    expect(result).toMatchObject({
      ok: true,
      approx: "3",
    });
    if (result.ok) {
      expect(result.exact.length).toBeGreaterThan(0);
    }
  });

  it("returns failure metadata on error", () => {
    const result = analyzeExpression("log(,10)");
    expect(result).toMatchObject({
      ok: false,
      position: expect.any(Number),
    });
  });
});
