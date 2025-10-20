import { describe, expect, it, vi } from "vitest";
import { MaximaClient } from "@/app/axion/lib/algebra/maxima/client";
import { analyzeWithMaxima } from "@/app/axion/lib/algebra/maxima/engine";
import { stripMaximaPrompts } from "@/app/axion/lib/algebra/maxima/parser";
import type { MaximaEvaluation } from "@/app/axion/lib/algebra/maxima/client";

describe("Maxima client", () => {
  it("preserves blank lines while stripping prompts", () => {
    const raw = "(%i1) expand((x+1)^2)\n\n(%o1) x^2 + 2 x + 1\n\n";
    const normalized = stripMaximaPrompts(raw);
    expect(normalized).toBe(`expand((x+1)^2)\n\nx^2 + 2 x + 1`);
  });

  it("parses JSON success payloads", async () => {
    const response = new Response(
      JSON.stringify({
        ok: true,
        result: { raw: "(%o1) 42", latex: "42", approx: "42.0" },
      }),
      { status: 200 },
    );
    const fetchMock = vi.fn().mockResolvedValue(response);
    const client = new MaximaClient({ endpoint: "http://maxima", fetchImpl: fetchMock });

    const evaluation = await client.evaluate("6*7");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://maxima",
      expect.objectContaining({ method: "POST" }),
    );
    expect(evaluation.ok).toBe(true);
    if (evaluation.ok) {
      expect(evaluation.output).toBe("42");
      expect(evaluation.latex).toBe("42");
      expect(evaluation.approx).toBe("42.0");
    }
  });

  it("returns failures for upstream errors", async () => {
    const response = new Response(JSON.stringify({ ok: false, error: "boom" }), { status: 500 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    const client = new MaximaClient({ endpoint: "http://maxima", fetchImpl: fetchMock });

    const evaluation = await client.evaluate("bad");

    expect(evaluation.ok).toBe(false);
    if (!evaluation.ok) {
      expect(evaluation.error).toContain("boom");
    }
  });
});

describe("Maxima engine", () => {
  it("falls back when Maxima is unavailable", async () => {
    const result = await analyzeWithMaxima("1+1", { endpoint: null, client: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.engine).toBe("maxima");
      expect(result.message).toMatch(/niet geconfigureerd|uitgeschakeld/i);
    }
  });

  it("wraps transport responses into evaluation results", async () => {
    const evaluation: MaximaEvaluation = {
      ok: true,
      output: "x^2",
      latex: "x^2",
      approx: null,
      diagnostics: [],
    };

    const client = {
      evaluate: vi.fn().mockResolvedValue(evaluation),
    };

    const result = await analyzeWithMaxima("x^2", { client });

    expect(client.evaluate).toHaveBeenCalledWith("x^2", { format: "tex" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.engine).toBe("maxima");
      expect(result.solution.exact).toBe("x^2");
      expect(result.solution.details?.raw).toBe("x^2");
    }
  });
});
