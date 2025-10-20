import type { CallNode, Node } from "./ast";

export type ProblemType =
  | "quadratic"
  | "linear"
  | "differential"
  | "matrix"
  | "limit"
  | "probability"
  | "optimization"
  | "unknown";

export interface MatrixStructure {
  readonly operations: string[];
  readonly dimensions: [number, number] | null;
}

export interface LimitMetadata {
  readonly symbol: string;
  readonly variable: string | null;
  readonly approaching: string | null;
}

export interface ProblemMetadata {
  readonly variables: string[];
  readonly primaryVariable: string | null;
  readonly degree?: number;
  readonly hasEquality: boolean;
  readonly operators: string[];
  readonly functions: string[];
  readonly matrix: MatrixStructure | null;
  readonly limit: LimitMetadata | null;
  readonly hasDifferential: boolean;
  readonly hasProbability: boolean;
  readonly hasOptimization: boolean;
}

export interface ProblemDescriptor {
  readonly type: ProblemType;
  readonly metadata: ProblemMetadata;
}

import { isUnitSymbol } from "./core/units";

const RESERVED_SYMBOLS = new Set(["pi", "e"]);
const MATRIX_FUNCTIONS = new Set(["matrix", "mat", "det", "adj", "inv", "inverse", "transpose", "rank", "matadd", "matmul", "eigen", "eig", "svd", "solveSystem", "vector", "vec"]);
const LIMIT_FUNCTIONS = new Set(["lim", "limit"]);
const DIFFERENTIAL_FUNCTIONS = new Set(["diff", "d", "deriv", "derivative", "integrate", "int"]);
const PROBABILITY_FUNCTIONS = new Set(["p", "pr", "pdf", "cdf", "pmf", "binom", "comb", "ncr", "bernoulli", "poisson", "normal"]);
const OPTIMIZATION_FUNCTIONS = new Set(["min", "max", "argmin", "argmax", "optimize", "lagrange", "gradient"]);

export class ProblemClassifier {
  classify(ast: Node): ProblemDescriptor {
    const metadata = collectMetadata(ast);
    const type = inferProblemType(ast, metadata);
    return { type, metadata };
  }
}

export function analyzeProblem(ast: Node): ProblemDescriptor {
  return new ProblemClassifier().classify(ast);
}

function collectMetadata(ast: Node): ProblemMetadata {
  const variables = new Set<string>();
  const operators = new Set<string>();
  const functions = new Set<string>();
  const matrixOps = new Set<string>();
  const probabilitySignals = new Set<string>();
  const optimizationSignals = new Set<string>();

  let hasDifferential = false;
  let limitMetadata: LimitMetadata | null = null;
  let firstMatrixCall: CallNode | null = null;

  traverse(ast, (node) => {
    if (node.type === "Symbol" && !RESERVED_SYMBOLS.has(node.name) && !isUnitSymbol(node.name)) {
      variables.add(node.name);
      if (isDifferentialSymbol(node.name)) {
        hasDifferential = true;
      }
    }

    if (node.type === "Binary") {
      operators.add(node.operator);
    }

    if (node.type === "Call") {
      functions.add(node.callee);
      const callee = node.callee.toLowerCase();
      if (MATRIX_FUNCTIONS.has(callee)) {
        matrixOps.add(callee);
        if (!firstMatrixCall && (callee === "matrix" || callee === "mat")) {
          firstMatrixCall = node;
        }
      }
      if (LIMIT_FUNCTIONS.has(callee) && !limitMetadata) {
        limitMetadata = buildLimitMetadata(node);
      }
      if (DIFFERENTIAL_FUNCTIONS.has(callee)) {
        hasDifferential = true;
      }
      if (PROBABILITY_FUNCTIONS.has(callee)) {
        probabilitySignals.add(callee);
      }
      if (OPTIMIZATION_FUNCTIONS.has(callee)) {
        optimizationSignals.add(callee);
      }
    }
  });

  const variableList = [...variables];
  const primaryVariable = variableList.find((name) => name.length === 1) ?? variableList[0] ?? null;
  const degree = detectPolynomialDegree(ast, primaryVariable ?? undefined);
  const hasEquality = operators.has("=");

  const matrix: MatrixStructure | null = matrixOps.size
    ? {
        operations: [...matrixOps].sort(),
        dimensions: inferMatrixDimensions(firstMatrixCall),
      }
    : null;

  return {
    variables: variableList,
    primaryVariable,
    degree,
    hasEquality,
    operators: [...operators].sort(),
    functions: [...functions].sort(),
    matrix,
    limit: limitMetadata,
    hasDifferential,
    hasProbability: probabilitySignals.size > 0,
    hasOptimization: optimizationSignals.size > 0,
  };
}

function inferProblemType(ast: Node, metadata: ProblemMetadata): ProblemType {
  if (metadata.hasDifferential) {
    return "differential";
  }
  if (metadata.limit) {
    return "limit";
  }
  if (metadata.matrix) {
    return "matrix";
  }
  if (metadata.hasProbability) {
    return "probability";
  }
  if (metadata.hasOptimization) {
    return "optimization";
  }
  if (metadata.degree === 2) {
    return "quadratic";
  }
  if (metadata.degree === 1) {
    return "linear";
  }
  if (containsDifferentialNotation(ast)) {
    return "differential";
  }
  return "unknown";
}

function traverse(node: Node, visit: (node: Node) => void) {
  visit(node);
  switch (node.type) {
    case "Unary":
      traverse(node.argument, visit);
      break;
    case "Binary":
      traverse(node.left, visit);
      traverse(node.right, visit);
      break;
    case "Call":
      for (const arg of node.args) {
        traverse(arg, visit);
      }
      break;
    default:
      break;
  }
}

function buildLimitMetadata(node: CallNode): LimitMetadata {
  const firstArg = node.args[0];
  const variable = extractSymbolName(firstArg);
  const secondArg = node.args[1];
  const approaching = extractApproachTarget(secondArg);
  return {
    symbol: node.callee,
    variable,
    approaching,
  };
}

function extractSymbolName(node: Node | undefined): string | null {
  if (!node) return null;
  if (node.type === "Symbol") return isUnitSymbol(node.name) ? null : node.name;
  if (node.type === "Binary" && node.operator === "=") {
    return extractSymbolName(node.left);
  }
  return null;
}

function extractApproachTarget(node: Node | undefined): string | null {
  if (!node) return null;
  if (node.type === "Number") return node.value;
  if (node.type === "Symbol") return isUnitSymbol(node.name) ? null : node.name;
  if (node.type === "Call") return node.callee;
  return null;
}

function inferMatrixDimensions(node: CallNode | null): [number, number] | null {
  if (!node) return null;
  if (!node.args.length) return null;

  // Heuristic: matrix(row(...), row(...))
  const rowCalls = node.args.filter((arg): arg is CallNode => arg.type === "Call");
  if (rowCalls.length === node.args.length && rowCalls.length > 0) {
    const columnCounts = rowCalls.map((row) => row.args.length);
    const uniform = columnCounts.every((count) => count === columnCounts[0]);
    if (uniform) {
      return [rowCalls.length, columnCounts[0] ?? 0];
    }
  }

  // Heuristic: matrix(rows, cols, ...)
  if (node.args[0]?.type === "Number" && node.args[1]?.type === "Number") {
    const rows = Number(node.args[0].value);
    const cols = Number(node.args[1].value);
    if (Number.isFinite(rows) && Number.isFinite(cols)) {
      return [rows, cols];
    }
  }

  return null;
}

function detectPolynomialDegree(node: Node, variable?: string): number | undefined {
  if (!variable) return undefined;
  const normalized = normalizeEquation(node);
  if (!normalized) return undefined;
  const degrees = collectDegrees(normalized, variable);
  if (!degrees?.size) return undefined;
  const maxDegree = Math.max(...degrees.keys());
  return Number.isFinite(maxDegree) ? maxDegree : undefined;
}

function normalizeEquation(node: Node): Node | undefined {
  if (node.type === "Binary" && node.operator === "=") {
    return {
      type: "Binary",
      operator: "-",
      left: node.left,
      right: node.right,
      start: node.start,
      end: node.end,
    };
  }
  return node;
}

function collectDegrees(root: Node, variable: string): Map<number, number> | undefined {
  const map = new Map<number, number>();
  if (!accumulatePolynomialTerms(root, variable, map, 1)) {
    return undefined;
  }
  return map;
}

function accumulatePolynomialTerms(
  node: Node,
  variable: string,
  terms: Map<number, number>,
  sign: number,
): boolean {
  switch (node.type) {
    case "Number": {
      const value = Number(node.value);
      terms.set(0, (terms.get(0) ?? 0) + sign * value);
      return true;
    }
    case "Symbol": {
      if (node.name !== variable) return false;
      terms.set(1, (terms.get(1) ?? 0) + sign);
      return true;
    }
    case "Unary": {
      const nextSign = node.operator === "-" ? -sign : sign;
      return accumulatePolynomialTerms(node.argument, variable, terms, nextSign);
    }
    case "Binary": {
      if (node.operator === "+") {
        return (
          accumulatePolynomialTerms(node.left, variable, terms, sign) &&
          accumulatePolynomialTerms(node.right, variable, terms, sign)
        );
      }
      if (node.operator === "-") {
        return (
          accumulatePolynomialTerms(node.left, variable, terms, sign) &&
          accumulatePolynomialTerms(node.right, variable, terms, -sign)
        );
      }
      if (node.operator === "*") {
        const left = extractMonomial(node.left, variable);
        const right = extractMonomial(node.right, variable);
        if (!left || !right) return false;
        const degree = left.degree + right.degree;
        const coefficient = left.coefficient * right.coefficient * sign;
        terms.set(degree, (terms.get(degree) ?? 0) + coefficient);
        return true;
      }
      if (node.operator === "^") {
        if (node.left.type === "Symbol" && node.left.name === variable && node.right.type === "Number") {
          const exponent = Number(node.right.value);
          terms.set(exponent, (terms.get(exponent) ?? 0) + sign);
          return true;
        }
      }
      return false;
    }
    default:
      return false;
  }
}

interface MonomialInfo {
  readonly coefficient: number;
  readonly degree: number;
}

function extractMonomial(node: Node, variable: string): MonomialInfo | undefined {
  if (node.type === "Number") {
    return { coefficient: Number(node.value), degree: 0 };
  }
  if (node.type === "Symbol") {
    if (node.name !== variable) return undefined;
    return { coefficient: 1, degree: 1 };
  }
  if (node.type === "Unary") {
    const inner = extractMonomial(node.argument, variable);
    if (!inner) return undefined;
    return {
      coefficient: inner.coefficient * (node.operator === "-" ? -1 : 1),
      degree: inner.degree,
    };
  }
  if (node.type === "Binary" && node.operator === "*") {
    const left = extractMonomial(node.left, variable);
    const right = extractMonomial(node.right, variable);
    if (!left || !right) return undefined;
    return {
      coefficient: left.coefficient * right.coefficient,
      degree: left.degree + right.degree,
    };
  }
  if (node.type === "Binary" && node.operator === "^") {
    if (node.left.type === "Symbol" && node.left.name === variable && node.right.type === "Number") {
      return {
        coefficient: 1,
        degree: Number(node.right.value),
      };
    }
  }
  return undefined;
}

function isDifferentialSymbol(name: string): boolean {
  if (name.includes("'")) return true;
  if (name.startsWith("d") && name.length > 1) return true;
  return false;
}

function containsDifferentialNotation(node: Node): boolean {
  if (node.type === "Call" && DIFFERENTIAL_FUNCTIONS.has(node.callee.toLowerCase())) {
    return true;
  }
  if (node.type === "Binary") {
    return containsDifferentialNotation(node.left) || containsDifferentialNotation(node.right);
  }
  if (node.type === "Unary") {
    return containsDifferentialNotation(node.argument);
  }
  return false;
}





