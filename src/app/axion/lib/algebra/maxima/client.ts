import { getClientMaximaEndpoint, getMaximaRequestTimeout } from "./config";
import {
  normalizeMaximaPayload,
  stripMaximaPrompts,
  type MaximaNormalizedPayload,
} from "./parser";

export type MaximaEvaluation = MaximaNormalizedPayload;

export interface MaximaClientEvaluateOptions {
  readonly format?: "plain" | "tex";
}

export interface MaximaClientOptions {
  readonly endpoint: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export interface MaximaTransport {
  evaluate(expression: string, options?: MaximaClientEvaluateOptions): Promise<MaximaEvaluation>;
}

export class MaximaClient implements MaximaTransport {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeout: number;

  constructor(options: MaximaClientOptions) {
    if (!options.endpoint) {
      throw new Error("Maxima endpoint is vereist");
    }
    this.endpoint = options.endpoint;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeout = options.timeoutMs ?? getMaximaRequestTimeout();
  }

  async evaluate(expression: string, options?: MaximaClientEvaluateOptions): Promise<MaximaEvaluation> {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.timeout) : null;

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression, format: options?.format ?? "plain" }),
        signal: controller?.signal,
      });

      const bodyText = await response.text();
      const parsed = tryParseJson(bodyText);

      if (!response.ok) {
        const normalized = normalizeMaximaPayload(parsed ?? bodyText);
        if (!normalized.ok) {
          return normalized;
        }
        return {
          ok: false,
          error: `Maxima antwoord ${response.status}`,
          diagnostics: normalized.diagnostics,
        };
      }

      return normalizeMaximaPayload(parsed ?? bodyText);
    } catch (error) {
      if (isAbortError(error)) {
        return { ok: false, error: "Maxima-aanvraag verlopen", diagnostics: [] };
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Onbekende Maxima-fout",
        diagnostics: [],
      };
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}

export function createMaximaClient(options?: {
  readonly endpoint?: string | null;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}): MaximaClient | null {
  const endpoint = options?.endpoint ?? getClientMaximaEndpoint();
  if (!endpoint) {
    return null;
  }

  return new MaximaClient({
    endpoint,
    fetchImpl: options?.fetchImpl,
    timeoutMs: options?.timeoutMs,
  });
}

export function formatMaximaPlaintext(value: string): string {
  return stripMaximaPrompts(value);
}

function tryParseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (error as { name?: string }).name === "AbortError";
}
