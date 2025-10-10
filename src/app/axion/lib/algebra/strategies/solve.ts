import Big from "big.js";
import { cloneNode, type BinaryNode, type Node } from "../ast";
import { toKaTeX } from "../format";
import type {
  ProblemStrategy,
  StrategyContext,
  StrategyDescriptor,
  StrategyResult,
} from "./base";
import {
  collectVariables,
  extractPolynomial,
  type Polynomial,
} from "../simplify";
import type { SolutionInterval, SolutionStep } from "../solution";

export const SOLVE_STRATEGY_DESCRIPTOR: StrategyDescriptor = {
  id: "strategy.solve",
  handles: [],
  priority: 400,
};

type ComparisonOperator = "=" | "<" | "<=" | ">" | ">=";

interface Comparison {
  readonly kind: "equation" | "inequality";
  readonly operator: ComparisonOperator;
  readonly expression: Node;
}

interface SolveResult {
  readonly exact: string;
  readonly roots: Array<number | ComplexRoot>;
  readonly steps: SolutionStep[];
  readonly rationale: string;
  readonly intervals?: SolutionInterval[];
}

interface ComplexRoot {
  readonly real: number;
  readonly imaginary: number;
  readonly latex: string;
  readonly approx: string;
}

interface RealRoot {
  readonly value: number;
  readonly latex: string;
  readonly multiplicity: number;
}

interface Complex {
  readonly re: number;
  readonly im: number;
}

const INEQUALITY_OPERATORS = new Set<ComparisonOperator>(["<", "<=", ">", ">="]);

export class SolveStrategy implements ProblemStrategy {
  readonly descriptor = SOLVE_STRATEGY_DESCRIPTOR;

  matches(context: StrategyContext): boolean {
    return isSolveCall(context.ast);
  }

  solve(context: StrategyContext): StrategyResult | null {
    if (context.ast.type !== "Call") return null;
    const target = context.ast.args[0];
    if (!target) return null;

    const comparison = parseComparison(target);
    if (!comparison) {
      return null;
    }

    const variableArg = context.ast.args[1];
    const preferredVariable = variableArg && variableArg.type === "Symbol" ? variableArg.name : null;

    const variables = collectVariables(comparison.expression);
    const variable = preferredVariable ?? variables.values().next().value ?? null;
    if (!variable) {
      return null;
    }

    const polynomial = extractPolynomial(comparison.expression, variable);
    if (!polynomial) {
      return null;
    }

    const degree = calculateDegree(polynomial);
    let solution: SolveResult | null = null;

  if (comparison.kind === "equation") {
    if (degree === 1) {
      solution = solveLinearEquation(polynomial, variable, comparison.expression);
    } else if (degree === 2) {
      solution = solveQuadraticEquation(polynomial, variable, comparison.expression);
    } else if (degree >= 3 && degree <= 4) {
      solution = solveHigherOrderEquation(polynomial, variable, comparison.expression, degree);
    }
  } else {
    solution = solveInequality(polynomial, variable, comparison.operator, comparison.expression, degree);
  }

    if (!solution) {
      return null;
    }

    return {
      solution: {
        type: context.descriptor.type,
        descriptor: context.descriptor,
        exact: solution.exact,
        approx: null,
        approxValue: null,
        steps: solution.steps,
        rationale: solution.rationale,
        details: {
          degree,
          operator: comparison.operator,
        },
        roots: solution.roots,
        intervals: solution.intervals,
        followUps: [],
        plotConfig: null,
      },
    };
  }
}

function isSolveCall(node: Node): node is Node & { type: "Call" } {
  return node.type === "Call" && node.callee === "solve";
}

function parseComparison(node: Node): Comparison | null {
  if (node.type === "Binary" && isComparisonOperator(node.operator)) {
    const expression = normaliseBinary(node);
    if (node.operator === "=") {
      return { kind: "equation", operator: "=", expression };
    }
    return { kind: "inequality", operator: node.operator, expression };
  }

  // Treat standalone expression as equation equal to zero.
  return {
    kind: "equation",
    operator: "=",
    expression: cloneNode(node),
  };
}

function normaliseBinary(node: BinaryNode): Node {
  return {
    type: "Binary",
    operator: "-",
    left: cloneNode(node.left),
    right: cloneNode(node.right),
    start: node.start,
    end: node.end,
  };
}

function isComparisonOperator(value: string): value is ComparisonOperator {
  return value === "=" || value === "<" || value === "<=" || value === ">" || value === ">=";
}

function calculateDegree(polynomial: Polynomial): number {
  const degrees = [...polynomial.keys()];
  return degrees.length ? Math.max(...degrees) : 0;
}

function solveLinearEquation(polynomial: Polynomial, variable: string, reference: Node): SolveResult | null {
  const a = polynomial.get(1) ?? new Big(0);
  const b = polynomial.get(0) ?? new Big(0);
  if (a.eq(0)) {
    return null;
  }

  const root = b.mul(-1).div(a);
  const numeric = Number(root.toString());
  const latexRoot = `\\frac{-${b.toString()}}{${a.toString()}}`;
  const latex = `\\mathrm{${variable}} = ${latexRoot}`;

  const steps: SolutionStep[] = [
    {
      id: "arrange",
      title: "Breng naar standaardvorm",
      description: "Zet de vergelijking in de vorm ax + b = 0.",
      latex: toKaTeX(reference),
    },
    {
      id: "solve",
      title: "Isoleren van de variabele",
      description: `De oplossing is ${variable} = -b/a.`,
      latex: `\\mathrm{${variable}} = -\\frac{${b.toString()}}{${a.toString()}}`,
    },
    {
      id: "result",
      title: "Oplossing",
      description: "Substitueer de waarden voor a en b.",
      latex,
    },
  ];

  return {
    exact: latex,
    roots: [numeric],
    steps,
    rationale: "Lineaire vergelijkingen worden opgelost door de variabele te isoleren.",
  };
}

function solveQuadraticEquation(polynomial: Polynomial, variable: string, reference: Node): SolveResult | null {
  const a = polynomial.get(2) ?? new Big(0);
  const b = polynomial.get(1) ?? new Big(0);
  const c = polynomial.get(0) ?? new Big(0);
  if (a.eq(0)) {
    return null;
  }

  const discriminant = b.pow(2).minus(a.times(c).times(4));
  const deltaLatex = `\\Delta = ${b.toString()}^{2} - 4 \\cdot ${a.toString()} \\cdot ${c.toString()} = ${discriminant.toString()}`;
  const twoA = a.times(2);

  let roots: Array<number | ComplexRoot> = [];
  let exactLatex: string;
  let rationale: string;

  if (discriminant.lt(0)) {
    const sqrt = Math.sqrt(Math.abs(Number(discriminant.toString())));
    const real = Number(b.mul(-1).div(twoA).toString());
    const imag = sqrt / Number(twoA.toString());
    exactLatex = `\\mathrm{${variable}} = \\frac{-${b.toString()} \\pm i\\sqrt{${discriminant.mul(-1).toString()}}}{${twoA.toString()}}`;
    roots = createComplexRoots(real, imag);
    rationale = "De discriminant is negatief, dus de oplossingen vormen een complex geconjugeerd paar.";
  } else {
    const sqrtDelta = Math.sqrt(Number(discriminant.toString()));
    const root1 = Number(b.mul(-1).plus(sqrtDelta).div(twoA).toString());
    const root2 = Number(b.mul(-1).minus(sqrtDelta).div(twoA).toString());
    exactLatex = `\\mathrm{${variable}} = \\frac{-${b.toString()} \\pm \\sqrt{${discriminant.toString()}}}{${twoA.toString()}}`;
    roots = [root1, root2];
    rationale =
      discriminant.eq(0)
        ? "De discriminant is nul, dus er is een dubbele wortel."
        : "De discriminant is positief, dus er zijn twee reÃ«le oplossingen.";
  }

  const steps: SolutionStep[] = [
    {
      id: "arrange",
      title: "Breng naar standaardvorm",
      description: "Zet de vergelijking in de vorm ax^2 + bx + c = 0.",
      latex: toKaTeX(reference),
    },
    {
      id: "discriminant",
      title: "Bereken de discriminant",
      description: "Gebruik Î” = b^2 - 4ac.",
      latex: deltaLatex,
    },
    {
      id: "quadratic",
      title: "Pas de kwadratische formule toe",
      description: "Vul de waarden voor a, b en c in.",
      latex: exactLatex,
    },
  ];

  return {
    exact: exactLatex,
    roots,
    steps,
    rationale,
  };
}

function solveInequality(
  polynomial: Polynomial,
  variable: string,
  operator: ComparisonOperator,
  reference: Node,
  degree: number,
): SolveResult | null {
  if (degree === 0) {
    return solveConstantInequality(polynomial, operator, reference);
  }
  if (degree === 1) {
    return solveLinearInequality(polynomial, variable, operator, reference);
  }
  if (degree === 2) {
    return solveQuadraticInequality(polynomial, variable, operator, reference);
  }
  if (degree >= 3 && degree <= 4) {
    return solveHigherOrderInequality(polynomial, variable, operator, reference, degree);
  }
  return null;
}

function solveConstantInequality(polynomial: Polynomial, operator: ComparisonOperator, reference: Node): SolveResult | null {
  const value = Number((polynomial.get(0) ?? new Big(0)).toString());
  const satisfied = evaluateComparison(value, operator);
  const equality = operator.includes("=");
  let exact: string;
  let intervals: SolutionInterval[];
  let rationale: string;

  if (value === 0 && equality) {
    exact = "\\mathbb{R}";
    intervals = [{ latex: "(-\\infty, \\infty)" }];
    rationale = "De uitdrukking is nul voor alle waarden, dus de ongelijkheid geldt overal.";
  } else if (satisfied) {
    exact = "\\mathbb{R}";
    intervals = [{ latex: "(-\\infty, \\infty)" }];
    rationale = "De uitdrukking voldoet aan de ongelijkheid voor alle waarden.";
  } else {
    exact = "\\varnothing";
    intervals = [];
    rationale = "De uitdrukking voldoet nooit aan de ongelijkheid.";
  }

  const steps: SolutionStep[] = [
    {
      id: "constant",
      title: "Evalueer constante uitdrukking",
      description: `De uitdrukking is constant gelijk aan ${value}.`,
      latex: toKaTeX(reference),
    },
    {
      id: "conclusion",
      title: "Conclusie",
      description: rationale,
      latex: exact,
    },
  ];

  return {
    exact,
    roots: [],
    intervals,
    steps,
    rationale,
  };
}

function solveLinearInequality(polynomial: Polynomial, variable: string, operator: ComparisonOperator, reference: Node): SolveResult | null {
  const a = polynomial.get(1) ?? new Big(0);
  const b = polynomial.get(0) ?? new Big(0);
  if (a.eq(0)) {
    return solveConstantInequality(polynomial, operator, reference);
  }

  const rootValue = Number(b.mul(-1).div(a).toString());
  const rootLatex = `\\frac{-${b.toString()}}{${a.toString()}}`;
  const roots: RealRoot[] = [{ value: rootValue, latex: rootLatex, multiplicity: 1 }];

  const intervals = buildIntervals(polynomial, roots, operator);
  const exact = intervals.length
    ? intervals.map((interval) => interval.latex).join(" \\cup ")
    : "\\varnothing";

  const steps: SolutionStep[] = [
    {
      id: "arrange",
      title: "Breng naar standaardvorm",
      description: "Zet de ongelijkheid om naar ax + b.",
      latex: toKaTeX(reference),
    },
    {
      id: "critical",
      title: "Bepaal het kritieke punt",
      description: `Los ${variable} = -b/a op.`,
      latex: `\\mathrm{${variable}} = ${rootLatex}`,
    },
    {
      id: "intervals",
      title: "Analyseer intervallen",
      description: "Bepaal in welke intervallen de ongelijkheid geldt.",
      latex: exact,
    },
  ];

  const numericRoots = [rootValue];

  return {
    exact,
    roots: numericRoots,
    intervals,
    steps,
    rationale: "Ongelijkheden van de eerste graad worden opgelost door het kritieke punt te bepalen en de tekens per interval te analyseren.",
  };
}

function solveQuadraticInequality(polynomial: Polynomial, variable: string, operator: ComparisonOperator, reference: Node): SolveResult | null {
  const a = polynomial.get(2) ?? new Big(0);
  const b = polynomial.get(1) ?? new Big(0);
  const c = polynomial.get(0) ?? new Big(0);
  if (a.eq(0)) {
    return solveLinearInequality(polynomial, variable, operator, reference);
  }

  const discriminant = b.pow(2).minus(a.times(c).times(4));
  const twoA = a.times(2);
  const realRoots: RealRoot[] = [];

  if (discriminant.gt(0)) {
    const sqrtDelta = Math.sqrt(Number(discriminant.toString()));
    const root1 = Number(b.mul(-1).plus(sqrtDelta).div(twoA).toString());
    const root2 = Number(b.mul(-1).minus(sqrtDelta).div(twoA).toString());
    const latexPlus = `\\frac{-${b.toString()} + \\sqrt{${discriminant.toString()}}}{${twoA.toString()}}`;
    const latexMinus = `\\frac{-${b.toString()} - \\sqrt{${discriminant.toString()}}}{${twoA.toString()}}`;
    realRoots.push({ value: root1, latex: latexPlus, multiplicity: 1 });
    realRoots.push({ value: root2, latex: latexMinus, multiplicity: 1 });
  } else if (discriminant.eq(0)) {
    const root = Number(b.mul(-1).div(twoA).toString());
    const latexRoot = `\\frac{-${b.toString()}}{${twoA.toString()}}`;
    realRoots.push({ value: root, latex: latexRoot, multiplicity: 2 });
  }

  const intervals = buildIntervals(polynomial, realRoots, operator);
  const exact = intervals.length
    ? intervals.map((interval) => interval.latex).join(" \\cup ")
    : "\\varnothing";

  const steps: SolutionStep[] = [
    {
      id: "arrange",
      title: "Breng naar standaardvorm",
      description: "Zet de ongelijkheid om naar ax^2 + bx + c.",
      latex: toKaTeX(reference),
    },
    {
      id: "critical",
      title: "Bepaal de kritieke punten",
      description: realRoots.length
        ? "Los de bijbehorende vergelijking op om de nulpunten te bepalen."
        : "Er zijn geen reÃ«le nulpunten.",
      latex: realRoots.length ? realRoots.map((root) => root.latex).join(", ") : "Geen reÃ«le nulpunten",
    },
    {
      id: "intervals",
      title: "Analyseer intervallen",
      description: "Bepaal in welke intervallen de ongelijkheid geldig is.",
      latex: exact,
    },
  ];

  const numericRoots = realRoots.map((root) => root.value);
  const rationale = buildQuadraticInequalityRationale(discriminant, operator);

  return {
    exact,
    roots: numericRoots,
    intervals,
    steps,
    rationale,
  };
}

function buildQuadraticInequalityRationale(discriminant: Big, operator: ComparisonOperator): string {
  if (discriminant.lt(0)) {
    return "De discriminant is negatief, dus er zijn geen reÃ«le nulpunten. De ongelijkheid hangt af van het teken van de parabool.";
  }
  if (discriminant.eq(0)) {
    return operator.includes("=")
      ? "De discriminant is nul, er is een dubbel nulpunt. De ongelijkheid is waar op dat punt en afhankelijk van het teken van de parabool elders."
      : "De discriminant is nul, er is een dubbel nulpunt. Zonder gelijkheid is de ongelijkheid nergens strikt geldig.";
  }
  return "Met twee reÃ«le nulpunten verandert het teken van de parabool in de intervallen tussen de nulpunten.";
}

function createComplexRoots(real: number, imaginary: number): ComplexRoot[] {
  const roundedReal = round(real);
  const roundedImag = round(imaginary);
  const plusLatex =
    roundedImag === 0 ? `${roundedReal}` : `${roundedReal} + ${Math.abs(roundedImag)}i`;
  const minusLatex =
    roundedImag === 0 ? `${roundedReal}` : `${roundedReal} - ${Math.abs(roundedImag)}i`;

  return [
    {
      real: roundedReal,
      imaginary: roundedImag,
      latex: plusLatex,
      approx: plusLatex,
    },
    {
      real: roundedReal,
      imaginary: -roundedImag,
      latex: minusLatex,
      approx: minusLatex,
    },
  ];
}

function buildIntervals(
  polynomial: Polynomial,
  roots: RealRoot[],
  operator: ComparisonOperator,
): SolutionInterval[] {
  const equality = operator.includes("=");
  const uniqueRoots = dedupeRoots(roots);
  const boundaries = uniqueRoots.map((root) => root.value).sort((a, b) => a - b);
  const intervals: SolutionInterval[] = [];

  const segments: Array<{ start: number | null; end: number | null; includeStart: boolean; includeEnd: boolean; }> = [];

  if (boundaries.length === 0) {
    const value = evaluatePolynomial(polynomial, 0);
    if (evaluateComparison(value, operator)) {
      intervals.push({ latex: "(-\\infty, \\infty)" });
    }
    return intervals;
  }

  // Build open intervals between boundaries and to infinity
  const extended = [null, ...boundaries, null];
  for (let i = 0; i < extended.length - 1; i += 1) {
    const start = extended[i];
    const end = extended[i + 1];
    const sample = chooseSample(start, end);
    const value = evaluatePolynomial(polynomial, sample);
    if (evaluateComparison(value, operator)) {
      segments.push({
        start,
        end,
        includeStart: false,
        includeEnd: false,
      });
    }
  }

  // Adjust inclusivity for equality
  if (equality) {
    for (const root of uniqueRoots) {
      const matches = segments.filter((segment) => isBoundary(segment.start, root.value) || isBoundary(segment.end, root.value));
      if (matches.length === 0) {
        // include isolated root
        intervals.push({
          latex: `[${root.latex}, ${root.latex}]`,
          description: "Dubbel nulpunt",
        });
        continue;
      }
      for (const segment of matches) {
        if (isBoundary(segment.start, root.value)) {
          segment.includeStart = true;
        }
        if (isBoundary(segment.end, root.value)) {
          segment.includeEnd = true;
        }
      }
    }
  }

  // Convert segments to latex intervals
  for (const segment of segments) {
    const startLatex = boundaryLatex(segment.start, uniqueRoots, "start");
    const endLatex = boundaryLatex(segment.end, uniqueRoots, "end");
    const startBracket = segment.includeStart ? "[" : "(";
    const endBracket = segment.includeEnd ? "]" : ")";
    const latex = `${startBracket}${startLatex}, ${endLatex}${endBracket}`;
    intervals.push({ latex });
  }

  return mergeAdjacentIntervals(intervals);
}

function dedupeRoots(roots: RealRoot[]): RealRoot[] {
  const sorted = [...roots].sort((a, b) => a.value - b.value);
  const deduped: RealRoot[] = [];
  for (const root of sorted) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(last.value - root.value) < 1e-8) {
      const merged: RealRoot = {
        value: last.value,
        latex: last.latex,
        multiplicity: last.multiplicity + root.multiplicity,
      };
      deduped[deduped.length - 1] = merged;
    } else {
      deduped.push({ ...root });
    }
  }
  return deduped;
}

function chooseSample(start: number | null, end: number | null): number {
  if (start === null && end === null) {
    return 0;
  }
  if (start === null && end !== null) {
    return end - 1;
  }
  if (start !== null && end === null) {
    return start + 1;
  }
  if (start !== null && end !== null) {
    const mid = (start + end) / 2;
    if (Number.isFinite(mid)) {
      return mid;
    }
    return start + 1;
  }
  return 0;
}

function evaluatePolynomial(polynomial: Polynomial, x: number): number {
  let sum = 0;
  for (const [degree, coefficient] of polynomial) {
    sum += Number(coefficient.toString()) * x ** degree;
  }
  return sum;
}

function evaluateComparison(value: number, operator: ComparisonOperator): boolean {
  const epsilon = 1e-9;
  switch (operator) {
    case "<":
      return value < -epsilon;
    case "<=":
      return value <= epsilon;
    case ">":
      return value > epsilon;
    case ">=":
      return value >= -epsilon;
    case "=":
      return Math.abs(value) <= epsilon;
    default:
      return false;
  }
}

function isBoundary(boundary: number | null, value: number): boolean {
  if (boundary === null) return false;
  return Math.abs(boundary - value) < 1e-8;
}

function boundaryLatex(boundary: number | null, roots: RealRoot[], position: "start" | "end"): string {
  if (boundary === null) {
    return position === "start" ? "-\\infty" : "\\infty";
  }
  if (!Number.isFinite(boundary)) {
    return boundary > 0 ? "\\infty" : "-\\infty";
  }
  const match = roots.find((root) => Math.abs(root.value - boundary) < 1e-8);
  return match ? match.latex : formatNumber(boundary);
}

function mergeAdjacentIntervals(intervals: SolutionInterval[]): SolutionInterval[] {
  if (intervals.length <= 1) {
    return intervals;
  }
  const merged: SolutionInterval[] = [];
  let current = intervals[0]!;

  for (let i = 1; i < intervals.length; i += 1) {
    const next = intervals[i]!;
    if (current.latex === next.latex) {
      continue;
    }
    merged.push(current);
    current = next;
  }

  merged.push(current);
  return merged;
}

function round(value: number): number {
  return Number(new Big(value).toFixed(6));
}

function formatNumber(value: number): string {
  const fixed = value.toFixed(6);
  return fixed.replace(/\.0+$/, "").replace(/0+$/, "");
}

function solveHigherOrderEquation(
  polynomial: Polynomial,
  variable: string,
  reference: Node,
  degree: number,
): SolveResult | null {
  if (degree < 3 || degree > 4) return null;

  const coeffs = coefficientsFromPolynomial(polynomial, degree);
  const roots = durandKerner(coeffs);

  const latexRoots: string[] = [];
  const solutionRoots: Array<number | ComplexRoot> = [];

  roots.forEach((root, index) => {
    if (Math.abs(root.im) < 1e-6) {
      const real = round(root.re);
      latexRoots.push(`\\mathrm{${variable}}_{${index + 1}} \\approx ${formatNumber(real)}`);
      solutionRoots.push(real);
    } else {
      const complex = complexToLatex(root);
      latexRoots.push(`\\mathrm{${variable}}_{${index + 1}} \\approx ${complex.latex}`);
      solutionRoots.push(complex);
    }
  });

  const steps: SolutionStep[] = [
    {
      id: "arrange",
      title: "Breng naar standaardvorm",
      description: `Breng de vergelijking naar ${variable}-polynoom van graad ${degree}.`,
      latex: toKaTeX(reference),
    },
    {
      id: "numeric",
      title: "Pas numerieke wortelzoeker toe",
      description: "Gebruik Durand-Kerner om alle wortels van het polynoom te bepalen.",
      latex: latexRoots.join(",\\; "),
    },
  ];

  const exact = `\\{ ${latexRoots.join(",\\; ")} \\}`;
  const rationale = "Voor polynomen van graad 3 of 4 worden numerieke methoden gebruikt om alle wortels te vinden.";

  return {
    exact,
    roots: solutionRoots,
    steps,
    rationale,
  };
}

function solveHigherOrderInequality(
  polynomial: Polynomial,
  variable: string,
  operator: ComparisonOperator,
  reference: Node,
  degree: number,
): SolveResult | null {
  const coeffs = coefficientsFromPolynomial(polynomial, degree);
  const complexRoots = durandKerner(coeffs);
  const realRoots = complexRoots
    .filter((root) => Math.abs(root.im) < 1e-6)
    .map<RealRoot>((root) => ({
      value: round(root.re),
      latex: formatNumber(root.re),
      multiplicity: 1,
    }));

  const intervals = buildIntervals(polynomial, realRoots, operator);
  const exact = intervals.length
    ? intervals.map((interval) => interval.latex).join(" \\cup ")
    : "\\varnothing";

  const steps: SolutionStep[] = [
    {
      id: "arrange",
      title: "Breng naar standaardvorm",
      description: `Zet de ongelijkheid om naar een ${variable}-polynoom van graad ${degree}.`,
      latex: toKaTeX(reference),
    },
    {
      id: "roots",
      title: "Bepaal kritieke punten",
      description: realRoots.length
        ? "Vind de reÃ«le nulpunten numeriek."
        : "Er zijn geen reÃ«le nulpunten.",
      latex: realRoots.length ? realRoots.map((root) => root.latex).join(",\\; ") : "Geen reÃ«le nulpunten",
    },
    {
      id: "intervals",
      title: "Analyseer intervallen",
      description: "Controleer het teken van het polynoom per interval.",
      latex: exact,
    },
  ];

  const numericRoots = realRoots.map((root) => root.value);
  const rationale =
    realRoots.length > 0
      ? "Numerieke wortels bepalen de grenzen waar het teken verandert; evalueer per interval."
      : "Zonder reÃ«le wortels blijft het teken van het polynoom constant.";

  return {
    exact,
    roots: numericRoots,
    intervals,
    steps,
    rationale,
  };
}

function coefficientsFromPolynomial(polynomial: Polynomial, degree: number): number[] {
  const coeffs: number[] = [];
  for (let d = degree; d >= 0; d -= 1) {
    const coefficient = polynomial.get(d) ?? new Big(0);
    coeffs.push(Number(coefficient.toString()));
  }
  return coeffs;
}

function durandKerner(coeffs: number[]): Complex[] {
  const degree = coeffs.length - 1;
  const roots: Complex[] = [];
  const radius = 1 + Math.max(...coeffs.map((c) => Math.abs(c)));

  for (let k = 0; k < degree; k += 1) {
    const angle = (2 * Math.PI * k) / degree;
    roots.push({ re: radius * Math.cos(angle), im: radius * Math.sin(angle) });
  }

  const maxIterations = 80;
  const tolerance = 1e-10;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let maxChange = 0;
    for (let i = 0; i < degree; i += 1) {
      const root = roots[i]!;
      const f = evaluatePolynomialComplex(coeffs, root);
      let denominator: Complex = { re: 1, im: 0 };
      for (let j = 0; j < degree; j += 1) {
        if (i === j) continue;
        denominator = complexMul(denominator, complexSub(root, roots[j]!));
      }
      const quotient = complexDiv(f, denominator);
      const next = complexSub(root, quotient);
      const change = Math.hypot(root.re - next.re, root.im - next.im);
      if (change > maxChange) {
        maxChange = change;
      }
      roots[i] = next;
    }
    if (maxChange < tolerance) {
      break;
    }
  }

  return roots;
}

function evaluatePolynomialComplex(coeffs: number[], z: Complex): Complex {
  let result: Complex = { re: 0, im: 0 };
  for (const coefficient of coeffs) {
    result = complexMul(result, z);
    result = complexAdd(result, { re: coefficient, im: 0 });
  }
  return result;
}

function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function complexSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

function complexMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function complexDiv(a: Complex, b: Complex): Complex {
  const denominator = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / denominator,
    im: (a.im * b.re - a.re * b.im) / denominator,
  };
}

function complexToLatex(root: Complex): ComplexRoot {
  const real = round(root.re);
  const imag = round(root.im);
  const realPart = formatNumber(real);
  const imagPart = formatNumber(Math.abs(imag));
  const sign = imag >= 0 ? "+" : "-";
  const latex = imag === 0 ? realPart : `${realPart} ${sign} ${imagPart}i`;
  return {
    real,
    imaginary: imag,
    latex,
    approx: latex,
  };
}

