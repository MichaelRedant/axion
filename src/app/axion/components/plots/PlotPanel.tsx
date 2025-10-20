"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { evaluate, isComplexResult, isUnitResult } from "../../lib/algebra/evaluator";
import type { Node } from "../../lib/algebra/ast";
import type {
  PlotConfig,
  CartesianPlotConfig,
  ParametricPlotConfig,
  ImplicitPlotConfig,
  SurfacePlotConfig,
  PlotAnnotation,
  PlotAxisConfig,
} from "../../lib/algebra/solution";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as unknown as typeof import("react-plotly.js").default;

type PlotTrace = Record<string, unknown>;
type PlotLayout = Record<string, unknown>;
type PlotShape = Record<string, unknown>;

type PlotBuild = {
  readonly data: PlotTrace[];
  readonly layout: PlotLayout;
  readonly height: number;
};

export function PlotPanel({ config }: { readonly config: PlotConfig }) {
  const plot = useMemo(() => buildPlot(config), [config]);

  if (!plot) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[rgba(0,255,242,0.2)] bg-black/50 p-4">
      <Plot
        data={plot.data as any}
        layout={plot.layout as any}
        config={{ responsive: true, displaylogo: false }}
        style={{ width: "100%", height: plot.height }}
      />
    </div>
  );
}

function buildPlot(config: PlotConfig): PlotBuild | null {
  switch (config.type) {
    case "cartesian":
      return buildCartesianPlot(config);
    case "parametric":
      return buildParametricPlot(config);
    case "implicit":
      return buildImplicitPlot(config);
    case "surface":
      return buildSurfacePlot(config);
    default:
      return null;
  }
}

function buildCartesianPlot(config: CartesianPlotConfig): PlotBuild | null {
  const { x, y } = sampleCartesian(config.expression, config.variable, normalizeDomain(config.domain), config.samples);
  if (!x.length) {
    return null;
  }

  const traces: PlotTrace[] = [
    {
      type: "scatter",
      mode: "lines",
      name: config.label ?? `f(${config.variable})`,
      x,
      y,
      line: { color: "#00fff2" },
      hoverinfo: "x+y",
    },
  ];

  const layout = baseLayout2D(config.label);
  const xAxis = applyAxis(layout, "xaxis", config.axes?.x, x, config.domain);
  const yAxis = applyAxis(layout, "yaxis", config.axes?.y, y);

  const annotations = createAnnotations(config.annotations, {
    dimensions: 2,
    xRange: extractAxisRange(xAxis),
    yRange: extractAxisRange(yAxis),
  });
  traces.push(...annotations.traces);
  if (annotations.shapes.length) {
    layout.shapes = annotations.shapes;
  }

  return { data: traces, layout, height: 360 };
}

function buildParametricPlot(config: ParametricPlotConfig): PlotBuild | null {
  const { x, y } = sampleParametric(config);
  if (!x.length) {
    return null;
  }

  const traces: PlotTrace[] = [
    {
      type: "scatter",
      mode: "lines",
      name: config.label ?? "Parametrische curve",
      x,
      y,
      line: { color: "#00fff2" },
      hoverinfo: "x+y",
    },
  ];

  const layout = baseLayout2D(config.label);
  const xAxis = applyAxis(layout, "xaxis", config.axes?.x, x);
  const yAxis = applyAxis(layout, "yaxis", config.axes?.y, y);

  const annotations = createAnnotations(config.annotations, {
    dimensions: 2,
    xRange: extractAxisRange(xAxis),
    yRange: extractAxisRange(yAxis),
  });
  traces.push(...annotations.traces);
  if (annotations.shapes.length) {
    layout.shapes = annotations.shapes;
  }

  return { data: traces, layout, height: 360 };
}

function buildImplicitPlot(config: ImplicitPlotConfig): PlotBuild | null {
  const { contour, annotations } = sampleImplicit(config);
  if (!contour) {
    return null;
  }

  const data: PlotTrace[] = [contour];

  const layout = baseLayout2D(config.label);
  const xAxis = applyAxis(layout, "xaxis", config.axes?.x, undefined, config.xRange);
  const yAxis = applyAxis(layout, "yaxis", config.axes?.y, undefined, config.yRange);

  const annotationArtifacts = createAnnotations(config.annotations, {
    dimensions: 2,
    xRange: extractAxisRange(xAxis) ?? config.xRange,
    yRange: extractAxisRange(yAxis) ?? config.yRange,
  });
  data.push(...annotationArtifacts.traces);
  if (annotationArtifacts.shapes.length) {
    layout.shapes = annotationArtifacts.shapes;
  }

  return { data, layout, height: 360 };
}

function buildSurfacePlot(config: SurfacePlotConfig): PlotBuild | null {
  const { surface, annotations } = sampleSurface(config);
  if (!surface) {
    return null;
  }

  const data: PlotTrace[] = [
    {
      type: "surface",
      x: surface.x,
      y: surface.y,
      z: surface.z,
      colorscale: "Electric",
      showscale: false,
      hoverinfo: "x+y+z",
    },
    ...annotations.traces,
  ];

  const layout = baseLayout3D(config.label);
  const scene: PlotLayout = {
    xaxis: axisConfig3D(config.axes?.x, config.xRange),
    yaxis: axisConfig3D(config.axes?.y, config.yRange),
    zaxis: axisConfig3D(config.axes?.z),
  };
  if (annotations.shapes.length) {
    scene.shapes = annotations.shapes;
  }
  layout.scene = scene;

  return { data, layout, height: 420 };
}

function sampleCartesian(
  expression: Node,
  variable: string,
  domain: [number, number],
  samples: number,
) {
  const x: number[] = [];
  const y: number[] = [];

  const [start, end] = domain;
  const step = (end - start) / samples;

  for (let index = 0; index <= samples; index += 1) {
    const value = start + index * step;
    const result = evaluateReal(expression, { [variable]: value });
    if (typeof result === "number" && Number.isFinite(result)) {
      x.push(value);
      y.push(result);
    }
  }

  return { x, y };
}

function sampleParametric(config: ParametricPlotConfig) {
  const x: number[] = [];
  const y: number[] = [];
  const [start, end] = normalizeDomain(config.range);
  const step = (end - start) / config.samples;

  for (let index = 0; index <= config.samples; index += 1) {
    const t = start + index * step;
    const env = { [config.parameter]: t } as Record<string, number>;
    const px = evaluateReal(config.xExpression, env);
    const py = evaluateReal(config.yExpression, env);
    if (typeof px === "number" && Number.isFinite(px) && typeof py === "number" && Number.isFinite(py)) {
      x.push(px);
      y.push(py);
    }
  }

  return { x, y };
}

function sampleImplicit(config: ImplicitPlotConfig) {
  const xValues = linspace(normalizeDomain(config.xRange), config.resolution);
  const yValues = linspace(normalizeDomain(config.yRange), config.resolution);
  const z: number[][] = [];

  for (const y of yValues) {
    const row: number[] = [];
    for (const x of xValues) {
      const value = evaluateReal(config.expression, {
        [config.variables[0]]: x,
        [config.variables[1]]: y,
      });
      row.push(typeof value === "number" && Number.isFinite(value) ? value : NaN);
    }
    z.push(row);
  }

  const contour: PlotTrace = {
    type: "contour",
    x: xValues,
    y: yValues,
    z,
    contours: { coloring: "lines", showlabels: true },
    colorscale: "Electric",
    showscale: false,
  };

  const annotations = createAnnotations(config.annotations, {
    dimensions: 2,
    xRange: config.xRange,
    yRange: config.yRange,
  });

  return { contour, annotations };
}

function sampleSurface(config: SurfacePlotConfig) {
  const xValues = linspace(normalizeDomain(config.xRange), config.resolution);
  const yValues = linspace(normalizeDomain(config.yRange), config.resolution);
  const z: number[][] = [];

  for (const y of yValues) {
    const row: number[] = [];
    for (const x of xValues) {
      const value = evaluateReal(config.expression, {
        [config.variables[0]]: x,
        [config.variables[1]]: y,
      });
      row.push(typeof value === "number" && Number.isFinite(value) ? value : NaN);
    }
    z.push(row);
  }

  const annotations = createAnnotations(config.annotations, { dimensions: 3 });

  return {
    surface: { x: xValues, y: yValues, z },
    annotations,
  };
}

function evaluateReal(node: Node, env: Record<string, number>) {
  try {
    const result = evaluate(node, { env, precision: 10 });
    if (isUnitResult(result)) {
      return result.magnitude;
    }
    if (isComplexResult(result)) {
      return Math.abs(result.imaginary) < 1e-9 ? result.real : NaN;
    }
    return result;
  } catch {
    return NaN;
  }
}

function baseLayout2D(title?: string): PlotLayout {
  return {
    autosize: true,
    margin: { l: 50, r: 20, b: 50, t: title ? 40 : 20 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#f5f7fa" },
    hovermode: "closest",
    title: title ?? "",
  };
}

function baseLayout3D(title?: string): PlotLayout {
  return {
    autosize: true,
    margin: { l: 20, r: 20, b: 40, t: title ? 50 : 30 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#f5f7fa" },
    title: title ?? "",
  };
}

function applyAxis(
  layout: PlotLayout,
  axisKey: "xaxis" | "yaxis",
  axisConfig: PlotAxisConfig | undefined,
  dataRange?: number[],
  explicitRange?: [number, number],
): PlotLayout {
  const axis: PlotLayout = {
    ticks: "outside",
    tickcolor: "#9ca3af",
    gridcolor: "rgba(255,255,255,0.15)",
  };

  if (axisConfig?.label) {
    axis.title = axisConfig.label;
  }

  let min = typeof axisConfig?.min === "number" ? axisConfig.min : undefined;
  let max = typeof axisConfig?.max === "number" ? axisConfig.max : undefined;

  if (explicitRange) {
    const [rangeMin, rangeMax] = normalizeDomain(explicitRange);
    if (typeof min !== "number") min = rangeMin;
    if (typeof max !== "number") max = rangeMax;
  } else if (dataRange?.length) {
    const computedMin = Math.min(...dataRange);
    const computedMax = Math.max(...dataRange);
    if (typeof min !== "number" && Number.isFinite(computedMin)) min = computedMin;
    if (typeof max !== "number" && Number.isFinite(computedMax)) max = computedMax;
  }

  if (typeof min === "number" && typeof max === "number" && min !== max) {
    if (min > max) [min, max] = [max, min];
    axis.range = [min, max];
  }

  if (axisConfig?.ticks) {
    axis.nticks = axisConfig.ticks;
  }

  layout[axisKey] = axis;
  return axis;
}

function extractAxisRange(axis?: PlotLayout): [number, number] | undefined {
  if (!axis) {
    return undefined;
  }
  const range = (axis as { range?: unknown }).range;
  if (Array.isArray(range) && range.length >= 2) {
    const [min, max] = range;
    if (typeof min === "number" && typeof max === "number" && min !== max) {
      return [min, max];
    }
  }
  return undefined;
}

function axisConfig3D(axis?: PlotAxisConfig, range?: [number, number]): PlotLayout {
  const axisLayout: PlotLayout = {
    backgroundcolor: "rgba(0,0,0,0)",
    gridcolor: "rgba(255,255,255,0.15)",
    zerolinecolor: "rgba(255,255,255,0.4)",
  };

  if (axis?.label) {
    axisLayout.title = axis.label;
  }

  let min = typeof axis?.min === "number" ? axis.min : undefined;
  let max = typeof axis?.max === "number" ? axis.max : undefined;

  if (range) {
    const [rangeMin, rangeMax] = normalizeDomain(range);
    if (typeof min !== "number") min = rangeMin;
    if (typeof max !== "number") max = rangeMax;
  }

  if (typeof min === "number" && typeof max === "number" && min !== max) {
    if (min > max) [min, max] = [max, min];
    axisLayout.range = [min, max];
  }

  if (axis?.ticks) {
    axisLayout.nticks = axis.ticks;
  }

  return axisLayout;
}

function createAnnotations(
  annotations: PlotAnnotation[] | undefined,
  context: {
    dimensions: number;
    xRange?: [number, number];
    yRange?: [number, number];
  },
) {
  const pointCoords: number[][] = [];
  const pointLabels: (string | undefined)[] = [];
  const textCoords: number[][] = [];
  const textLabels: string[] = [];
  const shapes: PlotShape[] = [];
  const traces: PlotTrace[] = [];
  const lineSegments3D: Array<[number[], number[]]> = [];

  if (!annotations?.length) {
    return { traces, shapes };
  }

  for (const annotation of annotations) {
    switch (annotation.type) {
      case "point": {
        if (annotation.coordinates.length >= context.dimensions) {
          pointCoords.push(annotation.coordinates);
          pointLabels.push(annotation.label);
        }
        break;
      }
      case "text": {
        if (annotation.coordinates.length >= context.dimensions && annotation.label) {
          textCoords.push(annotation.coordinates);
          textLabels.push(annotation.label);
        }
        break;
      }
      case "line": {
        if (context.dimensions === 2) {
          const [x0, y0, x1, y1] = normalizeLineCoordinates(annotation.coordinates, context);
          shapes.push({
            type: "line",
            x0,
            x1,
            y0,
            y1,
            line: { color: "#fbbf24", dash: "dot", width: 1.5 },
          });
        } else if (context.dimensions === 3) {
          const segment = normalizeLine3D(annotation.coordinates);
          if (segment) {
            lineSegments3D.push(segment);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  if (pointCoords.length) {
    if (context.dimensions === 2) {
      traces.push({
        type: "scatter",
        mode: "markers+text",
        x: pointCoords.map((coord) => coord[0]!),
        y: pointCoords.map((coord) => coord[1]!),
        text: pointLabels.map((label) => label ?? ""),
        textposition: "top center",
        marker: { color: "#fbbf24", size: 8 },
        name: "Annotaties",
      });
    } else {
      traces.push({
        type: "scatter3d",
        mode: "markers+text",
        x: pointCoords.map((coord) => coord[0]!),
        y: pointCoords.map((coord) => coord[1]!),
        z: pointCoords.map((coord) => coord[2]!),
        text: pointLabels.map((label) => label ?? ""),
        textposition: "top center",
        marker: { color: "#fbbf24", size: 5 },
        name: "Annotaties",
      });
    }
  }

  if (textCoords.length) {
    if (context.dimensions === 2) {
      traces.push({
        type: "scatter",
        mode: "text",
        x: textCoords.map((coord) => coord[0]!),
        y: textCoords.map((coord) => coord[1]!),
        text: textLabels,
        textposition: "top center",
        showlegend: false,
        hoverinfo: "skip",
      });
    } else {
      traces.push({
        type: "scatter3d",
        mode: "text",
        x: textCoords.map((coord) => coord[0]!),
        y: textCoords.map((coord) => coord[1]!),
        z: textCoords.map((coord) => coord[2]!),
        text: textLabels,
        textposition: "top center",
        showlegend: false,
        hoverinfo: "skip",
      });
    }
  }

  if (lineSegments3D.length) {
    for (const [start, end] of lineSegments3D) {
      traces.push({
        type: "scatter3d",
        mode: "lines",
        x: [start[0], end[0]],
        y: [start[1], end[1]],
        z: [start[2], end[2]],
        line: { color: "#fbbf24", width: 2, dash: "dot" },
        showlegend: false,
        hoverinfo: "skip",
      });
    }
  }

  return { traces, shapes };
}

function normalizeLineCoordinates(
  coordinates: number[],
  context: { xRange?: [number, number]; yRange?: [number, number] },
): [number, number, number, number] {
  if (coordinates.length >= 4) {
    const [x0, y0, x1, y1] = coordinates;
    return [x0, y0, x1, y1];
  }
  if (coordinates.length === 1) {
    const x = coordinates[0]!;
    const [yMin, yMax] = context.yRange ?? [-6, 6];
    return [x, yMin, x, yMax];
  }
  if (coordinates.length === 2) {
    const [y, axis] = coordinates;
    const [xMin, xMax] = context.xRange ?? [-6, 6];
    if (axis === 0) {
      return [xMin, y, xMax, y];
    }
  }
  return [0, -6, 0, 6];
}

function normalizeLine3D(coordinates: number[]): [number[], number[]] | null {
  if (coordinates.length >= 6) {
    const start = coordinates.slice(0, 3) as number[];
    const end = coordinates.slice(3, 6) as number[];
    return [start, end];
  }
  return null;
}

function linspace([start, end]: [number, number], resolution: number): number[] {
  if (resolution <= 1) {
    return [start];
  }
  const step = (end - start) / (resolution - 1);
  return Array.from({ length: resolution }, (_value, index) => start + index * step);
}

function normalizeDomain(domain: [number, number]): [number, number] {
  let [start, end] = domain;
  if (start > end) {
    [start, end] = [end, start];
  }
  if (start === end) {
    return [start - 1, end + 1];
  }
  return [start, end];
}
