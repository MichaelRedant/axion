import type { Node } from "./ast";
import {
  createExpressionContext,
  type AssumptionSet,
  type ExpressionContext,
  type ExpressionDomain,
  type EvaluationSettings,
} from "./core/types";

export interface ContextOptions {
  readonly assumptions?: AssumptionSet;
  readonly settings?: EvaluationSettings;
  readonly initialDomainHints?: Map<string, ExpressionDomain>;
}

export function buildExpressionContext(
  ast: Node,
  options: ContextOptions = {},
): ExpressionContext {
  const domainHints =
    options.initialDomainHints ?? computeDomainHints(ast, new Map());

  return createExpressionContext({
    domainHints,
    assumptions: options.assumptions,
    settings: options.settings,
  });
}

function computeDomainHints(
  node: Node,
  acc: Map<string, ExpressionDomain>,
): Map<string, ExpressionDomain> {
  switch (node.type) {
    case "Symbol":
      if (!acc.has(node.name)) {
        acc.set(node.name, node.domain ?? "unknown");
      }
      break;
    case "Unary":
      computeDomainHints(node.argument, acc);
      break;
    case "Binary":
      computeDomainHints(node.left, acc);
      computeDomainHints(node.right, acc);
      if (node.operator === "=" && node.domain === undefined) {
        acc.set("__equation__", "scalar");
      }
      break;
    case "Call":
      for (const arg of node.args) {
        computeDomainHints(arg, acc);
      }
      break;
    default:
      break;
  }
  return acc;
}

export function withDomainHint(
  context: ExpressionContext,
  symbol: string,
  domain: ExpressionDomain,
): ExpressionContext {
  const hints = new Map(context.domainHints);
  hints.set(symbol, domain);
  return createExpressionContext({
    domainHints: hints,
    assumptions: context.assumptions,
    settings: context.settings,
  });
}
