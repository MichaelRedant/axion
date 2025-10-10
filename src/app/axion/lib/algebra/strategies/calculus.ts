import { cloneNode, type Node } from "../ast";
import { toKaTeX } from "../format";
import { differentiate, integrate, computeLimit, taylorSeries } from "../calculus";
import { simplify, collectVariables } from "../simplify";
import type {
  ProblemStrategy,
  StrategyContext,
  StrategyDescriptor,
  StrategyResult,
} from "./base";
import type { SolutionStep } from "../solution";

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

  private handleDiff(context: StrategyContext, call: Extract<Node, { type: "Call" }> ): StrategyResult | null {
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
        description: order === 1 ? "Pas de standaard differentieregels toe." : `Bereken de ${order}e afgeleide stap voor stap.`,
        latex,
      },
    ];

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
        plotConfig: null,
      },
    };
  }

  private handleIntegrate(context: StrategyContext, call: Extract<Node, { type: "Call" }> ): StrategyResult | null {
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
          plotConfig: null,
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
        description: "Integreer de ingevoerde functie.",
        latex: toKaTeX(expression),
      },
      {
        id: "integrate",
        title: "Bepaal de primitieve",
        description: "Gebruik standaard integratieregels.",
        latex: exact,
      },
    ];

    return {
      solution: {
        type: context.descriptor.type,
        descriptor: context.descriptor,
        exact,
        approx: null,
        approxValue: null,
        steps,
        rationale: "Onbepaalde integraal inclusief integratieconstante.",
        details: {
          operation: "integrate",
          variable,
        },
        followUps: [],
        roots: [],
        plotConfig: null,
      },
    };
  }

  private handleLimit(context: StrategyContext, call: Extract<Node, { type: "Call" }> ): StrategyResult | null {
    const [expression, secondArg, thirdArg, fourthArg] = call.args;
    if (!expression) return null;

    let variableNode = secondArg;
    let targetNode = thirdArg;
    let directionNode = fourthArg;

    if (secondArg && secondArg.type === "Binary" && secondArg.operator === "->") {
      variableNode = secondArg.left;
      targetNode = secondArg.right;
      directionNode = thirdArg;
    }

    const variable = this.resolveVariable(variableNode, context, expression);
    if (!variable) return null;

    const target = targetNode && targetNode.type === "Number" ? Number(targetNode.value) : 0;
    const direction = parseDirection(directionNode);

    const limitValue = computeLimit(expression, { variable, approaching: target, direction });
    const latexLimit = limitValue === null ? "Niet gedefinieerd" : formatNumber(limitValue);

    const steps: SolutionStep[] = [
      {
        id: "original",
        title: "Originele expressie",
        description: "Bepaal de limiet rond het gegeven punt.",
        latex: toKaTeX(expression),
      },
      {
        id: "evaluate",
        title: "Evalueer limiet",
        description: "Gebruik substitutie en eventueel L'HÃ´pital.",
        latex: latexLimit,
      },
    ];

    return {
      solution: {
        type: context.descriptor.type,
        descriptor: context.descriptor,
        exact: latexLimit,
        approx: limitValue !== null ? formatNumber(limitValue) : null,
        approxValue: limitValue,
        steps,
        rationale: "Limiet berekend via substitutie of L'HÃ´pital.",
        details: {
          operation: "limit",
          variable,
          target,
          direction,
        },
        followUps: [],
        roots: [],
        plotConfig: null,
      },
    };
  }

  private handleTaylor(context: StrategyContext, call: Extract<Node, { type: "Call" }> ): StrategyResult | null {
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
        plotConfig: null,
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

