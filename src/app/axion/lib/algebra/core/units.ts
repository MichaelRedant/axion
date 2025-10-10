const BASE_UNITS = new Set([
  "m",
  "s",
  "kg",
  "A",
  "K",
  "mol",
  "cd",
]);

export type UnitMap = Map<string, number>;

export function isUnitSymbol(name: string): boolean {
  return BASE_UNITS.has(name);
}

export function unitMapFromSymbol(symbol: string): UnitMap {
  const map: UnitMap = new Map();
  map.set(symbol, 1);
  return map;
}

export function cloneUnitMap(source: UnitMap): UnitMap {
  return new Map(source);
}

export function mergeUnitMaps(
  left: UnitMap,
  right: UnitMap,
  factor: 1 | -1,
): UnitMap {
  const result = cloneUnitMap(left);
  for (const [unit, exponent] of right) {
    const next = (result.get(unit) ?? 0) + factor * exponent;
    if (Math.abs(next) < 1e-12) {
      result.delete(unit);
    } else {
      result.set(unit, next);
    }
  }
  return result;
}

export function unitMapsEqual(left: UnitMap, right: UnitMap): boolean {
  if (left.size !== right.size) return false;
  for (const [unit, exponent] of left) {
    if ((right.get(unit) ?? null) !== exponent) {
      return false;
    }
  }
  return true;
}

export function formatUnitMap(units: UnitMap): string {
  if (units.size === 0) {
    return "";
  }
  const entries = [...units.entries()].sort(([a], [b]) => a.localeCompare(b));
  return entries
    .map(([unit, exponent]) => {
      if (exponent === 1) {
        return unit;
      }
      return `${unit}^{${formatExponent(exponent)}}`;
    })
    .join("\\cdot ");
}

function formatExponent(exponent: number): string {
  if (Number.isInteger(exponent)) {
    return exponent.toString();
  }
  return exponent.toFixed(3).replace(/\.?0+$/, "");
}
