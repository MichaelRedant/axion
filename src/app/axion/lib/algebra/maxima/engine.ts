import type { EvaluationResult } from "../engine";
import type { ProblemDescriptor } from "../problems";
import { analyzeProblem } from "../problems";
import type { SolutionBundle, SolutionStep } from "../solution";
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

  const steps = normalizeMaximaSteps(payload.steps);

  if (payload.steps?.length) {
    details.steps = payload.steps;
  }

  return {
    type: descriptor.type,
    descriptor,
    exact: exactLatex,
    approx: payload.approx ?? null,
    approxValue,
    steps,
    plotConfig: null,
    followUps: [],
    rationale: payload.diagnostics.length ? payload.diagnostics.join("\n") : undefined,
    details,
  } satisfies SolutionBundle;
}

function normalizeMaximaSteps(rawSteps: unknown): SolutionStep[] {
  if (!Array.isArray(rawSteps)) {
    return [];
  }

  return rawSteps
    .map((entry, index) => normalizeMaximaStep(entry, index))
    .filter((step): step is SolutionStep => step !== null);
}

function normalizeMaximaStep(entry: unknown, index: number): SolutionStep | null {
  const fallbackId = `maxima-step-${index + 1}`;

  if (entry === null || entry === undefined) {
    return null;
  }

  if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
    const description = toStepString(entry);
    if (!description) {
      return null;
    }
    return {
      id: fallbackId,
      title: `Step ${index + 1}`,
      description,
    } satisfies SolutionStep;
  }

  if (Array.isArray(entry)) {
    const description = toStepString(entry);
    if (!description) {
      return null;
    }
    return {
      id: fallbackId,
      title: `Step ${index + 1}`,
      description,
    } satisfies SolutionStep;
  }

  if (typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const id =
    readStepField(record, ["id", "stepId", "key"]) ??
    fallbackId;
  const title =
    readStepField(record, ["title", "label", "name", "heading", "summary"]) ??
    `Step ${index + 1}`;
  const description =
    readStepField(record, [
      "description",
      "body",
      "text",
      "detail",
      "explanation",
      "content",
      "message",
      "note",
      "value",
    ]) ??
    readStepList(record, ["lines", "bullets", "items", "steps"]);
  const latex = readStepField(record, ["latex", "tex", "katex", "math"]);
  const expression = readStepField(record, ["expression", "code", "input", "raw", "command"]);

  if (!description && !latex && !expression) {
    return null;
  }

  return {
    id,
    title,
    description: description ?? "",
    ...(latex ? { latex } : {}),
    ...(expression ? { expression } : {}),
  };
}

function readStepField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    if (!(key in record)) {
      continue;
    }
    const value = record[key];
    const text = toStepString(value);
    if (text) {
      return text;
    }
  }
  return null;
}

function readStepList(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) {
      continue;
    }
    const parts = value
      .map((item) => toStepString(item))
      .filter((part): part is string => Boolean(part));
    if (parts.length) {
      return parts.join("\n");
    }
  }
  return null;
}

function toStepString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => toStepString(item))
      .filter((part): part is string => Boolean(part));
    if (parts.length) {
      return parts.join("\n");
    }
    return null;
  }

  if (typeof value === "object") {
    const nested = value as Record<string, unknown>;
    for (const key of ["text", "description", "value", "content"]) {
      if (!(key in nested)) {
        continue;
      }
      const candidate = nested[key];
      if (candidate === value) {
        continue;
      }
      const text = toStepString(candidate);
      if (text) {
        return text;
      }
    }
  }

  return null;
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
