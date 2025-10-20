import type { PlotConfig } from "../algebra/solution";
import { buildPlot } from "../../components/plots/builders";
import type { NotebookCell } from "./types";

export async function exportNotebookToMarkdown(cells: NotebookCell[]) {
  const lines: string[] = [];
  lines.push("# Axion Notebook Export");
  lines.push("");

  for (const [index, cell] of cells.entries()) {
    const heading = `## Cell ${index + 1}`;
    lines.push(heading);
    lines.push("");
    lines.push(`**Input:** \`${cell.input}\``);
    lines.push("");

    if (cell.output?.type === "success") {
      const { evaluation } = cell.output;
      lines.push("**Exact:**");
      lines.push("");
      lines.push(renderLatexBlock(evaluation.exact));
      lines.push("");
      if (evaluation.approx) {
        lines.push(`**Approx:** ${evaluation.approx}`);
        lines.push("");
      }

      if (evaluation.solution.steps?.length) {
        lines.push("**Steps:**");
        lines.push("");
        for (const step of evaluation.solution.steps) {
          lines.push(`- **${step.title}**: ${step.description}`);
          if (step.latex) {
            lines.push(renderLatexBlock(step.latex));
          }
          if (step.expression) {
            lines.push(renderLatexInline(step.expression));
          }
        }
        lines.push("");
      }

      if (evaluation.solution.followUps?.length) {
        lines.push("**Explain references:**");
        lines.push("");
        for (const followUp of evaluation.solution.followUps) {
          const description = followUp.description ? ` — ${followUp.description}` : "";
          lines.push(`- ${followUp.label}${description}`);
        }
        lines.push("");
      }

      if (evaluation.solution.plotConfig) {
        const image = await renderPlotImage(evaluation.solution.plotConfig);
        if (image) {
          lines.push("![Plot](" + image + ")");
          lines.push("");
        }
      }
    } else if (cell.output?.type === "error") {
      lines.push(`**Error:** ${cell.output.error.message}`);
      lines.push("");
    } else {
      lines.push("**Status:** Pending evaluation");
      lines.push("");
    }
  }

  const markdown = lines.join("\n");
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `axion-notebook-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function renderLatexBlock(expression: string): string {
  return `$$\n${expression}\n$$`;
}

function renderLatexInline(expression: string): string {
  return `$${expression}$`;
}

async function renderPlotImage(config: PlotConfig): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const build = buildPlot(config);
  if (!build) {
    return null;
  }

  const plotlyModule = (await import("plotly.js-dist-min")) as any;
  const Plotly = plotlyModule.default ?? plotlyModule;
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = "720px";
  container.style.height = `${build.height}px`;
  document.body.appendChild(container);

  try {
    await Plotly.newPlot(container, build.data, { ...build.layout, width: 720, height: build.height }, {
      staticPlot: true,
      displayModeBar: false,
      responsive: false,
    });
    const url = await Plotly.toImage(container, {
      format: "png",
      width: 720,
      height: build.height,
    });
    return url;
  } catch (error) {
    console.warn("Failed to export plot", error);
    return null;
  } finally {
    if (typeof Plotly.purge === "function") {
      Plotly.purge(container);
    }
    container.remove();
  }
}
