const PUBLIC_ENABLED = (process.env.NEXT_PUBLIC_MAXIMA_ENABLED ?? "").toLowerCase();
const PUBLIC_ENDPOINT = process.env.NEXT_PUBLIC_MAXIMA_ENDPOINT?.trim() ?? "";
const DEFAULT_PROXY_ENDPOINT = "/api/maxima";

function isEnabledFlag(value: string): boolean {
  return value === "true" || value === "1" || value === "yes";
}

export function isMaximaAvailable(): boolean {
  if (PUBLIC_ENDPOINT) {
    return true;
  }
  return isEnabledFlag(PUBLIC_ENABLED);
}

export function getClientMaximaEndpoint(): string | null {
  if (PUBLIC_ENDPOINT) {
    return PUBLIC_ENDPOINT;
  }
  if (isEnabledFlag(PUBLIC_ENABLED)) {
    return DEFAULT_PROXY_ENDPOINT;
  }
  return null;
}

export function getMaximaRequestTimeout(): number {
  const parsed = Number.parseInt(process.env.NEXT_PUBLIC_MAXIMA_TIMEOUT ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
}

export function getServerMaximaEndpoint(): string | null {
  const endpoint = process.env.MAXIMA_ENDPOINT ?? process.env.MAXIMA_URL ?? "";
  const trimmed = endpoint.trim();
  return trimmed ? trimmed : null;
}
