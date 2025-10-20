import { describe, expect, it } from "vitest";
import { buildPlot, type CartesianPlotConfig, type ParametricPlotConfig, type ImplicitPlotConfig, type SurfacePlotConfig } from "@/app/axion/components/plots/builders";
import { Parser } from "@/app/axion/lib/algebra/parser";
import { tokenize } from "@/app/axion/lib/algebra/tokenizer";

function parseNode(expression: string) {
  const tokens = tokenize(expression);
  return new Parser(tokens).parse();
}

describe("plot builders", () => {
  it("bouwt een cartesiaans plot met annotaties", () => {
    const config: CartesianPlotConfig = {
      type: "cartesian",
      variable: "x",
      expression: parseNode("x^2"),
      domain: [-1, 1],
      samples: 16,
      label: "f(x)",
      axes: {
        x: { label: "x" },
        y: { label: "f(x)" },
      },
      annotations: [
        { type: "point", coordinates: [0, 0], label: "O" },
        { type: "line", coordinates: [0] },
      ],
    };

    const plot = buildPlot(config);

    expect(plot).not.toBeNull();
    expect(plot?.data[0]).toMatchObject({ type: "scatter", mode: "lines" });
    expect(plot?.layout).toMatchObject({ xaxis: expect.any(Object), yaxis: expect.any(Object) });
    expect(plot?.layout).toHaveProperty("shapes");
  });

  it("bouwt een parametrische curve", () => {
    const config: ParametricPlotConfig = {
      type: "parametric",
      parameter: "t",
      range: [0, Math.PI * 2],
      samples: 24,
      xExpression: parseNode("cos(t)"),
      yExpression: parseNode("sin(t)"),
      label: "Eenheidskring",
      axes: {
        x: { label: "x" },
        y: { label: "y" },
      },
      annotations: [{ type: "text", coordinates: [1, 0], label: "t = 0" }],
    };

    const plot = buildPlot(config);

    expect(plot).not.toBeNull();
    expect(plot?.data[0]).toMatchObject({ type: "scatter" });
    expect(plot?.layout).toMatchObject({ xaxis: expect.any(Object), yaxis: expect.any(Object) });
  });

  it("bouwt een impliciet contourplot", () => {
    const config: ImplicitPlotConfig = {
      type: "implicit",
      expression: parseNode("x^2 + y^2 - 1"),
      variables: ["x", "y"],
      xRange: [-2, 2],
      yRange: [-2, 2],
      resolution: 16,
      label: "Cirkel",
      annotations: [{ type: "point", coordinates: [0, 1], label: "bovenzijde" }],
    };

    const plot = buildPlot(config);

    expect(plot).not.toBeNull();
    expect(plot?.data[0]).toMatchObject({ type: "contour" });
    expect(plot?.data).toHaveLength(2);
  });

  it("bouwt een oppervlakteplot", () => {
    const config: SurfacePlotConfig = {
      type: "surface",
      expression: parseNode("x + y"),
      variables: ["x", "y", "z"],
      xRange: [-1, 1],
      yRange: [-1, 1],
      resolution: 8,
      label: "z = x + y",
      annotations: [
        { type: "point", coordinates: [0, 0, 0], label: "O" },
        { type: "line", coordinates: [0, 0, 0, 1, 1, 2] },
      ],
    };

    const plot = buildPlot(config);

    expect(plot).not.toBeNull();
    expect(plot?.data[0]).toMatchObject({ type: "surface" });
    expect(plot?.layout).toHaveProperty("scene");
    expect(plot?.data.length).toBeGreaterThan(1); // bevat annotaties
  });
});
