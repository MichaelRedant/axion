import Big from "big.js";
import { cloneNode } from "../ast";
import type { Node } from "../ast";
import type {
  ComplexValue,
  ExplainReference,
  PlotConfig,
  SolutionBundle,
  SolutionStep,
} from "../solution";
import type {
  ProblemStrategy,
  StrategyContext,
  StrategyResult,
  StrategyDescriptor,
} from "./base";

interface QuadraticCoefficients {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly variable: string;
}

export const QUADRATIC_STRATEGY_DESCRIPTOR: StrategyDescriptor = {
  id: "strategy.quadratic",
  handles: ["quadratic"],
  priority: 100,
};

export class QuadraticStrategy implements ProblemStrategy {
  readonly descriptor = QUADRATIC_STRATEGY_DESCRIPTOR;

  matches(context: StrategyContext): boolean {
    return context.descriptor.type === "quadratic";
  }

  solve(context: StrategyContext): StrategyResult | null {
    const variable =
      context.descriptor.metadata.primaryVariable ??
      context.descriptor.metadata.variables[0];
    if (!variable) {
      return null;
    }

    const coefficients = extractQuadraticCoefficients(context.ast, variable);
    if (!coefficients) {
      return null;
    }

    const { a, b, c } = coefficients;
    if (almostZero(a)) {
      return null;
    }

    const discriminant = computeDiscriminant(a, b, c);
    const sqrtAbs = Math.sqrt(Math.abs(discriminant));
    const denominator = 2 * a;
    const hasComplex = discriminant < 0;

    const exact = buildExactLatex(a, b, discriminant);
    const steps = buildSteps({ a, b, c, discriminant, variable, exact });
    const followUps = buildFollowUps();
    const rationale = buildRationale(discriminant);

    let roots: Array<number | ComplexValue>;
    let approx: string | null;

    if (hasComplex) {
      const realPart = -b / denominator;
      const imagPart = sqrtAbs / Math.abs(denominator);
      const rootPlus = makeComplex(realPart, imagPart);
      const rootMinus = makeComplex(realPart, -imagPart);
      roots = [rootPlus, rootMinus];
      approx = `${variable}_1 ~= ${rootPlus.approx}, ${variable}_2 ~= ${rootMinus.approx}`;
    } else {
      const rootPlus = roundTo((-b + sqrtAbs) / denominator);
      const rootMinus = roundTo((-b - sqrtAbs) / denominator);
      roots = [rootPlus, rootMinus];
      approx = `${variable}_1 ~= ${formatNumber(rootPlus)}, ${variable}_2 ~= ${formatNumber(rootMinus)}`;
    }

    const expressionNode = createPolynomialNode(context.ast);
    const plotConfig =
      !hasComplex && expressionNode
        ? buildPlotConfig(expressionNode, variable, roots as number[], { a, b, c })
        : null;

    const solution: SolutionBundle = {
      type: "quadratic",
      descriptor: context.descriptor,
      exact,
      approx,
      approxValue: null,
      steps,
      rationale,
      plotConfig,
      details: {
        discriminant,
      },
      roots,
      followUps,
    };

    return { solution };
  }
}

function extractQuadraticCoefficients(
  ast: Node,
  variable: string,
): QuadraticCoefficients | null {
  const normalized = convertToPolynomial(ast);
  if (!normalized) {
    return null;
  }

  const coefficients = new Map<number, number>();
  if (!accumulateCoefficients(normalized, variable, coefficients, 1)) {
    return null;
  }

  const a = coefficients.get(2) ?? 0;
  const b = coefficients.get(1) ?? 0;
  const c = coefficients.get(0) ?? 0;
  if (almostZero(a)) {
    return null;
  }

  return { a, b, c, variable };
}

function convertToPolynomial(node: Node): Node | null {
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

function accumulateCoefficients(
  node: Node,
  variable: string,
  terms: Map<number, number>,
  scale: number,
): boolean {
  switch (node.type) {
    case "Number": {
      const value = Number(node.value);
      terms.set(0, (terms.get(0) ?? 0) + scale * value);
      return true;
    }
    case "Symbol": {
      if (node.name !== variable) {
        return false;
      }
      terms.set(1, (terms.get(1) ?? 0) + scale);
      return true;
    }
    case "Unary": {
      const nextScale = node.operator === "-" ? -scale : scale;
      return accumulateCoefficients(node.argument, variable, terms, nextScale);
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
        if (!left || !right) {
          return false;
        }
        const degree = left.degree + right.degree;
        const coefficient = scale * left.coefficient * right.coefficient;
        terms.set(degree, (terms.get(degree) ?? 0) + coefficient);
        return true;
      }
      if (node.operator === "^") {
        if (
          node.left.type === "Symbol" &&
          node.left.name === variable &&
          node.right.type === "Number"
        ) {
          const exponent = Number(node.right.value);
          terms.set(exponent, (terms.get(exponent) ?? 0) + scale);
          return true;
        }
      }
      return false;
    }
    case "Call":
      return false;
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
    if (node.name !== variable) {
      return undefined;
    }
    return { coefficient: 1, degree: 1 };
  }
  if (node.type === "Unary") {
    const info = extractMonomial(node.argument, variable);
    if (!info) {
      return undefined;
    }
    return {
      coefficient: info.coefficient * (node.operator === "-" ? -1 : 1),
      degree: info.degree,
    };
  }
  if (node.type === "Binary" && node.operator === "*") {
    const left = extractMonomial(node.left, variable);
    const right = extractMonomial(node.right, variable);
    if (!left || !right) {
      return undefined;
    }
    return {
      coefficient: left.coefficient * right.coefficient,
      degree: left.degree + right.degree,
    };
  }
  if (node.type === "Binary" && node.operator === "^") {
    if (
      node.left.type === "Symbol" &&
      node.left.name === variable &&
      node.right.type === "Number"
    ) {
      return {
        coefficient: 1,
        degree: Number(node.right.value),
      };
    }
  }
  return undefined;
}

function computeDiscriminant(a: number, b: number, c: number): number {
  return b * b - 4 * a * c;
}

function buildExactLatex(a: number, b: number, discriminant: number): string {
  const numerator = formatNumber(-b);
  const denominator = formatNumber(2 * a);
  return `\\frac{${numerator} \\pm \\sqrt{${formatNumber(discriminant)}}}{${denominator}}`;
}

function buildSteps({
  a,
  b,
  c,
  discriminant,
  variable,
  exact,
}: {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly discriminant: number;
  readonly variable: string;
  readonly exact: string;
}): SolutionStep[] {
  const discriminantLatex = [
    "\\Delta = ",
    `${formatNumber(b)}^{2} - 4 \\cdot ${formatNumber(a)} \\cdot ${formatNumber(c)}`,
    ` = ${formatNumber(discriminant)}`,
  ].join("");

  return [
    {
      id: "identify",
      title: "Identificeer coefficienten",
      description: `Lees de waarden van a, b en c af uit de vergelijking in ${variable}.`,
      latex: `a = ${formatNumber(a)},\\; b = ${formatNumber(b)},\\; c = ${formatNumber(c)}`,
    },
    {
      id: "discriminant",
      title: "Bereken de discriminant",
      description:
        discriminant >= 0
          ? "De discriminant is niet negatief, dus er zijn reele oplossingen."
          : "De discriminant is negatief, dus de oplossingen zijn complex.",
      latex: discriminantLatex,
    },
    {
      id: "quadratic-formula",
      title: "Pas de kwadratische formule toe",
      description: "Vul de waarden in de formule en vereenvoudig indien mogelijk.",
      latex: `\\displaystyle ${variable}_{1,2} = ${exact}`,
    },
  ];
}

function buildFollowUps(): ExplainReference[] {
  return [
    {
      id: "explain-step-identify",
      label: "Leg stap 1 uit",
      targetStepId: "identify",
    },
    {
      id: "show-discriminant",
      label: "Toon discriminant",
      targetStepId: "discriminant",
    },
  ];
}

function buildRationale(discriminant: number): string {
  if (discriminant > 0) {
    return "De discriminant is positief, daarom snijdt de parabool de x-as in twee punten.";
  }
  if (almostZero(discriminant)) {
    return "De discriminant is nul. De parabool raakt de x-as in precies een punt (dubbele wortel).";
  }
  return "De discriminant is negatief. De parabool snijdt de x-as niet en de oplossingen vormen een complex geconjugeerd paar.";
}

function buildPlotConfig(
  expression: Node,
  variable: string,
  realRoots: number[],
  { a, b, c }: { readonly a: number; readonly b: number; readonly c: number },
): PlotConfig {
  const label = `f(${variable}) = ${formatPolynomial(a, b, c, variable)}`;
  return {
    type: "cartesian",
    variable,
    expression,
    domain: estimateDomain(realRoots),
    samples: 200,
    label,
    axes: {
      x: { label: variable },
      y: { label: "f(x)" },
    },
    annotations: realRoots.map((root) => ({
      type: "point",
      coordinates: [root, 0],
      label: `${variable} = ${formatNumber(root)}`,
    })),
  };
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

function makeComplex(real: number, imaginary: number): ComplexValue {
  const realRounded = roundTo(real);
  const imagRounded = roundTo(imaginary);
  const sign = imagRounded >= 0 ? "+" : "-";
  const magnitude = formatNumber(Math.abs(imagRounded));

  const latex =
    imagRounded === 0
      ? formatNumber(realRounded)
      : `${formatNumber(realRounded)} ${sign} ${magnitude} i`;

  return {
    real: realRounded,
    imaginary: imagRounded,
    latex,
    approx: latex,
  };
}

function estimateDomain(roots: number[]): [number, number] {
  if (!roots.length) {
    return [-10, 10];
  }
  const min = Math.min(...roots);
  const max = Math.max(...roots);
  const span = Math.max(6, Math.abs(max - min) + 4);
  return [Math.floor(min - span), Math.ceil(max + span)];
}

function formatPolynomial(
  a: number,
  b: number,
  c: number,
  variable: string,
): string {
  const parts = [
    `${formatNumber(a)}${variable}^{2}`,
    `${b >= 0 ? "+" : "-"} ${formatNumber(Math.abs(b))}${variable}`,
    `${c >= 0 ? "+" : "-"} ${formatNumber(Math.abs(c))}`,
  ];
  return parts.join(" ");
}

function formatNumber(value: number): string {
  const big = new Big(value);
  return big.toPrecision(6).replace(/\.?0+$/, "");
}

function roundTo(value: number): number {
  const big = new Big(value);
  return Number(big.toFixed(6));
}

function almostZero(value: number, epsilon = 1e-9): boolean {
  return Math.abs(value) < epsilon;
}
