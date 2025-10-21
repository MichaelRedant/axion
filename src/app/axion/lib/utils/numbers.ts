export function formatDecimal(value: number, precision = 8): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  const fixed = value.toFixed(precision);
  const withoutTrailingZeros = fixed.replace(/(\.\d*?[1-9])0+$/, "$1");
  const trimmed = withoutTrailingZeros.replace(/\.0+$/, "");
  return trimmed === "-0" ? "0" : trimmed;
}

const FRACTION_PATTERN = /^\s*(-)?\\(?:d)?frac\{([^{}]+)\}\{([^{}]+)\}\s*$/;

function sanitizeNumericSegment(segment: string): string | null {
  let normalized = segment
    .replace(/\\left|\\right/g, "")
    .replace(/\\[,!;:]/g, "")
    .replace(/\s+/g, "")
    .trim();

  while (normalized.startsWith("(") && normalized.endsWith(")")) {
    normalized = normalized.slice(1, -1).trim();
  }

  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function parseNumericLatex(segment: string): number | null {
  const sanitized = sanitizeNumericSegment(segment);
  if (!sanitized) {
    return null;
  }

  if (!/^[-+]?\d+(?:\.\d+)?$/.test(sanitized)) {
    return null;
  }

  const value = Number(sanitized);
  return Number.isFinite(value) ? value : null;
}

function stripLatexWrappers(latex: string): string {
  let result = latex.replace(/\\left|\\right/g, "").trim();

  while (result.startsWith("(") && result.endsWith(")")) {
    result = result.slice(1, -1).trim();
  }

  return result;
}

export function tryConvertLatexFractionToDecimal(
  latex: string,
  options?: { precision?: number },
): string | null {
  const precision = options?.precision ?? 8;
  const stripped = stripLatexWrappers(latex);
  const match = FRACTION_PATTERN.exec(stripped);
  if (!match) {
    return null;
  }

  const [, signToken, numeratorToken, denominatorToken] = match;
  const numerator = parseNumericLatex(numeratorToken);
  const denominator = parseNumericLatex(denominatorToken);

  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }

  const sign = signToken === "-" ? -1 : 1;
  const value = (sign * numerator) / denominator;
  return formatDecimal(value, precision);
}
