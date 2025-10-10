export type ExpressionDomain =
  | "real"
  | "complex"
  | "matrix"
  | "vector"
  | "scalar"
  | "unit"
  | "piecewise"
  | "unknown";

export type AnnotationPrimitive = string | number | boolean | null;
export type AnnotationArray = ReadonlyArray<
  AnnotationPrimitive | AnnotationMap | AnnotationArray
>;

export interface AnnotationMap {
  readonly [key: string]: AnnotationPrimitive | AnnotationMap | AnnotationArray;
}

export type AnnotationValue = AnnotationPrimitive | AnnotationMap | AnnotationArray;

export interface Assumption {
  readonly subject: string;
  readonly predicate:
    | "real"
    | "complex"
    | "positive"
    | "negative"
    | "nonzero"
    | "integer"
    | "rational"
    | "even"
    | "odd"
    | "unit";
  readonly metadata?: AnnotationMap;
}

export interface AssumptionSet {
  readonly variables: Record<string, Assumption[]>;
  readonly globals: Assumption[];
}

export interface EvaluationSettings {
  readonly precision: number;
  readonly maxIterations?: number;
  readonly angleMode?: "radian" | "degree";
}

export interface ExpressionContext {
  readonly domainHints: Map<string, ExpressionDomain>;
  readonly assumptions: AssumptionSet;
  readonly settings: EvaluationSettings;
}

export const DEFAULT_EVALUATION_SETTINGS: EvaluationSettings = {
  precision: 12,
  angleMode: "radian",
};

export const EMPTY_ASSUMPTIONS: AssumptionSet = {
  variables: {},
  globals: [],
};

export function createExpressionContext(
  options?: Partial<ExpressionContext>,
): ExpressionContext {
  return {
    domainHints: options?.domainHints ?? new Map<string, ExpressionDomain>(),
    assumptions: options?.assumptions ?? EMPTY_ASSUMPTIONS,
    settings: options?.settings ?? DEFAULT_EVALUATION_SETTINGS,
  };
}

export function mergeAssumptions(
  base: AssumptionSet,
  patch: Partial<AssumptionSet>,
): AssumptionSet {
  const variables = { ...base.variables };

  if (patch.variables) {
    for (const [key, value] of Object.entries(patch.variables)) {
      if (!variables[key]) {
        variables[key] = [...value];
        continue;
      }
      variables[key] = [...variables[key], ...value];
    }
  }

  return {
    variables,
    globals: [...base.globals, ...((patch.globals ?? []))],
  };
}

export function isComplexDomain(domain: ExpressionDomain | undefined): boolean {
  return domain === "complex";
}

export function isMatrixDomain(domain: ExpressionDomain | undefined): boolean {
  return domain === "matrix" || domain === "vector";
}
