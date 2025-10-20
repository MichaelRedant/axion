"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { PlotConfig } from "../../lib/algebra/solution";
import { buildPlot } from "./builders";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as unknown as typeof import("react-plotly.js").default;

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
