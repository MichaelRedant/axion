"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { evaluate, isComplexResult, isUnitResult } from "../../lib/algebra/evaluator";
import type { Node } from "../../lib/algebra/ast";
import type { PlotConfig, CartesianPlotConfig, ParametricPlotConfig, ImplicitPlotConfig, SurfacePlotConfig, PlotAnnotation } from "../../lib/algebra/solution";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const Line = dynamic(() => import("react-chartjs-2").then((mod) => mod.Line), { ssr: false });
const PlotlyComponent = dynamic(
  () => import("react-plotly.js").then((mod) => mod.default),
  { ssr: false },
) as unknown as typeof import("react-plotly.js").default;

interface PlotPanelProps {
  readonly config: PlotConfig;
}

export function PlotPanel({ config }: PlotPanelProps) {
  switch (config.type) {
    case "cartesian":
      return <CartesianPlot config={config} />;
    case "parametric":
      return <ParametricPlot config={config} />;
    case "implicit":
      return <ImplicitPlot config={config} />;
    case "surface":
      return <SurfacePlot config={config} />;
    default:
      return null;
  }
}

function CartesianPlot({ config }: { readonly config: CartesianPlotConfig }) {
  const data = useMemo(
    () => sampleCartesian(config.expression, config.variable, config.domain, config.samples),
    [config.expression, config.variable, config.domain, config.samples],
  );

  if (!data.points.length) {
    return null;
  }

  const annotationDataset = buildAnnotationDataset(config.annotations);
  const datasets = [
    {
      label: config.label ?? config.axes?.y?.label ?? `f(${config.variable})`,
      data: data.points.map((point) => point.y),
      fill: false,
      borderColor: "#00fff2",
      backgroundColor: "rgba(0,255,242,0.35)",
      tension: 0.2,
      pointRadius: 0,
    },
    ...(annotationDataset ? [annotationDataset] : []),
  ];

  return (
    <div className="rounded-lg border border-[rgba(0,255,242,0.2)] bg-black/50 p-4">
      <Line
        data={{
          labels: data.points.map((point) => point.x.toFixed(2)),
          datasets,
        }}
        options={{
          responsive: true,
          plugins: {
            legend: { labels: { color: "#f5f7fa" } },
            title: config.label
              ? {
                  display: true,
                  text: config.label,
                  color: "#f5f7fa",
                  font: { weight: "bold" },
                }
              : undefined,
          },
          scales: {
            x: {
              ticks: { color: "#9ca3af" },
              grid: { color: "rgba(255,255,255,0.1)" },
              title: config.axes?.x?.label
                ? { display: true, text: config.axes.x.label, color: "#f5f7fa" }
                : undefined,
            },
            y: {
              ticks: { color: "#9ca3af" },
              grid: { color: "rgba(255,255,255,0.1)" },
              title: config.axes?.y?.label
                ? { display: true, text: config.axes.y.label, color: "#f5f7fa" }
                : undefined,
            },
          },
        }}
      />
    </div>
  );
}

function ParametricPlot({ config }: { readonly config: ParametricPlotConfig }) {
  const data = useMemo(
    () => sampleParametric(config),
    [config.parameter, config.range, config.samples, config.xExpression, config.yExpression],
  );

  if (!data.points.length) {
    return null;
  }

  const datasets = [
    {
      label: config.label ?? "Parametrisch pad",
      data: data.points,
      borderColor: "#00fff2",
      backgroundColor: "rgba(0,255,242,0.35)",
      showLine: true,
      pointRadius: 0,
      parsing: false,
    },
  ];

  const pointDataset = buildAnnotationDataset(config.annotations, true);
  if (pointDataset) {
    datasets.push({ ...pointDataset, parsing: false });
  }

  return (
    <div className="rounded-lg border border-[rgba(0,255,242,0.2)] bg-black/50 p-4">
      <Line
        data={{ datasets }}
        options={{
          responsive: true,
          parsing: false,
          plugins: {
            legend: { labels: { color: "#f5f7fa" } },
            title: config.label
              ? {
                  display: true,
                  text: config.label,
                  color: "#f5f7fa",
                  font: { weight: "bold" },
                }
              : undefined,
          },
          scales: {
            x: {
              type: "linear",
              ticks: { color: "#9ca3af" },
              grid: { color: "rgba(255,255,255,0.1)" },
              title: config.axes?.x?.label
                ? { display: true, text: config.axes.x.label, color: "#f5f7fa" }
                : undefined,
            },
            y: {
              type: "linear",
              ticks: { color: "#9ca3af" },
              grid: { color: "rgba(255,255,255,0.1)" },
              title: config.axes?.y?.label
                ? { display: true, text: config.axes.y.label, color: "#f5f7fa" }
                : undefined,
            },
          },
        }}
      />
    </div>
  );
}

function ImplicitPlot({ config }: { readonly config: ImplicitPlotConfig }) {
  const { grid, annotations } = useMemo(
    () => sampleImplicit(config),
    [config.expression, config.variables, config.xRange, config.yRange, config.resolution],
  );

  if (!grid.z.length) {
    return null;
  }

  const data = [
    {
      type: "contour",
      x: grid.x,
      y: grid.y,
      z: grid.z,
      contours: { coloring: "lines", showlabels: true },
      colorscale: "Electric",
      showscale: false,
    },
    ...annotations,
  ];

  return (
    <div className="rounded-lg border border-[rgba(0,255,242,0.2)] bg-black/50 p-4">
      <PlotlyComponent
        data={data}
        layout={{
          autosize: true,
          margin: { l: 40, r: 20, b: 40, t: config.label ? 40 : 20 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: "#f5f7fa" },
          title: config.label ?? "",
          xaxis: {
            title: config.axes?.x?.label ?? config.variables[0],
            range: [config.xRange[0], config.xRange[1]],
          },
          yaxis: {
            title: config.axes?.y?.label ?? config.variables[1],
            range: [config.yRange[0], config.yRange[1]],
          },
        }}
        config={{ responsive: true, displaylogo: false }}
        style={{ width: "100%", height: "360px" }}
      />
    </div>
  );
}

function SurfacePlot({ config }: { readonly config: SurfacePlotConfig }) {
  const { surface, annotations } = useMemo(
    () => sampleSurface(config),
    [config.expression, config.variables, config.xRange, config.yRange, config.resolution],
  );

  if (!surface.z.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[rgba(0,255,242,0.2)] bg-black/50 p-4">
      <PlotlyComponent
        data={[
          {
            type: "surface",
            x: surface.x,
            y: surface.y,
            z: surface.z,
            colorscale: "Electric",
            showscale: false,
          },
          ...annotations,
        ]}
        layout={{
          autosize: true,
          margin: { l: 20, r: 20, b: 20, t: config.label ? 40 : 20 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          scene: {
            xaxis: { title: config.axes?.x?.label ?? config.variables[0] },
            yaxis: { title: config.axes?.y?.label ?? config.variables[1] },
            zaxis: { title: config.axes?.z?.label ?? config.variables[2] },
          },
          title: config.label ?? "",
          font: { color: "#f5f7fa" },
        }}
        config={{ responsive: true, displaylogo: false }}
        style={{ width: "100%", height: "420px" }}
      />
    </div>
  );
}

function sampleCartesian(expression: Node, variable: string, domain: [number, number], samples: number) {
  const points: { x: number; y: number }[] = [];
  const [start, end] = domain;
  const step = (end - start) / samples;

  for (let index = 0; index <= samples; index += 1) {
    const x = start + index * step;
    const y = evaluateReal(expression, { [variable]: x });
    if (typeof y === "number" && Number.isFinite(y)) {
      points.push({ x, y });
    }
  }

  return { points };
}

function sampleParametric(config: ParametricPlotConfig) {
  const points: { x: number; y: number }[] = [];
  const [start, end] = config.range;
  const step = (end - start) / config.samples;

  for (let index = 0; index <= config.samples; index += 1) {
    const t = start + index * step;
    const env = { [config.parameter]: t };
    const x = evaluateReal(config.xExpression, env);
    const y = evaluateReal(config.yExpression, env);
    if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y });
    }
  }

  return { points };
}

function sampleImplicit(config: ImplicitPlotConfig) {
  const xValues = linspace(config.xRange, config.resolution);
  const yValues = linspace(config.yRange, config.resolution);
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

  const annotationTraces = buildPlotlyAnnotations(config.annotations, 2);
  return { grid: { x: xValues, y: yValues, z }, annotations: annotationTraces };
}

function sampleSurface(config: SurfacePlotConfig) {
  const xValues = linspace(config.xRange, config.resolution);
  const yValues = linspace(config.yRange, config.resolution);
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

  const annotationTraces = buildPlotlyAnnotations(config.annotations, 3);
  return { surface: { x: xValues, y: yValues, z }, annotations: annotationTraces };
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

function linspace([start, end]: [number, number], resolution: number): number[] {
  if (resolution <= 1) {
    return [start];
  }
  const step = (end - start) / (resolution - 1);
  return Array.from({ length: resolution }, (_value, index) => start + index * step);
}

function buildAnnotationDataset(annotations: PlotAnnotation[] | undefined, useObjects = false) {
  if (!annotations?.length) {
    return null;
  }
  const points = annotations.filter((annotation) => annotation.type === "point" && annotation.coordinates.length >= 2);
  if (!points.length) {
    return null;
  }
  if (useObjects) {
    return {
      label: "Annotaties",
      data: points.map((point) => ({ x: point.coordinates[0], y: point.coordinates[1] })),
      borderColor: "#fbbf24",
      backgroundColor: "#fbbf24",
      pointRadius: 4,
      pointHoverRadius: 6,
      showLine: false,
    };
  }
  return {
    label: "Annotaties",
    data: points.map((point) => point.coordinates[1]),
    borderColor: "#fbbf24",
    backgroundColor: "#fbbf24",
    pointRadius: 4,
    pointHoverRadius: 6,
    showLine: false,
  };
}

function buildPlotlyAnnotations(annotations: PlotAnnotation[] | undefined, dimensions: number) {
  if (!annotations?.length) {
    return [];
  }

  const points = annotations.filter((annotation) => annotation.type === "point" && annotation.coordinates.length >= dimensions);
  if (!points.length) {
    return [];
  }

  if (dimensions === 2) {
    return [
      {
        type: "scatter",
        mode: "markers+text",
        x: points.map((point) => point.coordinates[0]),
        y: points.map((point) => point.coordinates[1]),
        text: points.map((point) => point.label ?? ""),
        textposition: "top center",
        marker: { color: "#fbbf24", size: 6 },
        name: "Annotaties",
      },
    ];
  }

  return [
    {
      type: "scatter3d",
      mode: "markers+text",
      x: points.map((point) => point.coordinates[0]),
      y: points.map((point) => point.coordinates[1]),
      z: points.map((point) => point.coordinates[2]),
      text: points.map((point) => point.label ?? ""),
      textposition: "top center",
      marker: { color: "#fbbf24", size: 4 },
      name: "Annotaties",
    },
  ];
}

