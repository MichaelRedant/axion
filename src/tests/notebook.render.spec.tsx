import React from "react";
import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
let Notebook: typeof import("@/app/axion/components/notebook/Notebook")["Notebook"];
import type { NotebookCell } from "@/app/axion/lib/notebook/types";

vi.mock("@/app/axion/lib/i18n/context", () => {
  const translate = (fallback?: string, params?: Record<string, unknown>) => {
    if (!fallback) {
      return "";
    }
    if (params && "index" in params) {
      return fallback.replace("{{index}}", String(params.index));
    }
    return fallback;
  };
  return {
    useI18n: () => ({
      t: (_key: string, fallback?: string, params?: Record<string, unknown>) => translate(fallback, params),
      locale: "en",
      setLocale: () => {},
      dictionary: {},
    }),
  };
});

vi.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("notebook rendering", () => {
  beforeAll(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const handle = setTimeout(() => callback(Date.now()), 0);
      return handle as unknown as number;
    });
    return import("@/app/axion/components/notebook/Notebook").then((module) => {
      Notebook = module.Notebook;
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("renders markdown preview for text cells", () => {
    const cells: NotebookCell[] = [
      {
        id: "text-1",
        order: 0,
        type: "text",
        input: "**Bold** note",
        createdAt: 1,
        updatedAt: 1,
        status: "idle",
        output: null,
      },
    ];

    renderNotebook(cells, "text-1");

    const preview = screen.getByTestId("notebook-text-preview-text-1");
    const text = preview.textContent ?? "";
    expect(text.replace(/\*/g, "")).toContain("Bold note");
  });

  it("renders a mix of text and math cells", () => {
    const cells: NotebookCell[] = [
      {
        id: "math-1",
        order: 0,
        type: "math",
        input: "1+1",
        createdAt: 1,
        updatedAt: 1,
        status: "idle",
        output: null,
      },
      {
        id: "text-2",
        order: 1,
        type: "text",
        input: "Second cell",
        createdAt: 2,
        updatedAt: 2,
        status: "idle",
        output: null,
      },
    ];

    renderNotebook(cells, "math-1");

    expect(screen.getByTestId("notebook-cell-math-1")).toBeInTheDocument();
    expect(screen.getByTestId("notebook-cell-text-2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bereken|Evaluate/ })).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: /Tekstcel eronder|Add text below/ }).length,
    ).toBeGreaterThanOrEqual(1);
  });
});

function renderNotebook(cells: NotebookCell[], selectedId: string) {
  const noop = () => {};
  const createCell = vi.fn(() => "new-cell");
  const reorder = vi.fn();

  render(
    <Notebook
      cells={cells}
      selectedId={selectedId}
      katex={null}
      onCreateCell={(options) => createCell(options)}
      onSelect={noop}
      onChangeInput={noop}
      onEvaluate={noop}
      onRemove={noop}
      onReorder={(id, order) => reorder(id, order)}
      onActiveInputChange={noop}
    />,
  );
}
