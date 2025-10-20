import { evaluate, isComplexResult, isUnitResult, type ComplexResult, type UnitResult } from "./evaluator";
registerStrategy({
  descriptor: MATRIX_STRATEGY_DESCRIPTOR,
  factory: () => new MatrixStrategy(),
});

import { parse } from "./parser";
import { simplify } from "./simplify";
import { tokenize, type Token } from "./tokenizer";
import { toKaTeX } from "./format";
import type { Node } from "./ast";
import { AxionError } from "./errors";
import { analyzeProblem, type ProblemDescriptor } from "./problems";
import type { SolutionBundle } from "./solution";
import { buildExpressionContext } from "./context";
import { registerStrategy, resolveStrategy } from "./strategies/registry";
import {
  QuadraticStrategy,
  QUADRATIC_STRATEGY_DESCRIPTOR,
} from "./strategies/quadratic";
import {
  MANIPULATION_STRATEGY_DESCRIPTOR,
  ManipulationStrategy,
} from "./strategies/manipulation";
import {
  SOLVE_STRATEGY_DESCRIPTOR,
  SolveStrategy,
} from "./strategies/solve";
import {
  CALCULUS_STRATEGY_DESCRIPTOR,
  CalculusStrategy,
} from "./strategies/calculus";
import {
  MATRIX_STRATEGY_DESCRIPTOR,
  MatrixStrategy,
} from "./strategies/matrix";


registerStrategy({
  descriptor: QUADRATIC_STRATEGY_DESCRIPTOR,
  factory: () => new QuadraticStrategy(),
});
registerStrategy({
  descriptor: MANIPULATION_STRATEGY_DESCRIPTOR,
  factory: () => new ManipulationStrategy(),
});
registerStrategy({
  descriptor: SOLVE_STRATEGY_DESCRIPTOR,
  factory: () => new SolveStrategy(),
});
registerStrategy({
  descriptor: CALCULUS_STRATEGY_DESCRIPTOR,
  factory: () => new CalculusStrategy(),
});

registerStrategy({
  descriptor: MATRIX_STRATEGY_DESCRIPTOR,
  factory: () => new MatrixStrategy(),
});
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
    const descriptor = analyzeProblem(simplified);
    const expression = buildExpressionContext(simplified);

    const { result: strategyResult } = resolveStrategy(
      input,
      tokens,
      ast,
      simplified,
      descriptor,
      expression,
    );

    const solution = strategyResult?.solution ?? buildFallbackSolution(simplified, descriptor);

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

function buildFallbackSolution(
  simplified: Node,
  descriptor: ProblemDescriptor,
): SolutionBundle {
  const exact = toKaTeX(simplified);
  let approxValue: number | null = null;
  let approx: string | null = null;

  try {
    const evaluation = evaluate(simplified, { precision: 12 });
    if (isUnitResult(evaluation)) {
      approxValue = null;
      approx = formatUnitApproximation(evaluation);
    } else if (isComplexResult(evaluation)) {
      approxValue = null;
      approx = formatComplexApproximation(evaluation);
    } else {
      approxValue = evaluation;
      approx = formatApproximation(evaluation);
    }
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
    followUps: [],
  };
}

function formatApproximation(value: number): string {
  const fixed = value.toFixed(8);
  return fixed.replace(/\.0+$/, "").replace(/0+$/, "");
}

function formatComplexApproximation(value: ComplexResult): string {
  const real = formatApproximation(value.real);
  const imaginary = formatApproximation(Math.abs(value.imaginary));
  const sign = value.imaginary >= 0 ? "+" : "-";
  return `${real} ${sign} ${imaginary}i`;
}

function formatUnitApproximation(value: UnitResult): string {
  const magnitude = formatApproximation(value.magnitude);
  return value.unit ? `${magnitude} ${value.unit}` : magnitude;
}

