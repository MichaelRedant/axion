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
import type { PlotConfig } from "../../lib/algebra/solution";
import { evaluate, isComplexResult, isUnitResult } from "../../lib/algebra/evaluator";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const Line = dynamic(() => import("react-chartjs-2").then((mod) => mod.Line), {
  ssr: false,
});

interface FunctionPlotProps {
  readonly config: PlotConfig;
}

export function FunctionPlot({ config }: FunctionPlotProps) {
  const { variable, domain, samples, expression, label } = config;
  const data = useMemo(() => sampleFunction(expression, variable, domain, samples), [expression, variable, domain, samples]);

  if (!data.points.length) {
    return null;
  }

  const chartData = {
    labels: data.points.map((point) => point.x.toFixed(2)),
    datasets: [
      {
        label: label ?? `f(${variable})`,
        data: data.points.map((point) => point.y),
        fill: false,
        borderColor: "#00fff2",
        backgroundColor: "rgba(0,255,242,0.35)",
        tension: 0.2,
        pointRadius: 0,
      },
    ],
  };

  return (
    <div className="rounded-lg border border-[rgba(0,255,242,0.2)] bg-black/50 p-4">
      <Line
        data={chartData}
        options={{
          responsive: true,
          plugins: {
            legend: {
              labels: {
                color: "#f5f7fa",
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: "#9ca3af",
              },
              grid: {
                color: "rgba(255,255,255,0.1)",
              },
            },
            y: {
              ticks: {
                color: "#9ca3af",
              },
              grid: {
                color: "rgba(255,255,255,0.1)",
              },
            },
          },
        }}
      />
    </div>
  );
}

function sampleFunction(expression: PlotConfig["expression"], variable: string, domain: [number, number], samples: number) {
  const points: { x: number; y: number }[] = [];
  const [start, end] = domain;
  const step = (end - start) / samples;

  for (let index = 0; index <= samples; index += 1) {
    const x = start + index * step;
    try {
      const evaluation = evaluate(expression, { env: { [variable]: x }, precision: 10 });
      const y =
        isComplexResult(evaluation)
          ? Math.abs(evaluation.imaginary) < 1e-9
            ? evaluation.real
            : null
          : evaluation;
      if (typeof y === "number" && Number.isFinite(y)) {
        points.push({ x, y });
      }
    } catch {
      // ignore sample failures
    }
  }

  return { points };
}
