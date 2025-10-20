export interface MaximaSuccessPayload {
  readonly ok: true;
  readonly output: string;
  readonly latex: string | null;
  readonly approx: string | null;
  readonly diagnostics: string[];
  readonly steps?: unknown[];
  readonly metadata?: Record<string, unknown> | null;
}

export interface MaximaErrorPayload {
  readonly ok: false;
  readonly error: string;
  readonly diagnostics: string[];
}

export type MaximaNormalizedPayload = MaximaSuccessPayload | MaximaErrorPayload;

const PROMPT_PATTERN = /^\(%[io]\d+\)\s*/i;

export function stripMaximaPrompts(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(PROMPT_PATTERN, "").replace(/\s+$/, ""));

  let start = 0;
  while (start < lines.length && lines[start].length === 0) {
    start += 1;
  }

  let end = lines.length;
  while (end > start && lines[end - 1].length === 0) {
    end -= 1;
  }

  return lines.slice(start, end).join("\n");
}

export function normalizeMaximaPayload(payload: unknown): MaximaNormalizedPayload {
  if (payload === null || payload === undefined) {
    return { ok: false, error: "Leeg Maxima-antwoord", diagnostics: [] } satisfies MaximaErrorPayload;
  }

  if (typeof payload === "string") {
    return {
      ok: true,
      output: stripMaximaPrompts(payload),
      latex: null,
      approx: null,
      diagnostics: [],
    } satisfies MaximaSuccessPayload;
  }

  if (typeof payload !== "object") {
    return {
      ok: true,
      output: stripMaximaPrompts(String(payload)),
      latex: null,
      approx: null,
      diagnostics: [],
    } satisfies MaximaSuccessPayload;
  }

  const record = payload as Record<string, unknown>;
  const diagnostics = readStringArray(record.diagnostics ?? record.messages);
  const success = inferSuccess(record);

  if (!success) {
    const errorMessage = readString(record.error ?? record.message ?? record.reason) ?? "Onbekende Maxima-fout";
    return {
      ok: false,
      error: errorMessage,
      diagnostics,
    } satisfies MaximaErrorPayload;
  }

  const container = (record.result ?? record.response ?? record.data ?? record) as Record<string, unknown>;
  const output = stripMaximaPrompts(readString(container.output ?? container.raw ?? container.value) ?? "");
  const latex = readString(container.latex ?? container.tex ?? container.katex) ?? null;
  const approx = readString(container.approx ?? container.approximation ?? container.numeric) ?? null;
  const steps = Array.isArray(container.steps) ? container.steps : undefined;
  const metadata = isRecord(container.metadata) ? container.metadata : null;

  return {
    ok: true,
    output,
    latex,
    approx,
    diagnostics,
    steps,
    metadata,
  } satisfies MaximaSuccessPayload;
}

function inferSuccess(record: Record<string, unknown>): boolean {
  if ("ok" in record) {
    return Boolean(record.ok);
  }
  if ("success" in record) {
    return Boolean(record.success);
  }
  if ("status" in record) {
    const status = String(record.status).toLowerCase();
    return status === "ok" || status === "success" || status === "200";
  }
  if ("error" in record || "message" in record || "reason" in record) {
    return false;
  }
  return true;
}

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => readString(item))
    .filter((item): item is string => item !== null && item.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
