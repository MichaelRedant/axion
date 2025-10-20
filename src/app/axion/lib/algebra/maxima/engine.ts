import type { EvaluationResult } from "../engine";
import type { ProblemDescriptor } from "../problems";
import { analyzeProblem } from "../problems";
import type { SolutionBundle } from "../solution";
import { simplify } from "../simplify";
import { parse } from "../parser";
import { tokenize } from "../tokenizer";
import { createMaximaClient, type MaximaTransport } from "./client";
import type { MaximaSuccessPayload } from "./parser";
import { isMaximaAvailable } from "./config";

export interface MaximaEngineOptions {
  readonly client?: MaximaTransport | null;
  readonly endpoint?: string | null;
}

export async function analyzeWithMaxima(
  input: string,
  options?: MaximaEngineOptions,
): Promise<EvaluationResult> {
  const client = options?.client ?? createMaximaClient({ endpoint: options?.endpoint ?? null });

  if (!client) {
    return {
      ok: false,
      engine: "maxima",
      message: "Maxima is niet geconfigureerd",
      position: 0,
    };
  }

  if (!isMaximaAvailable() && !options?.client) {
    return {
      ok: false,
      engine: "maxima",
      message: "Maxima is uitgeschakeld",
      position: 0,
    };
  }

  const evaluation = await client.evaluate(input, { format: "tex" });

  if (!evaluation.ok) {
    const message = evaluation.error || "Onbekende Maxima-fout";
    return {
      ok: false,
      engine: "maxima",
      message,
      position: 0,
    };
  }

  const { descriptor, tokens, ast, simplified } = deriveDescriptor(input);
  const solution = buildMaximaSolution(evaluation, descriptor, input);

  return {
    ok: true,
    engine: "maxima",
    tokens,
    ast,
    simplified,
    solution,
    exact: solution.exact,
    approx: solution.approx,
    approxValue: solution.approxValue ?? null,
  };
}

function deriveDescriptor(input: string): {
  descriptor: ProblemDescriptor;
  tokens?: ReturnType<typeof tokenize>;
  ast?: ReturnType<typeof parse>;
  simplified?: ReturnType<typeof simplify>;
} {
  try {
    const tokens = tokenize(input);
    const ast = parse(tokens);
    const simplified = simplify(ast);
    const descriptor = analyzeProblem(simplified);
    return { descriptor, tokens, ast, simplified };
  } catch {
    return { descriptor: buildMaximaDescriptor() };
  }
}

function buildMaximaSolution(
  payload: MaximaSuccessPayload,
  descriptor: ProblemDescriptor,
  fallbackExpression: string,
): SolutionBundle {
  const approxValue = parseApprox(payload.approx);
  const exactLatex = payload.latex ?? toLatexFromPlainText(payload.output || fallbackExpression);
  const details: Record<string, unknown> = {
    raw: payload.output || fallbackExpression,
  };

  if (payload.diagnostics.length) {
    details.diagnostics = payload.diagnostics;
  }

  if (payload.metadata) {
    details.metadata = payload.metadata;
  }

  if (payload.steps?.length) {
    details.steps = payload.steps;
  }

  return {
    type: descriptor.type,
    descriptor,
    exact: exactLatex,
    approx: payload.approx ?? null,
    approxValue,
    steps: [],
    plotConfig: null,
    followUps: [],
    rationale: payload.diagnostics.length ? payload.diagnostics.join("\n") : undefined,
    details,
  } satisfies SolutionBundle;
}

function buildMaximaDescriptor(): ProblemDescriptor {
  return {
    type: "maxima",
    metadata: {
      variables: [],
      primaryVariable: null,
      degree: undefined,
      hasEquality: false,
      operators: [],
      functions: [],
      matrix: null,
      limit: null,
      hasDifferential: false,
      hasProbability: false,
      hasOptimization: false,
    },
  } satisfies ProblemDescriptor;
}

function parseApprox(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toLatexFromPlainText(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/([{}_#$%&^~])/g, "\\$1")
    .replace(/\n/g, "\\\\ ");
  return `\\text{${escaped}}`;
}
