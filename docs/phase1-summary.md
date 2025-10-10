# Phase 1 Summary

## Symbolic Manipulation
- Simplify, expand, factor, rational simplify, and partial fractions now share a reusable rule engine.
- Manipulation commands (simplify, expand, actor, ational_simplify, partialFraction) surface explainable steps via the strategy pipeline.

## Solvers
- solve(...) handles linear, quadratic, cubic, and quartic polynomials.
- Inequalities return LaTeX-ready interval solutions alongside roots.

## Calculus
- New calculus module supports diff, integrate, limit, and 	aylor commands with explainable reasoning.
- Limits accept the x->a syntax and apply L'Hôpital-style retries when direct substitution fails.

## UI & UX
- Explain tab shows interval results, roots, and detail metadata together.
- Help examples include solver and calculus showcase expressions.

## Tests
- Added coverage for manipulation, solving, and calculus flows (lgebra.manipulation, lgebra.solve, lgebra.calculus).
## Units
- Added core unit annotations with evaluator support for basic arithmetic and consistent formatting in results.

