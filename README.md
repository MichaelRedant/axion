# Axion

Axion is a retro-futuristic, accessibility-first algebra system built with Next.js 14. It provides symbolic and numeric evaluation, KaTeX rendering, and a neon UI inspired by CRT dashboards. The MVP focusses on exact arithmetic, fast input loops, and a testable algebra core.

## Getting Started

```bash
npm install
npm run dev
```

Visit `http://localhost:3000/axion` to open the calculator.

### Available Scripts

- `npm run dev` – start the Next.js dev server with hot reload.
- `npm run build` – create an optimized production build (PWA enabled).
- `npm run start` – serve the production build.
- `npm run lint` / `lint:fix` – run ESLint (TypeScript + Testing Library rules).
- `npm run test` / `test:watch` – execute Vitest with coverage (>70% on algebra code).
- `npm run typecheck` – ensure the project type-checks without emit.
- `npm run format` / `format:write` – verify or write Prettier formatting.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Enter` | Evaluate expression |
| `Shift` + `Enter` | Insert newline |
| `Arrow Up` / `Arrow Down` | Navigate history |
| `Ctrl`/`Cmd` + `K` | Clear input |
| `Ctrl`/`Cmd` + `/` | Toggle help modal |
| `Ctrl`/`Cmd` + `L` | Toggle neon theme |

The shortcuts are surfaced in the in-app help modal (`Help & shortcuts`).

## Tech Stack & Architecture

- **Framework**: Next.js 14 (App Router, Edge-friendly) with TypeScript.
- **Styling**: Tailwind CSS + custom CSS variables for theme control.
- **Algebra engine**: Tokenizer, Pratt parser, simplifier, evaluator, and KaTeX formatter under `src/app/axion/lib/algebra`.
- **Maxima bridge**: Optional proxy (`/api/maxima`) that forwards expressions to an external Maxima server. Enable by setting `MAXIMA_ENDPOINT` (server) and `NEXT_PUBLIC_MAXIMA_ENABLED=true`.
- **UI**: Accessible components (`CalcInput`, `ResultPane`, `HistoryPane`, `Keypad`, `HelpModal`, `ThemeToggle`) residing in `src/app/axion/components`.
- **I18n**: Lightweight context with NL default + EN fallback (`src/app/axion/lib/i18n`).
- **Testing**: Vitest + Testing Library; algebra unit tests deliver >77% coverage with V8 provider.
- **PWA**: `next-pwa` with manifest, offline runtime caching, and install prompt-ready metadata.

### Project Layout

```
src/
  app/
    api/health/route.ts       # health-check endpoint
    axion/                    # page, components, styles
      components/
      lib/
        algebra/              # core math engine
        hooks/                # reusable hooks (KaTeX loader)
        i18n/                 # language provider
        utils/                # history & keyboard helpers
      styles.css
    page.tsx                  # redirect to /axion
  tests/                      # Vitest suites
  i18n/                       # locale dictionaries
public/
  icons/axion.svg             # PWA icon
  manifest.webmanifest
  robots.txt
```

## Testing Strategy

- Algebra unit tests cover tokenizer, parser, evaluator, simplifier, formatter, and engine helpers.
- Maxima bridge tests cover payload normalisation, proxy behaviour, and the asynchronous engine adapter.
- UI shortcut tests ensure the controlled textarea responds to keyboard commands.
- Coverage is generated via `npm run test` and documented in the CLI output (goal: ≥70% for algebra files).

## PWA Notes

- App is installable with offline caching of static assets via `next-pwa`.
- Manifest + icon live in `public/` and Lighthouse-friendly metadata is set in `src/app/layout.tsx`.

## Future Enhancements

- Persistent history via IndexedDB or localStorage sync.
- Angle mode (rad/deg) toggle and precision tuning.
- Export history to `.txt` and richer KaTeX formatting (matrix, fractions, etc.).
- Settings panel for personalised keyboard profiles and optional thousand separators.
- Built-in Maxima session manager with connection status indicator.

## License

Released for educational and prototyping purposes. See repository history for details.
