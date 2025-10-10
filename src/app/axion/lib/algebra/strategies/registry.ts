import type { ProblemDescriptor } from "../problems";
import type { Token } from "../tokenizer";
import type { Node } from "../ast";
import type {
  ProblemStrategy,
  StrategyContext,
  StrategyDescriptor,
  StrategyResult,
} from "./base";
import type { ExpressionContext } from "../core/types";

interface StrategyRegistration {
  readonly descriptor: StrategyDescriptor;
  readonly factory: () => ProblemStrategy;
}

interface InternalRegistration extends StrategyRegistration {
  instance?: ProblemStrategy;
}

const registrations: InternalRegistration[] = [];

export function registerStrategy(registration: StrategyRegistration) {
  if (registrations.some((entry) => entry.descriptor.id === registration.descriptor.id)) {
    return;
  }
  registrations.push({ ...registration });
  registrations.sort(
    (left, right) =>
      (right.descriptor.priority ?? 0) - (left.descriptor.priority ?? 0),
  );
}

export function resolveStrategy(
  input: string,
  tokens: Token[],
  ast: Node,
  simplified: Node,
  descriptor: ProblemDescriptor,
  expression: ExpressionContext,
): { strategy: ProblemStrategy | null; result: StrategyResult | null } {
  const context: StrategyContext = {
    input,
    tokens,
    ast,
    simplified,
    descriptor,
    expression,
  };

  for (const registration of registrations) {
    const strategy = getStrategyInstance(registration);
    if (!strategy) {
      continue;
    }
    if (!isCandidate(strategy, descriptor, context)) {
      continue;
    }
    const result = strategy.solve(context);
    if (result) {
      return { strategy, result };
    }
  }

  return { strategy: null, result: null };
}

function getStrategyInstance(
  registration: InternalRegistration,
): ProblemStrategy | null {
  if (!registration.instance) {
    registration.instance = registration.factory();
  }

  if (registration.instance.descriptor.id !== registration.descriptor.id) {
    return null;
  }

  return registration.instance;
}

function isCandidate(
  strategy: ProblemStrategy,
  problem: ProblemDescriptor,
  context: StrategyContext,
): boolean {
  if (
    strategy.descriptor.handles.length > 0 &&
    !strategy.descriptor.handles.includes(problem.type)
  ) {
    return false;
  }
  if (problem.type === "unknown") {
    return strategy.matches(context);
  }
  return strategy.matches(context);
}
