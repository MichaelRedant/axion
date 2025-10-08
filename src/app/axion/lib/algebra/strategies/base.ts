import type { ProblemDescriptor } from "../problems";
import type { SolutionBundle } from "../solution";
import type { Node } from "../ast";
import type { Token } from "../tokenizer";

export interface StrategyContext {
  readonly input: string;
  readonly tokens: Token[];
  readonly ast: Node;
  readonly simplified: Node;
  readonly descriptor: ProblemDescriptor;
}

export interface ProblemStrategy {
  readonly type: string;
  match(context: StrategyContext): boolean;
  solve(context: StrategyContext): SolutionBundle | null;
}
