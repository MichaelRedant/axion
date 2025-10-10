# Phase 0 — Algebra Core Foundations

This document captures the refactors and scaffolding that we will implement before building the larger CAS feature set. It focuses on extensibility and separation of concerns so later phases can add capabilities without rewriting the core.

## Goals

1. **Richer expression model** — Every AST `Node` should advertise:
   - Structural type (Number, Symbol, Binary, …)
   - Semantic domain hint (real, complex, matrix, unitful, piecewise)
   - Optional annotations (assumptions, provenance, simplification flags)
2. **Evaluation context** — Define shared configuration and assumption handling for evaluation/simplification/solvers.
3. **Strategy pipeline** — Standardise how features plug into the `analyzeExpression` flow with capability discovery, priority, and fallbacks.
4. **Non-breaking transition** — Keep the current MVP behaviour so the UI, tests, and existing strategies continue to work while new metadata is opt-in.

## Architectural Overview

```
┌────────────────────────────────┐
│ parse/tokenize                 │
│   ↓                            │
│ normalize AST (phase 1+)       │
│   ↓                            │
│ ExpressionContext              │
│   ├── type tags / domains      │
│   ├── assumptions & units      │
│   ├── evaluation settings      │
│   └── analysis metadata        │
│                                │
│ StrategyRegistry               │
│   ├── Capability descriptors   │
│   ├── Priority resolution      │
│   └── Strategy pipeline        │
│                                │
│ SolutionBundle                 │
│   ├── exact / approx values    │
│   ├── steps / rationale        │
│   ├── visualisations           │
│   └── diagnostics              │
└────────────────────────────────┘
```

## Scope of Phase 0

### 1. Core Types

- Add `ExpressionDomain` enum and `AnnotationMap` definitions in a new `core/types.ts` module.
- Extend `BaseNode` in `ast.ts` to include optional `domain` and `annotations` fields. Existing constructors remain valid; older nodes simply omit the properties.
- Define `Assumption` and `AssumptionSet` types to capture variable/domain constraints.
- Add `EvaluationContext` that travels through evaluators/strategies instead of ad-hoc option objects.

### 2. Shared Context Utilities

- Introduce a helper `createExpressionContext(input, tokens, ast)` that hydates metadata (variables, domains, assumptions placeholder).
- Provide type guards for domain checks (e.g. `isComplexDomain(domain)`), ready for later use.

### 3. Strategy Lifecycle

- Refactor `strategies/registry.ts` to work with capability descriptors:
  ```ts
  interface StrategyDescriptor {
    id: string;
    handles: ProblemType[];
    priority?: number;
  }
  ```
- Strategies register via `{ descriptor, factory }`, returning an instance when a problem is compatible.
- Ensure existing `QuadraticStrategy` still works by wrapping the new descriptor.

### 4. Non-breaking Adapter Layer

- `analyzeExpression` should continue to return `EvaluationResult`. Internally it will rely on the new `ExpressionContext` and pass it to strategies.
- The fallback solver stays functional with the richer context.

### 5. Testing and Docs

- Update / add unit tests for the new helpers (e.g. context creation, domain tagging default behaviour).
- Document the public types in this file; later phases can append their modules beneath the same structure.

## Out of Scope (Deferred)

- Actual implementation of calculus, linear algebra, plotting upgrades, etc.
- Real assumption inference or unit conversion logic (only placeholders are added now).
- Full rewrite of existing strategies (they will be migrated when their feature area is handled).

---

**Next Steps**
1. Introduce `core/types.ts` with domain/enumeration scaffolding.
2. Extend `ast.ts` base node definition + create context helpers.
3. Refactor strategy registry per the new descriptor interface.
4. Update tests for the core utilities.
