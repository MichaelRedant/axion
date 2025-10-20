# Maxima command coverage

Axion highlights and forwards a curated subset of Maxima commands. The lists below mirror the
constants defined in [`src/app/axion/lib/algebra/maxima/commands.ts`](../src/app/axion/lib/algebra/maxima/commands.ts).
They are grouped by intent so contributors know which names should stay in sync with the syntax
highlighting and tokenizer.

## Calculus & solving

- `diff`, `integrate`, `limit`, `laplace`, `ilaplace`, `taylor`
- Series/iterative helpers: `sum`, `product`
- Solvers and assumptions: `solve`, `find_root`, `assume`, `assume_pos`, `assume_real`, `assume_complex`

## Simplification & algebraic manipulation

- Canonical forms: `simplify`, `expand`, `factor`
- Rational/trigonometric tools: `ratsimp`, `fullratsimp`, `trigsimp`, `radcan`
- Partial fractions and algebraic systems: `partialfrac`, `partial_fraction`, `linsolve`, `algsys`

## Matrices & linear algebra

- Construction helpers: `matrix`, `mat`, `vector`, `vec`
- Determinants & adjugates: `det`, `adj`
- Transformations: `inverse`, `inv`, `transpose`, `rank`
- Decompositions & systems: `eigen`, `eig`, `svd`, `solvesystem`, `linsolve`

## Probability & optimisation

- Distributions: `pdf`, `cdf`, `pmf`, `binom`, `poisson`, `normal`, `bernoulli`, `beta`, `gamma`
- Optimisation routines: `min`, `max`, `argmin`, `argmax`, `optimize`, `lagrange`, `gradient`

## Trigonometric & miscellaneous helpers

- Circular & hyperbolic functions: `sin`, `cos`, `tan`, `cot`, `sec`, `csc`, `asin`, `acos`, `atan`, `acot`, `asec`, `acsc`
- Hyperbolic counterparts: `sinh`, `cosh`, `tanh`, `coth`, `asinh`, `acosh`, `atanh`
- General utilities: `abs`, `log`, `ln`, `exp`, `sqrt`, `signum`, `unit_step`, `heaviside`, `mod`, `floor`, `ceiling`, `round`

Keep this document updated when adding new Maxima integrations so that the editor can highlight the
commands correctly and reviewers can trace the supported surface area quickly.
