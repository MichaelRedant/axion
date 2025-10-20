export const MAXIMA_CALCULUS_COMMANDS = [
  "diff",
  "integrate",
  "limit",
  "laplace",
  "ilaplace",
  "taylor",
  "sum",
  "product",
  "solve",
  "find_root",
  "assume",
  "assume_pos",
  "assume_real",
  "assume_complex",
] as const;

export const MAXIMA_SIMPLIFICATION_COMMANDS = [
  "simplify",
  "expand",
  "factor",
  "ratsimp",
  "fullratsimp",
  "trigsimp",
  "radcan",
  "partialfrac",
  "partial_fraction",
  "solve",
  "linsolve",
  "algsys",
] as const;

export const MAXIMA_MATRIX_COMMANDS = [
  "matrix",
  "mat",
  "vector",
  "vec",
  "det",
  "adj",
  "inverse",
  "inv",
  "transpose",
  "rank",
  "eigen",
  "eig",
  "svd",
  "solvesystem",
  "linsolve",
] as const;

export const MAXIMA_PROBABILITY_COMMANDS = [
  "pdf",
  "cdf",
  "pmf",
  "binom",
  "poisson",
  "normal",
  "bernoulli",
  "beta",
  "gamma",
] as const;

export const MAXIMA_OPTIMISATION_COMMANDS = [
  "min",
  "max",
  "argmin",
  "argmax",
  "optimize",
  "lagrange",
  "gradient",
] as const;

export const MAXIMA_TRIG_COMMANDS = [
  "sin",
  "cos",
  "tan",
  "cot",
  "sec",
  "csc",
  "asin",
  "acos",
  "atan",
  "acot",
  "asec",
  "acsc",
  "sinh",
  "cosh",
  "tanh",
  "coth",
  "asinh",
  "acosh",
  "atanh",
] as const;

export const MAXIMA_MISC_COMMANDS = [
  "abs",
  "log",
  "ln",
  "exp",
  "sqrt",
  "signum",
  "unit_step",
  "heaviside",
  "mod",
  "floor",
  "ceiling",
  "round",
] as const;

export const MAXIMA_COMMANDS = Array.from(
  new Set(
    [
      ...MAXIMA_CALCULUS_COMMANDS,
      ...MAXIMA_SIMPLIFICATION_COMMANDS,
      ...MAXIMA_MATRIX_COMMANDS,
      ...MAXIMA_PROBABILITY_COMMANDS,
      ...MAXIMA_OPTIMISATION_COMMANDS,
      ...MAXIMA_TRIG_COMMANDS,
      ...MAXIMA_MISC_COMMANDS,
    ].map((command) => command.toLowerCase()),
  ),
).sort();
