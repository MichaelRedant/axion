import Big from "big.js";
import type { BinaryNode, CallNode, Node, SymbolNode, UnaryNode } from "./ast";
import { EvaluationError } from "./errors";
import { isUnitSymbol, unitMapFromSymbol, cloneUnitMap, mergeUnitMaps, unitMapsEqual, formatUnitMap } from "./core/units";

export interface EvaluationOptions {
  readonly env?: Record<string, number>;
  readonly precision?: number;
}

export interface ComplexResult {
  readonly real: number;
  readonly imaginary: number;
}

export interface UnitResult {
  readonly magnitude: number;
  readonly unit: string;
}

export type EvaluationOutput = number | ComplexResult | UnitResult;

export function isComplexResult(value: EvaluationOutput): value is ComplexResult {
  return typeof value === "object" && value !== null && "real" in value && "imaginary" in value;
}

export function isUnitResult(value: EvaluationOutput): value is UnitResult {
  return typeof value === "object" && value !== null && "unit" in value;
}

const DEFAULT_ENV: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

const ZERO = new Big(0);

type RealRuntime = {
  readonly kind: "real";
  readonly value: Big;
};

type ComplexRuntime = {
  readonly kind: "complex";
  readonly real: Big;
  readonly imag: Big;
};

type UnitRuntime = {
  readonly kind: "unit";
  readonly value: Big;
  readonly units: Map<string, number>;
};

type RuntimeValue = RealRuntime | ComplexRuntime | UnitRuntime;

export function evaluate(
  node: Node,
  options: EvaluationOptions = {},
): EvaluationOutput {
  const env = { ...DEFAULT_ENV, ...(options.env ?? {}) };
  const precision = options.precision ?? 12;
  Big.DP = precision;

  const result = evaluateNode(node, env);
  return toOutput(result, precision);
}

function evaluateNode(node: Node, env: Record<string, number>): RuntimeValue {
  switch (node.type) {
    case "Number":
      return makeReal(new Big(node.value));
    case "Symbol":
      return evaluateSymbol(node, env);
    case "Unary":
      return evaluateUnary(node, env);
    case "Binary":
      return evaluateBinary(node, env);
    case "Call":
      return evaluateCall(node, env);
    default:
      return assertUnreachable(node);
  }
}

function evaluateSymbol(
  node: SymbolNode,
  env: Record<string, number>,
): RuntimeValue {
  if (node.name in env) {
    return makeReal(new Big(env[node.name]!));
  }
  if (isUnitSymbol(node.name)) {
    return makeUnit(new Big(1), unitMapFromSymbol(node.name));
  }
  throw new EvaluationError(`Onbekende variabele "${node.name}"`, node.start);
}

function evaluateUnary(
  node: UnaryNode,
  env: Record<string, number>,
): RuntimeValue {
  const value = evaluateNode(node.argument, env);
  return node.operator === "-" ? negate(value) : value;
}

function evaluateBinary(
  node: BinaryNode,
  env: Record<string, number>,
): RuntimeValue {
  const left = evaluateNode(node.left, env);
  const right = evaluateNode(node.right, env);

  switch (node.operator) {
    case "+":
      return add(left, right, node);
    case "-":
      return subtract(left, right, node);
    case "*":
      return multiply(left, right, node);
    case "/":
      return divide(left, right, node);
    case "^":
      return power(left, right, node);
    case "=":
      throw new EvaluationError("Kan gelijkheden niet direct evalueren", node.start);
    default:
      throw new EvaluationError(
        `Niet-ondersteunde operator "${node.operator}"`,
        node.start,
      );
  }
}

function evaluateCall(node: CallNode, env: Record<string, number>): RuntimeValue {
  const args = node.args.map((argument) => evaluateNode(argument, env));

  switch (node.callee) {
    case "sin":
      return applyRealMath(node, args, "sin", Math.sin);
    case "cos":
      return applyRealMath(node, args, "cos", Math.cos);
    case "tan":
      return applyRealMath(node, args, "tan", Math.tan);
    case "asin":
      return applyRealMath(node, args, "asin", Math.asin);
    case "acos":
      return applyRealMath(node, args, "acos", Math.acos);
    case "atan":
      return applyRealMath(node, args, "atan", Math.atan);
    case "sinh":
      return applyRealMath(node, args, "sinh", Math.sinh);
    case "cosh":
      return applyRealMath(node, args, "cosh", Math.cosh);
    case "tanh":
      return applyRealMath(node, args, "tanh", Math.tanh);
    case "ln":
      ensureArity(node, args, 1);
      return makeReal(new Big(Math.log(requireReal(args[0]!, node, "ln").toNumber())));
    case "log":
      if (args.length === 1) {
        return makeReal(new Big(Math.log10(requireReal(args[0]!, node, "log").toNumber())));
      }
      if (args.length === 2) {
        const value = requireReal(args[0]!, node, "log");
        const base = requireReal(args[1]!, node, "log");
        return makeReal(new Big(Math.log(value.toNumber()) / Math.log(base.toNumber())));
      }
      throw new EvaluationError(
        `log verwacht 1 of 2 argumenten, kreeg ${args.length}`,
        node.start,
      );
    case "sqrt":
      ensureArity(node, args, 1);
      return sqrtValue(args[0]!, node);
    case "exp":
      return applyRealMath(node, args, "exp", Math.exp);
    case "abs":
      ensureArity(node, args, 1);
      if (isComplexRuntime(args[0]!)) {
        const arg = args[0]! as ComplexRuntime;
        const magnitude = Math.hypot(arg.real.toNumber(), arg.imag.toNumber());
        return makeReal(new Big(magnitude));
      }
      if (isUnitRuntime(args[0]!)) {
        return makeUnit(args[0]!.value.abs(), cloneUnitMap(args[0]!.units));
      }
      return makeReal(args[0]!.value.abs());
    case "fact":
      ensureArity(node, args, 1);
      return makeReal(factorial(requireReal(args[0]!, node, "fact"), node));
    default:
      throw new EvaluationError(
        `Onbekende functie "${node.callee}"`,
        node.start,
      );
  }
}

function ensureArity(
  node: CallNode,
  args: readonly RuntimeValue[],
  expected: number,
) {
  if (args.length !== expected) {
    throw new EvaluationError(
      `${node.callee} verwacht ${expected} argumenten, kreeg ${args.length}`,
      node.start,
    );
  }
}

function applyRealMath(
  node: CallNode,
  args: RuntimeValue[],
  name: string,
  operator: (value: number) => number,
): RuntimeValue {
  ensureArity(node, args, 1);
  const value = requireReal(args[0]!, node, name);
  return makeReal(new Big(operator(value.toNumber())));
}

function sqrtValue(value: RuntimeValue, node: CallNode): RuntimeValue {
  if (isUnitRuntime(value)) {
    throw new EvaluationError("Wortel van eenheden wordt niet ondersteund", node.start);
  }
  if (isComplexRuntime(value)) {
    return complexSqrt(value);
  }
  if (value.value.lt(0)) {
    return complexSqrt(makeComplex(value.value, ZERO));
  }
  return makeReal(new Big(Math.sqrt(value.value.toNumber())));
}

function toOutput(value: RuntimeValue, precision: number): EvaluationOutput {
  if (isUnitRuntime(value)) {
    return {
      magnitude: Number(value.value.toPrecision(precision)),
      unit: formatUnitMap(value.units),
    } satisfies UnitResult;
  }
  if (!isComplexRuntime(value)) {
    return Number(value.value.toPrecision(precision));
  }
  const real = Number(value.real.toPrecision(precision));
  const imaginary = Number(value.imag.toPrecision(precision));
  if (Math.abs(imaginary) < 1e-10) {
    return real;
  }
  return { real, imaginary } satisfies ComplexResult;
}

function makeReal(value: Big): RealRuntime {
  return { kind: "real", value };
}

function makeComplex(real: Big, imag: Big): ComplexRuntime {
  return { kind: "complex", real, imag };
}

function makeUnit(value: Big, units: Map<string, number>): UnitRuntime {
  return { kind: "unit", value, units };
}

function isComplexRuntime(value: RuntimeValue): value is ComplexRuntime {
  return value.kind === "complex";
}

function isUnitRuntime(value: RuntimeValue): value is UnitRuntime {
  return value.kind === "unit";
}

function ensureComplex(value: RuntimeValue): ComplexRuntime {
  if (isComplexRuntime(value)) {
    return value;
  }
  if (isUnitRuntime(value)) {
    throw new EvaluationError("Eenheden kunnen niet worden geïnterpreteerd als complex getal", 0);
  }
  return { kind: "complex", real: value.value, imag: ZERO };
}

function toRealBig(value: RuntimeValue, node: BinaryNode, message: string): Big {
  if (isUnitRuntime(value)) {
    throw new EvaluationError(message, node.start);
  }
  if (isComplexRuntime(value)) {
    if (!value.imag.eq(0)) {
      throw new EvaluationError(message, node.start);
    }
    return value.real;
  }
  return value.value;
}

function add(left: RuntimeValue, right: RuntimeValue, node: BinaryNode): RuntimeValue {
  if (isUnitRuntime(left) || isUnitRuntime(right)) {
    if (isUnitRuntime(left) && isUnitRuntime(right)) {
      if (!unitMapsEqual(left.units, right.units)) {
        throw new EvaluationError("Eenheden komen niet overeen bij optelling", node.start);
      }
      return makeUnit(left.value.plus(right.value), cloneUnitMap(left.units));
    }
    throw new EvaluationError("Kan eenheid niet optellen bij schaal", node.start);
  }
  if (!isComplexRuntime(left) && !isComplexRuntime(right)) {
    return makeReal(left.value.plus(right.value));
  }
  const l = ensureComplex(left);
  const r = ensureComplex(right);
  return makeComplex(l.real.plus(r.real), l.imag.plus(r.imag));
}

function subtract(left: RuntimeValue, right: RuntimeValue, node: BinaryNode): RuntimeValue {
  if (isUnitRuntime(left) || isUnitRuntime(right)) {
    if (isUnitRuntime(left) && isUnitRuntime(right)) {
      if (!unitMapsEqual(left.units, right.units)) {
        throw new EvaluationError("Eenheden komen niet overeen bij aftrekking", node.start);
      }
      return makeUnit(left.value.minus(right.value), cloneUnitMap(left.units));
    }
    throw new EvaluationError("Kan eenheid niet aftrekken van schaal", node.start);
  }
  if (!isComplexRuntime(left) && !isComplexRuntime(right)) {
    return makeReal(left.value.minus(right.value));
  }
  const l = ensureComplex(left);
  const r = ensureComplex(right);
  return makeComplex(l.real.minus(r.real), l.imag.minus(r.imag));
}

function multiply(left: RuntimeValue, right: RuntimeValue, node: BinaryNode): RuntimeValue {
  if (isUnitRuntime(left) && isUnitRuntime(right)) {
    return makeUnit(left.value.times(right.value), mergeUnitMaps(left.units, right.units, 1));
  }
  if (isUnitRuntime(left)) {
    const factor = toRealBig(right, node, "Vermenigvuldiging met eenheid vereist scalair");
    return makeUnit(left.value.times(factor), cloneUnitMap(left.units));
  }
  if (isUnitRuntime(right)) {
    const factor = toRealBig(left, node, "Vermenigvuldiging met eenheid vereist scalair");
    return makeUnit(right.value.times(factor), cloneUnitMap(right.units));
  }
  if (!isComplexRuntime(left) && !isComplexRuntime(right)) {
    return makeReal(left.value.times(right.value));
  }
  const l = ensureComplex(left);
  const r = ensureComplex(right);
  const real = l.real.times(r.real).minus(l.imag.times(r.imag));
  const imag = l.real.times(r.imag).plus(l.imag.times(r.real));
  return makeComplex(real, imag);
}

function divide(left: RuntimeValue, right: RuntimeValue, node: BinaryNode): RuntimeValue {
  if (isUnitRuntime(left) && isUnitRuntime(right)) {
    if (right.value.eq(0)) {
      throw new EvaluationError("Deling door nul", node.right.start);
    }
    return makeUnit(left.value.div(right.value), mergeUnitMaps(left.units, right.units, -1));
  }
  if (isUnitRuntime(left)) {
    const divisor = toRealBig(right, node, "Deling door eenheid vereist scalair");
    if (divisor.eq(0)) {
      throw new EvaluationError("Deling door nul", node.right.start);
    }
    return makeUnit(left.value.div(divisor), cloneUnitMap(left.units));
  }
  if (isUnitRuntime(right)) {
    if (right.value.eq(0)) {
      throw new EvaluationError("Deling door nul", node.right.start);
    }
    const numerator = toRealBig(left, node, "Deling door eenheid vereist scalair");
    const units = mergeUnitMaps(new Map(), right.units, -1);
    return makeUnit(numerator.div(right.value), units);
  }
  const divisor = ensureComplex(right);
  const denom = divisor.real.times(divisor.real).plus(divisor.imag.times(divisor.imag));
  if (denom.eq(0)) {
    throw new EvaluationError("Deling door nul", node.right.start);
  }

  const dividend = ensureComplex(left);
  const realNumerator = dividend.real.times(divisor.real).plus(dividend.imag.times(divisor.imag));
  const imagNumerator = dividend.imag.times(divisor.real).minus(dividend.real.times(divisor.imag));

  const real = realNumerator.div(denom);
  const imag = imagNumerator.div(denom);

  if (!isComplexRuntime(left) && divisor.imag.eq(0)) {
    return makeReal(real);
  }

  return makeComplex(real, imag);
}

function power(left: RuntimeValue, right: RuntimeValue, node: BinaryNode): RuntimeValue {
  if (isComplexRuntime(right)) {
    throw new EvaluationError("Complexe exponenten worden niet ondersteund", node.right.start);
  }

  const exponent = right.value;
  const rounded = exponent.round(0);
  if (rounded.eq(exponent)) {
    return integerPower(left, rounded.toNumber(), node);
  }

  if (isUnitRuntime(left)) {
    throw new EvaluationError("Eenheden ondersteunen enkel gehele exponenten", node.left.start);
  }
  if (isComplexRuntime(left) && !left.imag.eq(0)) {
    throw new EvaluationError("Machtsverheffing met complexe basis vereist geheel exponent", node.left.start);
  }

  const base = isComplexRuntime(left) ? left.real : left.value;
  const result = Math.pow(base.toNumber(), exponent.toNumber());
  if (!Number.isFinite(result)) {
    throw new EvaluationError("Exponent resulteert in ongeldige waarde", node.start);
  }
  return makeReal(new Big(result));
}

function integerPower(value: RuntimeValue, exponent: number, node: BinaryNode): RuntimeValue {
  if (exponent === 0) {
    return makeReal(new Big(1));
  }
  if (exponent < 0) {
    const positive = integerPower(value, -exponent, node);
    return divide(makeReal(new Big(1)), positive, node);
  }

  let result: RuntimeValue = makeReal(new Big(1));
  let base: RuntimeValue = value;
  let powerValue = exponent;

  while (powerValue > 0) {
    if (powerValue % 2 === 1) {
      result = multiply(result, base, node);
    }
    base = multiply(base, base, node);
    powerValue = Math.floor(powerValue / 2);
  }

  return result;
}

function negate(value: RuntimeValue): RuntimeValue {
  if (isComplexRuntime(value)) {
    return makeComplex(value.real.mul(-1), value.imag.mul(-1));
  }
  if (isUnitRuntime(value)) {
    return makeUnit(value.value.mul(-1), cloneUnitMap(value.units));
  }
  return makeReal(value.value.mul(-1));
}

function complexSqrt(value: ComplexRuntime): RuntimeValue {
  const real = value.real.toNumber();
  const imag = value.imag.toNumber();
  const magnitude = Math.sqrt(Math.hypot(real, imag));
  const angle = Math.atan2(imag, real) / 2;
  const sqrtReal = magnitude * Math.cos(angle);
  const sqrtImag = magnitude * Math.sin(angle);
  return makeComplex(new Big(sqrtReal), new Big(sqrtImag));
}

function requireReal(
  value: RuntimeValue,
  node: CallNode,
  name: string,
): Big {
  if (isUnitRuntime(value)) {
    throw new EvaluationError(`${name} ondersteunt geen argumenten met eenheden`, node.start);
  }
  if (isComplexRuntime(value)) {
    if (!value.imag.eq(0)) {
      throw new EvaluationError(`${name} ondersteunt geen complexe argumenten`, node.start);
    }
    return value.real;
  }
  return value.value;
}

function factorial(value: Big, node: CallNode): Big {
  const rounded = value.round(0);
  if (!rounded.eq(value) || value.lt(0)) {
    throw new EvaluationError("fact verwacht een niet-negatief geheel getal", node.start);
  }
  const n = rounded.toNumber();
  if (!Number.isSafeInteger(n)) {
    throw new EvaluationError("fact waarde is te groot", node.start);
  }
  let result = new Big(1);
  for (let index = 2; index <= n; index += 1) {
    result = result.times(index);
  }
  return result;
}

function assertUnreachable(_node: never): never {
  throw new EvaluationError("Onbekend node-type", 0);
}

