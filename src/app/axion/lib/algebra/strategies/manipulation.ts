import { cloneNode, type Node } from "../ast";
import { toKaTeX } from "../format";
import {
  expand,
  factor,
  partialFraction,
  rationalSimplify,
  simplify,
} from "../simplify";
import type {
  ProblemStrategy,
  StrategyContext,
  StrategyDescriptor,
  StrategyResult,
} from "./base";
import type { SolutionStep } from "../solution";

type ManipulationOperator =
  | "simplify"
  | "expand"
  | "factor"
  | "rational_simplify"
  | "partialFraction";

interface ManipulationConfig {
  readonly label: string;
  readonly description: string;
  readonly apply: (node: Node) => Node;
}

const OPERATOR_MAP: Record<ManipulationOperator, ManipulationConfig> = {
  simplify: {
    label: "Simplify",
    description: "Voer algebraïsche vereenvoudigingen uit op de expressie.",
    apply: simplify,
  },
  expand: {
    label: "Expand",
    description: "Breid producten en machten uit tot een som van termen.",
    apply: expand,
  },
  factor: {
    label: "Factor",
    description: "Schrijf de expressie als een product van factoren.",
    apply: factor,
  },
  rational_simplify: {
    label: "Rational simplify",
    description: "Vereenvoudig breuken door gemeenschappelijke factoren te verwijderen.",
    apply: rationalSimplify,
  },
  partialFraction: {
    label: "Partial fractions",
    description: "Splits een rationale functie op in eenvoudige deelbreuken.",
    apply: partialFraction,
  },
};

export const MANIPULATION_STRATEGY_DESCRIPTOR: StrategyDescriptor = {
  id: "strategy.manipulation",
  handles: [],
  priority: 250,
};

export class ManipulationStrategy implements ProblemStrategy {
  readonly descriptor = MANIPULATION_STRATEGY_DESCRIPTOR;

  matches(context: StrategyContext): boolean {
    return isManipulationCall(context.ast);
  }

  solve(context: StrategyContext): StrategyResult | null {
    if (context.ast.type !== "Call") {
      return null;
    }

    const operation = toManipulationOperator(context.ast.callee);
    if (!operation) {
      return null;
    }

    const config = OPERATOR_MAP[operation];
    const argument = context.ast.args[0];
    if (!argument) {
      return null;
    }

    const original = cloneNode(argument);
    const transformed = config.apply(original);

    const steps = buildSteps(config, argument, transformed);

    return {
      solution: {
        type: context.descriptor.type,
        descriptor: context.descriptor,
        exact: toKaTeX(transformed),
        approx: null,
        approxValue: null,
        steps,
        rationale: config.description,
        plotConfig: null,
        details: {
          operation,
        },
        followUps: [],
      },
    };
  }
}

function isManipulationCall(node: Node): node is Node & { type: "Call" } {
  return node.type === "Call" && Boolean(toManipulationOperator(node.callee));
}

function toManipulationOperator(callee: string): ManipulationOperator | null {
  if (callee in OPERATOR_MAP) {
    return callee as ManipulationOperator;
  }
  return null;
}

function buildSteps(
  config: ManipulationConfig,
  original: Node,
  transformed: Node,
): SolutionStep[] {
  const inputLatex = toKaTeX(original);
  const outputLatex = toKaTeX(transformed);

  return [
    {
      id: "original",
      title: "Originele expressie",
      description: "Start vanuit de ingevoerde expressie.",
      latex: inputLatex,
    },
    {
      id: "transformed",
      title: config.label,
      description: config.description,
      latex: outputLatex,
    },
  ];
}
