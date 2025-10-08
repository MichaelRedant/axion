"use client";

import { useEffect, useState } from "react";

export interface KatexHandle {
  readonly renderToString: (input: string) => string;
}

/**
 * Lazily loads KaTeX on the client and returns a rendering helper once ready.
 */
export function useKatex() {
  const [katex, setKatex] = useState<KatexHandle | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [{ default: katexModule }] = await Promise.all([
        import("katex"),
        import("katex/dist/katex.min.css"),
      ]);

      if (!cancelled) {
        setKatex({
          renderToString: (expression: string) =>
            katexModule.renderToString(expression, {
              displayMode: false,
              throwOnError: false,
            }),
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return katex;
}
