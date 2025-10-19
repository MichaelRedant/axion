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
  readonly followUps?: ExplainReference[];
  readonly intervals?: SolutionInterval[];
}
