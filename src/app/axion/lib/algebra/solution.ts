import type { Node } from "./ast";
import type { ProblemDescriptor, ProblemType } from "./problems";

export interface SolutionStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly latex?: string;
  readonly expression?: string;
}

export interface PlotAxisConfig {
  readonly label?: string;
  readonly min?: number;
  readonly max?: number;
  readonly ticks?: number;
}

export interface PlotAnnotation {
  readonly type: "point" | "line" | "text";
  readonly coordinates: number[];
  readonly label?: string;
}

interface PlotBaseConfig {
  readonly label?: string;
  readonly axes?: {
    readonly x?: PlotAxisConfig;
    readonly y?: PlotAxisConfig;
    readonly z?: PlotAxisConfig;
  };
  readonly annotations?: PlotAnnotation[];
}

export interface CartesianPlotConfig extends PlotBaseConfig {
  readonly type: "cartesian";
  readonly variable: string;
  readonly expression: Node;
  readonly domain: [number, number];
  readonly samples: number;
}

export interface ParametricPlotConfig extends PlotBaseConfig {
  readonly type: "parametric";
  readonly parameter: string;
  readonly range: [number, number];
  readonly samples: number;
  readonly xExpression: Node;
  readonly yExpression: Node;
}

export interface ImplicitPlotConfig extends PlotBaseConfig {
  readonly type: "implicit";
  readonly expression: Node;
  readonly variables: [string, string];
  readonly xRange: [number, number];
  readonly yRange: [number, number];
  readonly resolution: number;
}

export interface SurfacePlotConfig extends PlotBaseConfig {
  readonly type: "surface";
  readonly expression: Node;
  readonly variables: [string, string, string];
  readonly xRange: [number, number];
  readonly yRange: [number, number];
  readonly resolution: number;
}

export type PlotConfig =
  | CartesianPlotConfig
  | ParametricPlotConfig
  | ImplicitPlotConfig
  | SurfacePlotConfig;

export interface ComplexValue {
  readonly real: number;
  readonly imaginary: number;
  readonly latex: string;
  readonly approx: string;
}

export interface ExplainReference {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly targetStepId?: string;
}

export interface SolutionInterval {
  readonly latex: string;
  readonly description?: string;
}

export interface SolutionRationaleDetail {
  readonly title?: string;
  readonly description?: string;
  readonly bullets?: readonly string[];
}

export interface SolutionRationaleMap {
  readonly summary?: string;
  readonly method?: string;
  readonly strategy?: string;
  readonly approach?: string;
  readonly validWhen?: string;
  readonly domain?: string;
  readonly caution?: string;
  readonly caveats?: string;
  readonly warning?: string;
  readonly notes?: readonly string[];
  readonly insights?: readonly string[];
  readonly takeaways?: readonly string[];
  readonly highlights?: readonly string[];
  readonly details?:
    | string
    | readonly SolutionRationaleDetail[]
    | SolutionRationaleDetail
    | readonly string[];
  readonly cases?:
    | string
    | readonly SolutionRationaleDetail[]
    | SolutionRationaleDetail
    | readonly string[];
  readonly explanations?:
    | string
    | readonly SolutionRationaleDetail[]
    | SolutionRationaleDetail
    | readonly string[];
  readonly [key: string]: unknown;
}

export type SolutionRationale = string | SolutionRationaleMap;

export interface SolutionBundle {
  readonly type: ProblemType;
  readonly descriptor: ProblemDescriptor;
  readonly exact: string;
  readonly approx: string | null;
  readonly approxValue?: number | null;
  readonly steps: SolutionStep[];
  readonly rationale?: SolutionRationale;
  readonly plotConfig?: PlotConfig | null;
  readonly details?: Record<string, unknown>;
  readonly roots?: Array<number | ComplexValue>;
  readonly followUps?: ExplainReference[];
  readonly intervals?: SolutionInterval[];
}
