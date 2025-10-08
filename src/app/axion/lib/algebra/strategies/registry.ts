import type { ProblemDescriptor } from "../problems";
import type { SolutionBundle } from "../solution";
import type { Token } from "../tokenizer";
import type { Node } from "../ast";
import type { ProblemStrategy, StrategyContext } from "./base";

const strategies: ProblemStrategy[] = [];

export function registerStrategy(strategy: ProblemStrategy) {
  if (!strategies.some((existing) => existing.type === strategy.type)) {
    strategies.push(strategy);
  }
}

export function resolveStrategy(
  input: string,
  tokens: Token[],
  ast: Node,
  simplified: Node,
  descriptor: ProblemDescriptor,
): { strategy: ProblemStrategy | null; result: SolutionBundle | null } {
  const context: StrategyContext = {
    input,
    tokens,
    ast,
    simplified,
    descriptor,
  };

  for (const strategy of strategies) {
    if (strategy.match(context)) {
      const result = strategy.solve(context);
      if (result) {
        return { strategy, result };
      }
    }
  }

  return { strategy: null, result: null };
}
