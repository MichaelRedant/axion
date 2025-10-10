import type { ExpressionContext } from "../core/types";
import type { ProblemDescriptor, ProblemType } from "../problems";
import type { SolutionBundle } from "../solution";
import type { Node } from "../ast";
import type { Token } from "../tokenizer";

export interface StrategyDescriptor {
  readonly id: string;
  readonly handles: ProblemType[];
  readonly priority?: number;
}

export interface StrategyContext {
  readonly input: string;
  readonly tokens: Token[];
  readonly ast: Node;
  readonly simplified: Node;
  readonly descriptor: ProblemDescriptor;
  readonly expression: ExpressionContext;
}

export interface StrategyResult {
  readonly solution: SolutionBundle;
}

export interface ProblemStrategy {
  readonly descriptor: StrategyDescriptor;
  matches(context: StrategyContext): boolean;
  solve(context: StrategyContext): StrategyResult | null;
}
