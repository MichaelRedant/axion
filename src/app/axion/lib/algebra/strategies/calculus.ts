import { cloneNode, type Node } from "../ast";
import { toKaTeX } from "../format";
import { differentiate, integrate, computeLimit, taylorSeries } from "../calculus";
import { simplify, collectVariables } from "../simplify";
import { evaluate, isComplexResult, isUnitResult } from "../evaluator";
import type {
  ProblemStrategy,
  StrategyContext,
  StrategyDescriptor,
  StrategyResult,
} from "./base";
import type { CartesianPlotConfig, PlotAnnotation, SolutionStep } from "../solution";

export const CALCULUS_STRATEGY_DESCRIPTOR: StrategyDescriptor = {
  id: "strategy.calculus",
  handles: [],
  priority: 300,
};

export class CalculusStrategy implements ProblemStrategy {
  readonly descriptor = CALCULUS_STRATEGY_DESCRIPTOR;

  matches(context: StrategyContext): boolean {
    return isCalculusCall(context.ast);
  }

  solve(context: StrategyContext): StrategyResult | null {
    if (context.ast.type !== "Call") return null;
    const call = context.ast;

    switch (call.callee) {
      case "diff":
        return this.handleDiff(context, call);
      case "integrate":
        return this.handleIntegrate(context, call);
      case "limit":
        return this.handleLimit(context, call);
      case "taylor":
        return this.handleTaylor(context, call);
      default:
        return null;
    }
  }

  private handleDiff(
    context: StrategyContext,
    call: Extract<Node, { type: "Call" }>,
  ): StrategyResult | null {
    const [expression, variableNode, orderNode] = call.args;
    if (!expression) return null;

    const variable = this.resolveVariable(variableNode, context, expression);
    if (!variable) return null;

    const order = parseOrder(orderNode) ?? 1;
    const derivative = simplify(differentiate(expression, { variable, order }));
    const latex = toKaTeX(derivative);

    const steps: SolutionStep[] = [
      {
        id: "original",
        title: "Originele expressie",
        description: "Start vanuit de ingevoerde functie.",
        latex: toKaTeX(expression),
      },
      {
        id: "differentiate",
        title: `Differentieer naar ${variable}`,
        description:
          order === 1
            ? "Pas de standaard differentieregels toe."
            : `Bereken de ${order}e afgeleide stap voor stap.`,
        latex,
      },
    ];

    const plotConfig = createCartesianPlot(
      expression,
      variable,
      `f(${variable})`,
      defaultDomain(),
    );

    return {
      solution: {
        type: context.descriptor.type,
        descriptor: context.descriptor,
        exact: latex,
        approx: null,
        approxValue: null,
        steps,
        rationale: "Symbolische differentie via regels voor som, product en ketting.",
        details: {
          operation: "diff",
          variable,
          order,
        },
        followUps: [],
        roots: [],
        plotConfig,
      },
    };
  }

  private handleIntegrate(
    context: StrategyContext,
    call: Extract<Node, { type: "Call" }>,
  ): StrategyResult | null {
    const [expression, variableNode] = call.args;
    if (!expression) return null;

    const variable = this.resolveVariable(variableNode, context, expression);
    if (!variable) return null;

    const primitive = integrate(expression, variable);
    if (!primitive) {
      return {
        solution: {
          type: context.descriptor.type,
          descriptor: context.descriptor,
          exact: "Onbekende primitieve",
          approx: null,
          approxValue: null,
          steps: [
            {
              id: "original",
              title: "Originele expressie",
              description: "Integratie werd aangevraagd.",
              latex: toKaTeX(expression),
            },
          ],
          rationale: "Geen gesloten primitieve gevonden voor deze uitdrukking.",
          followUps: [],
          roots: [],
          plotConfig: createCartesianPlot(
            expression,
            variable,
            `f(${variable})`,
            defaultDomain(),
          ),
        },
      };
    }

    const simplified = simplify(primitive);
    const latexPrimitive = toKaTeX(simplified);
    const exact = `${latexPrimitive} + C`;

    const steps: SolutionStep[] = [
      {
        id: "original",
        title: "Originele expressie",
        description: "Integreer naar het opgegeven variabele.",
        latex: toKaTeX(expression),
      },
      {
        id: "integral",
        title: "Primitieve",
        description: "Resultaat na integratie (zonder constante).",
        latex: latexPrimitive,
      },
    ];

    const plotConfig = createCartesianPlot(
      simplified,
      variable,
      `∫ f(${variable}) d${variable}`,
      defaultDomain(),
    );

    return {
      solution: {
        type: context.descriptor.type,
        descriptor: context.descriptor,
        exact,
        approx: null,
        approxValue: null,
        steps,
        rationale: "Symbolische integratie via bekende primitieve regels.",
        details: {
          operation: "integrate",
          variable,
        },
        followUps: [],
        roots: [],
        plotConfig,
      },
    };
  }

  private handleLimit(
    context: StrategyContext,
    call: Extract<Node, { type: "Call" }>,
  ): StrategyResult | null {
    const [expression, variableNode, targetNode, directionNode] = call.args;
    if (!expression) return null;

    const variable = this.resolveVariable(variableNode, context, expression);
    if (!variable) return null;

    const target = targetNode ?? cloneNode(variableNode ?? expression);
    const direction = parseDirection(directionNode);

    const limitValue = computeLimit(expression, {
      variable,
      approaching: target,
      direction,
    });

    const latexLimit = limitValue !== null ? formatNumber(limitValue) : "Niet gedefinieerd";

    const steps: SolutionStep[] = [
      {
        id: "original",
        title: "Originele expressie",
        description: "Bereken de limiet in het opgegeven punt.",
        latex: toKaTeX(expression),
      },
      {
        id: "limit",
        title: "Limiet",
        description: `Beoordeel de limiet voor ${variable} → ${toKaTeX(target)}`,
        latex: latexLimit,
      },
    ];

    const plotConfig = createCartesianPlot(
      expression,
      variable,
      `f(${variable})`,
      inferLimitDomain(target),
      buildLimitAnnotations(expression, variable, target),
    );

    return {
      solution: {
        type: context.descriptor.type,
        descriptor: context.descriptor,
        exact: latexLimit,
        approx: limitValue !== null ? formatNumber(limitValue) : null,
        approxValue: limitValue,
        steps,
        rationale: "Limiet berekend via substitutie, rekenregels of L'Hôpital.",
        details: {
          operation: "limit",
          variable,
          target,
          direction,
        },
        followUps: [],
        roots: [],
        plotConfig,
      },
    };
  }

  private handleTaylor(
    context: StrategyContext,
    call: Extract<Node, { type: "Call" }>,
  ): StrategyResult | null {
    const [expression, variableNode, aroundNode, orderNode] = call.args;
    if (!expression) return null;

    const variable = this.resolveVariable(variableNode, context, expression);
    if (!variable) return null;

    const around =
      aroundNode && aroundNode.type === "Number" ? Number(aroundNode.value) : 0;
    const order = parseOrder(orderNode) ?? 4;

    const terms = taylorSeries(expression, {
      variable,
      order,
      around,
    });

    const latexTerms = terms.map((term) => toKaTeX(term));
    const polynomial = latexTerms.join(" + ");

    const steps: SolutionStep[] = [
      {
        id: "original",
        title: "Originele expressie",
        description: "Ontwikkel een Taylorreeks rond het gekozen punt.",
        latex: toKaTeX(expression),
      },
      {
        id: "series",
        title: `Taylorreeks (orde ${order})`,
        description: "Som van afgeleiden gedeeld door factorialen.",
        latex: polynomial,
      },
    ];

    const plotConfig = createCartesianPlot(
      expression,
      variable,
      `f(${variable})`,
      domainAround(around, 4),
      buildTaylorAnnotations(expression, variable, around),
    );

    return {
      solution: {
        type: context.descriptor.type,
        descriptor: context.descriptor,
        exact: polynomial,
        approx: null,
        approxValue: null,
        steps,
        rationale: "Taylorontwikkeling tot de gevraagde orde.",
        details: {
          operation: "taylor",
          variable,
          order,
          around,
        },
        followUps: [],
        roots: [],
        plotConfig,
      },
    };
  }

  private resolveVariable(
    node: Node | undefined,
    context: StrategyContext,
    expression: Node,
  ): string | null {
    if (node && node.type === "Symbol") {
      return node.name;
    }

    const metadataVariable = context.descriptor.metadata.primaryVariable;
    if (metadataVariable) {
      return metadataVariable;
    }

    const variables = collectVariables(expression);
    return variables.values().next().value ?? null;
  }
}

function isCalculusCall(node: Node): node is Node & { type: "Call" } {
  if (node.type !== "Call") {
    return false;
  }
  return ["diff", "integrate", "limit", "taylor"].includes(node.callee);
}

function parseOrder(node: Node | undefined): number | null {
  if (!node) return null;
  if (node.type === "Number") {
    return Number(node.value);
  }
  return null;
}

function parseDirection(node: Node | undefined): "left" | "right" | "both" {
  if (!node) return "both";
  if (node.type === "Symbol") {
    if (node.name === "left") return "left";
    if (node.name === "right") return "right";
  }
  return "both";
}

function formatNumber(value: number): string {
  const fixed = value.toFixed(6);
  return fixed.replace(/\.0+$/, "").replace(/0+$/, "");
}

function createCartesianPlot(
  expression: Node,
  variable: string,
  label: string,
  domain: [number, number],
  annotations?: PlotAnnotation[],
): CartesianPlotConfig {
  const [start, end] = domain[0] < domain[1] ? domain : [domain[1], domain[0]];
  return {
    type: "cartesian",
    variable,
    expression: cloneNode(expression),
    domain: [start, end],
    samples: 300,
    label,
    axes: {
      x: { label: variable, min: start, max: end },
      y: { label },
    },
    annotations,
  };
}

function defaultDomain(): [number, number] {
  return [-6, 6];
}

function domainAround(center: number, span: number): [number, number] {
  const start = center - span;
  const end = center + span;
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return defaultDomain();
  }
  return [start, end];
}

function inferLimitDomain(target: Node): [number, number] {
  if (target.type === "Number") {
    const center = Number(target.value);
    if (Number.isFinite(center)) {
      return domainAround(center, 3);
    }
  }
  if (target.type === "Symbol") {
    if (target.name === "infinity" || target.name === "oo") {
      return [0, 10];
    }
    if (target.name === "-infinity" || target.name === "-oo") {
      return [-10, 0];
    }
  }
  return defaultDomain();
}

function evaluateAt(expression: Node, variable: string, value: number): number | null {
  try {
    const result = evaluate(expression, { env: { [variable]: value }, precision: 10 });
    if (isUnitResult(result)) {
      return result.magnitude;
    }
    if (isComplexResult(result)) {
      return Math.abs(result.imaginary) < 1e-9 ? result.real : null;
    }
    return result;
  } catch {
    return null;
  }
}

function buildLimitAnnotations(
  expression: Node,
  variable: string,
  target: Node,
): PlotAnnotation[] | undefined {
  if (target.type !== "Number") {
    return undefined;
  }
  const value = Number(target.value);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  const y = evaluateAt(expression, variable, value);
  return [
    {
      type: "point",
      coordinates: [value, Number.isFinite(y ?? NaN) ? (y as number) : 0],
      label: `${variable} → ${formatNumber(value)}`,
    },
  ];
}

function buildTaylorAnnotations(
  expression: Node,
  variable: string,
  around: number,
): PlotAnnotation[] {
  const y = evaluateAt(expression, variable, around);
  return [
    {
      type: "point",
      coordinates: [around, Number.isFinite(y ?? NaN) ? (y as number) : 0],
      label: `Rond ${variable} = ${formatNumber(around)}`,
    },
  ];
}
