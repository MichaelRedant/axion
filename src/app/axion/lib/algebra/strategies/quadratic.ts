import Big from "big.js";
import type { Node } from "../ast";
import type { ComplexValue, SolutionBundle, SolutionStep } from "../solution";
import type { StrategyContext, ProblemStrategy } from "./base";
import type { PlotConfig } from "../solution";
import { cloneNode } from "../ast";

interface QuadraticCoefficients {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly variable: string;
}

export class QuadraticStrategy implements ProblemStrategy {
  readonly type = "quadratic";

  match(context: StrategyContext): boolean {
    return context.descriptor.type === "quadratic";
  }

  solve(context: StrategyContext): SolutionBundle | null {
    const coefficients = extractQuadraticCoefficients(context.ast, context.descriptor.metadata.variables[0]);
    if (!coefficients) {
      return null;
    }

    const { a, b, c, variable } = coefficients;
    if (a === 0) {
      return null;
    }

    const discriminant = b * b - 4 * a * c;
    const deltaLatex = `\\Delta = ${formatNumber(b)}^{2} - 4 \\cdot ${formatNumber(a)} \\cdot ${formatNumber(c)} = ${formatNumber(discriminant)}`;

    const twoA = 2 * a;
    const sqrtDelta = discriminant >= 0 ? Math.sqrt(discriminant) : Math.sqrt(Math.abs(discriminant));
    const hasComplex = discriminant < 0;

    const realPart = -b / twoA;
    const imaginaryPart = hasComplex ? sqrtDelta / twoA : 0;
    const root1 = hasComplex ? complexValue(realPart, imaginaryPart, variable) : formatNumber((-b + sqrtDelta) / twoA);
    const root2 = hasComplex ? complexValue(realPart, -imaginaryPart, variable) : formatNumber((-b - sqrtDelta) / twoA);

    const exactLatex = `\\frac{-${formatNumber(b)} \\pm \\sqrt{${formatNumber(discriminant)}}}{2 \\cdot ${formatNumber(a)}}`;

    const steps: SolutionStep[] = [
      {
        id: "identify",
        title: "Identificeer coÃ«fficiÃ«nten",
        description: `Voor ${variable}^2 + ${variable} + constanten: a = ${formatNumber(a)}, b = ${formatNumber(b)}, c = ${formatNumber(c)}.`,
        latex: `a = ${formatNumber(a)},\\; b = ${formatNumber(b)},\\; c = ${formatNumber(c)}`,
      },
      {
        id: "discriminant",
        title: "Bereken discriminant",
        description: discriminant >= 0
          ? `De discriminant is ${discriminant} (reÃ«le oplossingen).`
          : `De discriminant is ${discriminant} (complexe oplossingen).`,
        latex: deltaLatex,
      },
      {
        id: "quadratic-formula",
        title: "Pas de abc-formule toe",
        description: "Gebruik de algemene formule voor kwadratische vergelijkingen.",
        latex: `\\displaystyle ${variable}_{1,2} = ${exactLatex}`,
      },
    ];

    const approx = hasComplex
      ? `${variable}_1 â‰ˆ ${root1.approx}, ${variable}_2 â‰ˆ ${root2.approx}`
      : `${variable}_1 â‰ˆ ${formatNumber((-b + sqrtDelta) / twoA)}, ${variable}_2 â‰ˆ ${formatNumber((-b - sqrtDelta) / twoA)}`;

    const roots = hasComplex
      ? [root1, root2]
      : [roundTo((-b + sqrtDelta) / twoA), roundTo((-b - sqrtDelta) / twoA)];

    const expressionNode = createPolynomialNode(context.ast);
    const plotConfig: PlotConfig | null =
      expressionNode && !hasComplex
        ? {
            type: "function",
            variable,
            expression: expressionNode,
            domain: estimateDomain(roots as number[]),
            samples: 120,
            label: `f(${variable}) = ${formatPolynomial(a, b, c, variable)}`,
          }
        : null;

    return {
      type: "quadratic",
      descriptor: context.descriptor,
      exact: exactLatex,
      approx,
      approxValue: null,
      steps,
      rationale:
        "De quadratische formule levert de oplossingen zodra de discriminant is bepaald. Complexe oplossingen ontstaan wanneer de discriminant negatief is.",
      plotConfig,
      details: {
        discriminant,
      },
      roots,
    };
  }
}

function extractQuadraticCoefficients(ast: Node, variable?: string): QuadraticCoefficients | null {
  if (!variable) return null;
  const normalized = convertToPolynomial(ast);
  if (!normalized) return null;
  const coefficients = new Map<number, number>();
  if (!accumulateCoefficients(normalized, variable, coefficients, 1)) {
    return null;
  }
  const a = coefficients.get(2) ?? 0;
  const b = coefficients.get(1) ?? 0;
  const c = coefficients.get(0) ?? 0;
  if (a === 0) return null;
  return { a, b, c, variable };
}

function convertToPolynomial(node: Node): Node | null {
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

function accumulateCoefficients(
  node: Node,
  variable: string,
  terms: Map<number, number>,
  scale: number,
): boolean {
  switch (node.type) {
    case "Number": {
      terms.set(0, (terms.get(0) ?? 0) + scale * Number(node.value));
      return true;
    }
    case "Symbol": {
      if (node.name !== variable) return false;
      terms.set(1, (terms.get(1) ?? 0) + scale);
      return true;
    }
    case "Unary": {
      const factor = node.operator === "-" ? -scale : scale;
      return accumulateCoefficients(node.argument, variable, terms, factor);
    }
    case "Binary": {
      if (node.operator === "+") {
        return (
          accumulateCoefficients(node.left, variable, terms, scale) &&
          accumulateCoefficients(node.right, variable, terms, scale)
        );
      }
      if (node.operator === "-") {
        return (
          accumulateCoefficients(node.left, variable, terms, scale) &&
          accumulateCoefficients(node.right, variable, terms, -scale)
        );
      }
      if (node.operator === "*") {
        const left = extractMonomial(node.left, variable);
        const right = extractMonomial(node.right, variable);
        if (!left || !right) return false;
        const degree = left.degree + right.degree;
        const coefficient = scale * left.coefficient * right.coefficient;
        terms.set(degree, (terms.get(degree) ?? 0) + coefficient);
        return true;
      }
      if (node.operator === "^") {
        if (node.left.type === "Symbol" && node.left.name === variable && node.right.type === "Number") {
          const exponent = Number(node.right.value);
          terms.set(exponent, (terms.get(exponent) ?? 0) + scale);
          return true;
        }
      }
      return false;
    }
    default:
      return false;
  }
}

interface Monomial {
  readonly coefficient: number;
  readonly degree: number;
}

function extractMonomial(node: Node, variable: string): Monomial | undefined {
  if (node.type === "Number") {
    return { coefficient: Number(node.value), degree: 0 };
  }
  if (node.type === "Symbol") {
    if (node.name !== variable) return undefined;
    return { coefficient: 1, degree: 1 };
  }
  if (node.type === "Unary") {
    const info = extractMonomial(node.argument, variable);
    if (!info) return undefined;
    return {
      coefficient: info.coefficient * (node.operator === "-" ? -1 : 1),
      degree: info.degree,
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

function formatNumber(value: number): string {
  const big = new Big(value);
  return big.toPrecision(6).replace(/\.?0+$/, "");
}

function roundTo(value: number): number {
  return Number(new Big(value).toFixed(6));
}

function complexValue(real: number, imaginary: number, variable: string): ComplexValue {
  const realRounded = roundTo(real);
  const imagRounded = roundTo(imaginary);
  const latex =
    imagRounded === 0
      ? `${realRounded}`
      : `${realRounded} ${imagRounded >= 0 ? "+" : "-"} ${Math.abs(imagRounded)}i`;
  return {
    real: realRounded,
    imaginary: imagRounded,
    latex,
    approx: latex,
  };
}

function estimateDomain(roots: number[]): [number, number] {
  if (!roots.length) return [-10, 10];
  const min = Math.min(...roots);
  const max = Math.max(...roots);
  const span = Math.max(5, Math.abs(max - min) + 2);
  return [Math.floor(min - span), Math.ceil(max + span)];
}

function formatPolynomial(a: number, b: number, c: number, variable: string): string {
  const parts = [
    `${formatNumber(a)}${variable}^{2}`,
    `${b >= 0 ? "+" : "-"} ${formatNumber(Math.abs(b))}${variable}`,
    `${c >= 0 ? "+" : "-"} ${formatNumber(Math.abs(c))}`,
  ];
  return parts.join(" ");
}

function createPolynomialNode(node: Node): Node | null {
  if (node.type === "Binary" && node.operator === "=") {
    return {
      type: "Binary",
      operator: "-",
      left: cloneNode(node.left),
      right: cloneNode(node.right),
      start: node.start,
      end: node.end,
    };
  }
  return cloneNode(node);
}
