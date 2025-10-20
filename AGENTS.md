# AGENTS

This handbook sets common expectations for AI-augmented collaborators working on the Axion project. Keep it close at hand whenever you spin up an agent so everyone plays the same tune.

## Project Snapshot
- **Product**: Axion – a retro-futuristic, accessibility-first algebra system.
- **Stack**: Next.js 14 (App Router) + TypeScript, Tailwind, KaTeX, Vitest.
- **Entry point**: `src/app/axion/AxionClient.tsx` renders the calculator shell.
- **Algebra core**: `src/app/axion/lib/algebra` (tokenizer → parser → simplify → strategies → evaluator).
- **Notebook state**: `src/app/axion/lib/notebook` (React reducer + localStorage persistence).
- **Key scripts**: `npm run dev`, `build`, `test`, `lint`, `typecheck`, `format`.
- **Locales**: `src/app/axion/i18n` (NL default, EN fallback).

## Agent Roster & Playbooks

### 1. Build Agent (“Constructor”)
- **Mission**: Implement requested features, perform refactors, and keep UX accessible.
- **Warm-up**:
  - Run `npm install` (once per environment).
  - Use `npm run dev` for manual verification, `npm run test` and `npm run lint` before hand-off when time permits.
- **Key Moves**:
  - UI work lives under `src/app/axion/components`; follow existing CSS variable palette (`styles.css`).
  - Algebra adjustments require updates to tokenizer/parser/simplifier alongside unit tests in `src/app/tests` or a nearby algebra suite.
  - Maintain client-side persistence contracts in `lib/notebook/storage.ts` (upgrade version numbers carefully).
- **Guardrails**:
  - Preserve localization keys; when adding copy, introduce keys in `i18n` dictionaries.
  - Prefer pure functions inside algebra core; side effects belong in React hooks/components.
  - Watch for mismatched types: token types are lowercase (`"number"`, `"identifier"`, …); highlight helpers must use the same casing.

### 2. Review Agent (“Auditor”)
- **Mission**: Catch correctness, regression, and accessibility issues before merge.
- **Checklist**:
  - Verify notebook cells use `output` rather than the removed `payload` property (see `NotebookCell` in `lib/notebook/types.ts`).
  - Ensure syntax highlighting uses tokenizer enums (lowercase) to prevent the default branch fallback.
  - Confirm error caret logic treats segment ranges as half-open `[start, end)` so the caret aligns correctly.
  - Scan for KaTeX rendering guards—every `renderToString` call should be wrapped in `try/catch` to avoid client blow-ups.
  - Run `npm run typecheck` or `npm run lint -- --max-warnings=0` on sizeable changes.

### 3. Research Agent (“Interpreter”)
- **Mission**: Explore algebraic strategies, external APIs, or UX patterns without touching code.
- **Workflow**:
  - Compile findings into `docs/` (create a dated memo when necessary).
  - Surface API usage constraints (e.g., Maxima bridge expects `MAXIMA_ENDPOINT`, `NEXT_PUBLIC_MAXIMA_ENABLED=true`).
  - Flag compatibility issues for the Build Agent (e.g., new functions require tokenizer + formatter updates).

## Collaboration Cadence
1. **Triage**: Confirm task scope, note blockers, sync with teammate agents.
2. **Plan**: Outline steps; log them in the coordination channel before editing.
3. **Execute**: Keep diffs tight, favour `apply_patch` for single-file edits, annotate tricky sections with concise comments.
4. **Validate**: Run relevant scripts (lint/tests/typecheck/build). Capture failures with logs and remediation notes.
5. **Debrief**: Summarize intent, touchpoints, testing status, and recommended follow-ups.

## Code & Style References
- Follow ESLint config (`eslint.config.mjs`) and Prettier defaults; ballpark line width ≤ 100.
- React components:
  - Mark client components with `"use client";` when they use hooks.
  - Keep prop types `readonly`; prefer discriminated unions for status (`NotebookCellStatus`).
- Algebra modules:
  - Strategies register through `lib/algebra/strategies/registry.ts`. To add one, define a descriptor with `priority` and ensure unique identifiers.
  - `analyzeExpression` returns `{ ok: true/false }`; downstream UI expects `approx` string or `null`.
- Notebook persistence:
  - Bump `CURRENT_VERSION` when schema changes; add migration logic to `loadNotebookState`.
  - State reducer (`useNotebook.ts`) should remain serializable; avoid non-plain objects.

## Testing Guidance
- **Unit**: Place algebra tests under `src/tests` mirroring lib structure; use Vitest snapshots sparingly.
- **Component**: Use Testing Library with `@testing-library/jest-dom` matchers; mock KaTeX where possible.
- **Manual**: Smoke test `/axion` in dev—evaluate expression, toggle themes, add/remove notebook cells, change locale.
- **Performance**: Re-run `npm run build` after heavy algebra changes; look for bundler warnings.

## Localization & Accessibility
- Always provide fallback keys: `t("key", "Fallback")`.
- Respect existing aria-label patterns (`ThemeToggle`, `Keypad` buttons).
- When adding strings, patch every locale file; run `npm run lint` to catch missing keys.

## Known Pitfalls
- Legacy code references `cell.payload`/`cell.pinned`; new notebook state uses `output` and has no pinning flag—adjust UI before relying on it.
- Syntax highlighters in both `CalcInput` and `MainInput` rely on the algebra tokenizer; keep token types synchronized to avoid losing colour cues.
- Error highlighting must treat token ranges as half-open; inclusive comparisons misplace the caret and confuse users.

## When In Doubt
- Consult `README.md` for setup and architecture.
- Leave breadcrumbs in commit messages or PR descriptions.
- Escalate uncertainties early—math correctness is paramount, theming second, aesthetics third.

Happy calculating!

