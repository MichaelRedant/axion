import { describe, expect, it } from "vitest";
import { tokenize } from "@/app/axion/lib/algebra/tokenizer";
import { parse } from "@/app/axion/lib/algebra/parser";
import { evaluate, isComplexResult, isUnitResult } from "@/app/axion/lib/algebra/evaluator";
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
    expect(typeof result).toBe("number");
    if (typeof result === "number") {
      expect(result).toBeCloseTo(1, 5);
    }
  });

  it("evaluates log base 10 correctly", () => {
    const ast = parseExpression("log(100,10)");
    const result = evaluate(ast);
    expect(typeof result).toBe("number");
    if (typeof result === "number") {
      expect(result).toBeCloseTo(2, 8);
    }
  });

  it("evaluates sqrt(2)^2 close to 2", () => {
    const ast = parseExpression("sqrt(2)^2");
    const result = evaluate(ast, { precision: 8 });
    expect(typeof result).toBe("number");
    if (typeof result === "number") {
      expect(result).toBeCloseTo(2, 4);
    }
  });

  it("evaluates abs(-3) to 3", () => {
    const ast = parseExpression("abs(-3)");
    const result = evaluate(ast);
    expect(typeof result).toBe("number");
    if (typeof result === "number") {
      expect(result).toBeCloseTo(3, 8);
    }
  });

  it("evaluates exp(1) close to e", () => {
    const ast = parseExpression("exp(1)");
    const result = evaluate(ast);
    expect(typeof result).toBe("number");
    if (typeof result === "number") {
      expect(result).toBeCloseTo(Math.E, 6);
    }
  });

  it("evaluates asin(1) close to pi/2", () => {
    const ast = parseExpression("asin(1)");
    const result = evaluate(ast);
    expect(typeof result).toBe("number");
    if (typeof result === "number") {
      expect(result).toBeCloseTo(Math.PI / 2, 6);
    }
  });

  it("computes factorial for integers", () => {
    const ast = parseExpression("fact(5)");
    const result = evaluate(ast);
    expect(typeof result).toBe("number");
    if (typeof result === "number") {
      expect(result).toBe(120);
    }
  });

  it("produces a complex result for sqrt(-1)", () => {
    const ast = parseExpression("sqrt(-1)");
    const result = evaluate(ast);
    expect(isComplexResult(result)).toBe(true);
    if (isComplexResult(result)) {
      expect(result.real).toBeCloseTo(0, 6);
      expect(result.imaginary).toBeCloseTo(1, 6);
    }
  });

  it("evaluates additions with matching units", () => {
    const ast = parseExpression("2m + 3m");
    const result = evaluate(ast);
    expect(isUnitResult(result)).toBe(true);
    if (isUnitResult(result)) {
      expect(result.magnitude).toBeCloseTo(5, 6);
      expect(result.unit).toBe("m");
    }
  });

  it("rejects additions with incompatible units", () => {
    const ast = parseExpression("2m + 3s");
    expect(() => evaluate(ast)).toThrow(EvaluationError);
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
