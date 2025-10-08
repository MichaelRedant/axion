import type { Node } from "./ast";
import type { ProblemDescriptor, ProblemType } from "./problems";

export interface SolutionStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly latex?: string;
  readonly expression?: string;
}

export interface PlotConfig {
  readonly type: "function";
  readonly label?: string;
  readonly variable: string;
  readonly expression: Node;
  readonly domain: [number, number];
  readonly samples: number;
}

export interface ComplexValue {
  readonly real: number;
  readonly imaginary: number;
  readonly latex: string;
  readonly approx: string;
}

export interface SolutionBundle {
  readonly type: ProblemType;
  readonly descriptor: ProblemDescriptor;
  readonly exact: string;
  readonly approx: string | null;
  readonly approxValue?: number | null;
  readonly steps: SolutionStep[];
  readonly rationale?: string;
  readonly plotConfig?: PlotConfig | null;
  readonly details?: Record<string, unknown>;
  readonly roots?: Array<number | ComplexValue>;
}
