import type { Node } from "./ast";

export type ProblemType =
  | "quadratic"
  | "linear"
  | "differential"
  | "matrix"
  | "limit"
  | "probability"
  | "optimization"
  | "unknown";

export interface ProblemMetadata {
  readonly variables: string[];
  readonly degree?: number;
  readonly hasEquality: boolean;
}

export interface ProblemDescriptor {
  readonly type: ProblemType;
  readonly metadata: ProblemMetadata;
}

export function analyzeProblem(ast: Node): ProblemDescriptor {
  const variables = new Set<string>();
  const hasEquality = containsOperator(ast, "=");
  collectVariables(ast, variables);

  const metadata: ProblemMetadata = {
    variables: [...variables],
    hasEquality,
  };

  const candidate = detectPolynomialDegree(ast, metadata.variables[0]);
  if (candidate !== undefined) {
    metadata.degree = candidate;
    if (candidate === 2) {
      return { type: "quadratic", metadata };
    }
    if (candidate === 1) {
      return { type: "linear", metadata };
    }
  }

  return {
    type: "unknown",
    metadata,
  };
}

function collectVariables(node: Node, variables: Set<string>) {
  switch (node.type) {
    case "Symbol":
      variables.add(node.name);
      break;
    case "Unary":
      collectVariables(node.argument, variables);
      break;
    case "Binary":
      collectVariables(node.left, variables);
      collectVariables(node.right, variables);
      break;
    case "Call":
      for (const arg of node.args) {
        collectVariables(arg, variables);
      }
      break;
    default:
      break;
  }
}

function containsOperator(node: Node, operator: string): boolean {
  if (node.type === "Binary" && node.operator === operator) {
    return true;
  }
  if (node.type === "Unary") {
    return containsOperator(node.argument, operator);
  }
  if (node.type === "Binary") {
    return containsOperator(node.left, operator) || containsOperator(node.right, operator);
  }
  if (node.type === "Call") {
    return node.args.some((arg) => containsOperator(arg, operator));
  }
  return false;
}

function detectPolynomialDegree(node: Node, variable?: string): number | undefined {
  if (!variable) return undefined;
  const normalized = normalizeEquation(node);
  if (!normalized) return undefined;
  const degrees = collectDegrees(normalized, variable);
  if (!degrees) return undefined;
  const maxDegree = Math.max(...degrees.keys());
  if (!Number.isFinite(maxDegree)) return undefined;
  return maxDegree;
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
