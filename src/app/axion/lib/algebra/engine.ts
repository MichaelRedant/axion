import { evaluate } from "./evaluator";
import { parse } from "./parser";
import { simplify } from "./simplify";
import { tokenize, type Token } from "./tokenizer";
import { toKaTeX } from "./format";
import type { Node } from "./ast";
import { AxionError } from "./errors";
import { analyzeProblem, type ProblemDescriptor } from "./problems";
import type { SolutionBundle } from "./solution";
import { registerStrategy, resolveStrategy } from "./strategies/registry";
import { QuadraticStrategy } from "./strategies/quadratic";

registerStrategy(new QuadraticStrategy());

export interface EvaluationSuccess {
  ok: true;
  tokens: Token[];
  ast: Node;
  simplified: Node;
  solution: SolutionBundle;
  exact: string;
  approx: string | null;
  approxValue: number | null;
}

export interface EvaluationFailure {
  ok: false;
  message: string;
  position: number;
}

export type EvaluationResult = EvaluationSuccess | EvaluationFailure;

export function analyzeExpression(input: string): EvaluationResult {
  try {
    const tokens = tokenize(input);
    const ast = parse(tokens);
    const simplified = simplify(ast);
    const descriptor = analyzeProblem(ast);

    const { result: strategyResult } = resolveStrategy(input, tokens, ast, simplified, descriptor);
    let solution: SolutionBundle;

    if (strategyResult) {
      solution = strategyResult;
    } else {
      solution = buildFallbackSolution(simplified, descriptor);
    }

    return {
      ok: true,
      tokens,
      ast,
      simplified,
      solution,
      exact: solution.exact,
      approx: solution.approx,
      approxValue: solution.approxValue ?? null,
    } satisfies EvaluationSuccess;
  } catch (error) {
    if (error instanceof AxionError) {
      return {
        ok: false,
        message: error.message,
        position: error.position,
      } satisfies EvaluationFailure;
    }

    return {
      ok: false,
      message: "Onbekende fout",
      position: input.length,
    } satisfies EvaluationFailure;
  }
}

function buildFallbackSolution(simplified: Node, descriptor: ProblemDescriptor): SolutionBundle {
  const exact = toKaTeX(simplified);
  let approxValue: number | null = null;
  let approx: string | null = null;

  try {
    approxValue = evaluate(simplified, { precision: 12 });
    approx = formatApproximation(approxValue);
  } catch {
    approxValue = null;
    approx = null;
  }

  return {
    type: descriptor.type,
    descriptor,
    exact,
    approx,
    approxValue,
    steps: [],
    plotConfig: null,
  };
}

function formatApproximation(value: number): string {
  const fixed = value.toFixed(8);
  return fixed.replace(/\.0+$/, "").replace(/0+$/, "");
}
