import Big from "big.js";
import { cloneNode, type BinaryNode, type Node } from "./ast";
import { simplify } from "./simplify";

export interface DerivativeOptions {
  readonly variable: string;
  readonly order?: number;
}

export interface LimitOptions {
  readonly variable: string;
  readonly approaching: number;
  readonly direction?: "left" | "right" | "both";
}

export interface SeriesOptions {
  readonly variable: string;
  readonly order: number;
  readonly around?: number;
}

export function differentiate(node: Node, options: DerivativeOptions): Node {
  const order = options.order ?? 1;
  if (order <= 0) {
    return cloneNode(node);
  }
  let current = cloneNode(node);
  for (let i = 0; i < order; i += 1) {
    current = simplify(derivativeOnce(current, options.variable));
  }
  return current;
}

function derivativeOnce(node: Node, variable: string): Node {
  switch (node.type) {
    case "Number":
      return makeNumber(0, node);
    case "Symbol":
      return makeNumber(node.name === variable ? 1 : 0, node);
    case "Unary":
      if (node.operator === "+") {
        return derivativeOnce(node.argument, variable);
      }
      if (node.operator === "-") {
        return makeUnary("-", derivativeOnce(node.argument, variable), node);
      }
      break;
    case "Binary":
      switch (node.operator) {
        case "+":
          return makeBinary(
            "+",
            derivativeOnce(node.left, variable),
            derivativeOnce(node.right, variable),
            node,
          );
        case "-":
          return makeBinary(
            "-",
            derivativeOnce(node.left, variable),
            derivativeOnce(node.right, variable),
            node,
          );
        case "*": {
          const left = makeBinary(
            "*",
            derivativeOnce(node.left, variable),
            cloneNode(node.right),
            node,
          );
          const right = makeBinary(
            "*",
            cloneNode(node.left),
            derivativeOnce(node.right, variable),
            node,
          );
          return makeBinary("+", left, right, node);
        }
        case "/": {
          const numerator = makeBinary(
            "-",
            makeBinary(
              "*",
              derivativeOnce(node.left, variable),
              cloneNode(node.right),
              node,
            ),
            makeBinary(
              "*",
              cloneNode(node.left),
              derivativeOnce(node.right, variable),
              node,
            ),
            node,
          );
          const denominator = makeBinary(
            "*",
            cloneNode(node.right),
            cloneNode(node.right),
            node,
          );
          return makeBinary("/", numerator, denominator, node);
        }
        case "^":
          if (node.right.type === "Number") {
            const exponent = Number(node.right.value);
            const baseDerivative = derivativeOnce(node.left, variable);
            const newExponent = exponent - 1;
            const powerNode =
              newExponent === 0
                ? makeNumber(1, node)
                : makeBinary("^", cloneNode(node.left), makeNumber(newExponent, node), node);
            return makeBinary(
              "*",
              makeBinary("*", makeNumber(exponent, node), powerNode, node),
              baseDerivative,
              node,
            );
          }
          break;
        default:
          break;
      }
      break;
    case "Call":
      return derivativeCall(node, variable);
    default:
      break;
  }
  return makeNumber(0, node);
}

function derivativeCall(node: Node & { type: "Call" }, variable: string): Node {
  const [arg] = node.args;
  if (!arg) {
    return makeNumber(0, node);
  }
  const inner = derivativeOnce(arg, variable);
  switch (node.callee) {
    case "sin":
      return chainRule(makeCall("cos", [cloneNode(arg)], node), inner, node);
    case "cos":
      return chainRule(makeUnary("-", makeCall("sin", [cloneNode(arg)], node), node), inner, node);
    case "tan":
      return chainRule(
        makeBinary(
          "/",
          makeNumber(1, node),
          makeBinary(
            "^",
            makeCall("cos", [cloneNode(arg)], node),
            makeNumber(2, node),
            node,
          ),
          node,
        ),
        inner,
        node,
      );
    case "exp":
      return chainRule(makeCall("exp", [cloneNode(arg)], node), inner, node);
    case "ln":
      return chainRule(
        makeBinary("/", makeNumber(1, node), cloneNode(arg), node),
        inner,
        node,
      );
    default:
      break;
  }
  return makeNumber(0, node);
}

function chainRule(outer: Node, inner: Node, reference: Node): Node {
  return makeBinary("*", outer, inner, reference);
}

export function integrate(node: Node, variable: string): Node | null {
  switch (node.type) {
    case "Number":
      return makeBinary("*", cloneNode(node), makeSymbol(variable, node), node);
    case "Symbol":
      if (node.name === variable) {
        return makeBinary(
          "/",
          makeBinary("^", cloneNode(node), makeNumber(2, node), node),
          makeNumber(2, node),
          node,
        );
      }
      return makeBinary("*", cloneNode(node), makeSymbol(variable, node), node);
    case "Binary":
      if (node.operator === "+") {
        const left = integrate(node.left, variable);
        const right = integrate(node.right, variable);
        if (left && right) {
          return makeBinary("+", left, right, node);
        }
      }
      if (node.operator === "-") {
        const left = integrate(node.left, variable);
        const right = integrate(node.right, variable);
        if (left && right) {
          return makeBinary("-", left, right, node);
        }
      }
      if (node.operator === "*") {
        if (node.left.type === "Number") {
          const inner = integrate(node.right, variable);
          if (inner) {
            return makeBinary("*", cloneNode(node.left), inner, node);
          }
        }
        if (node.right.type === "Number") {
          const inner = integrate(node.left, variable);
          if (inner) {
            return makeBinary("*", cloneNode(node.right), inner, node);
          }
        }
      }
      if (node.operator === "^" && node.left.type === "Symbol" && node.left.name === variable && node.right.type === "Number") {
        const exponent = Number(node.right.value);
        if (exponent === -1) {
          return makeCall("ln", [makeSymbol(variable, node)], node);
        }
        return makeBinary(
          "/",
          makeBinary(
            "^",
            cloneNode(node.left),
            makeNumber(exponent + 1, node),
            node,
          ),
          makeNumber(exponent + 1, node),
          node,
        );
      }
      if (node.operator === "/" && isNumberOne(node.left)) {
        const arctan = matchArctanIntegrand(node.right, variable);
        if (arctan) {
          return arctan;
        }
      }
      break;
    case "Call": {
      const [arg] = node.args;
      if (!arg) return null;
      if (node.callee === "sin" && arg.type === "Symbol" && arg.name === variable) {
        return makeUnary("-", makeCall("cos", [cloneNode(arg)], node), node);
      }
      if (node.callee === "cos" && arg.type === "Symbol" && arg.name === variable) {
        return makeCall("sin", [cloneNode(arg)], node);
      }
      if (node.callee === "exp" && arg.type === "Symbol" && arg.name === variable) {
        return makeCall("exp", [cloneNode(arg)], node);
      }
      if (node.callee === "ln" && arg.type === "Symbol" && arg.name === variable) {
        return makeBinary(
          "-",
          makeBinary("*", makeSymbol(variable, node), makeCall("ln", [makeSymbol(variable, node)], node), node),
          makeSymbol(variable, node),
          node,
        );
      }
      break;
    }
    default:
      break;
  }
  return null;
}

export function computeLimit(node: Node, options: LimitOptions): number | null {
  const { variable, approaching, direction = "both" } = options;
  let current: Node = cloneNode(node);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const direct = evaluateAtNode(current, variable, approaching);
    if (Number.isFinite(direct)) {
      return direct;
    }

    if (!isFractionNode(current)) {
      break;
    }

    const { left: numerator, right: denominator } = current;
    const numVal = evaluateAtNode(numerator, variable, approaching);
    const denVal = evaluateAtNode(denominator, variable, approaching);

    if (isApproximatelyZero(numVal) && isApproximatelyZero(denVal)) {
      current = simplify(
        makeBinary(
          "/",
          differentiate(numerator, { variable }),
          differentiate(denominator, { variable }),
          current,
        ),
      );
      continue;
    }

    break;
  }

  const samples = sampleAround(current, variable, approaching, direction);
  if (!samples.length) {
    return null;
  }

  const average =
    samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const consistent = samples.every((value) => Math.abs(value - average) < 1e-5);
  return consistent ? average : null;
}

function sampleAround(
  node: Node,
  variable: string,
  approaching: number,
  direction: "left" | "right" | "both",
): number[] {
  const deltas = [1e-4, 1e-5, 1e-6];
  const values: number[] = [];

  const evaluate = (delta: number) => {
    const value = evaluateAtNode(node, variable, approaching + delta);
    if (Number.isFinite(value)) {
      values.push(value);
    }
  };

  if (direction === "left" || direction === "both") {
    deltas.forEach((delta) => evaluate(-delta));
  }
  if (direction === "right" || direction === "both") {
    deltas.forEach((delta) => evaluate(delta));
  }

  return values;
}

function evaluateAtNode(node: Node, variable: string, value: number): number {
  return substituteValue(node, variable, value);
}

function isFractionNode(node: Node): node is BinaryNode {
  return node.type === "Binary" && node.operator === "/";
}

function isApproximatelyZero(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) < 1e-8;
}

export function taylorSeries(node: Node, options: SeriesOptions): Node[] {
  const center = options.around ?? 0;
  const terms: Node[] = [];
  for (let order = 0; order <= options.order; order += 1) {
    const derivative = differentiate(node, { variable: options.variable, order });
    const evaluated = substituteValue(derivative, options.variable, center);
    const factorial = factorialBig(order);
    const coefficient = evaluated / factorial;
    const term = makeBinary(
      "*",
      makeNumber(coefficient, node),
      makeBinary(
        "^",
        makeBinary("-", makeSymbol(options.variable, node), makeNumber(center, node), node),
        makeNumber(order, node),
        node,
      ),
      node,
    );
    terms.push(simplify(term));
  }
  return terms;
}

function substituteValue(node: Node, variable: string, value: number): number {
  switch (node.type) {
    case "Number":
      return Number(node.value);
    case "Symbol":
      return node.name === variable ? value : Number.NaN;
    case "Unary":
      return node.operator === "-"
        ? -substituteValue(node.argument, variable, value)
        : substituteValue(node.argument, variable, value);
    case "Binary": {
      const left = substituteValue(node.left, variable, value);
      const right = substituteValue(node.right, variable, value);
      switch (node.operator) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return left / right;
        case "^":
          return left ** right;
        default:
          return Number.NaN;
      }
    }
    case "Call": {
      const args = node.args.map((arg) => substituteValue(arg, variable, value));
      switch (node.callee) {
        case "sin":
          return Math.sin(args[0]!);
        case "cos":
          return Math.cos(args[0]!);
        case "tan":
          return Math.tan(args[0]!);
        case "exp":
          return Math.exp(args[0]!);
        case "ln":
          return Math.log(args[0]!);
        case "sqrt":
          return Math.sqrt(args[0]!);
        case "arctan":
          return Math.atan(args[0]!);
        default:
          return Number.NaN;
      }
    }
    default:
      return Number.NaN;
  }
}

function factorialBig(n: number): number {
  let result = new Big(1);
  for (let i = 2; i <= n; i += 1) {
    result = result.times(i);
  }
  return Number(result.toString());
}

function isNumberOne(node: Node): boolean {
  return node.type === "Number" && Number(node.value) === 1;
}

function isVariableSquared(node: Node, variable: string): boolean {
  if (node.type === "Binary" && node.operator === "^" && node.left.type === "Symbol" && node.left.name === variable && node.right.type === "Number") {
    return Number(node.right.value) === 2;
  }
  return false;
}

function matchArctanIntegrand(node: Node, variable: string): Node | null {
  if (node.type === "Binary" && node.operator === "+") {
    const { left, right } = node;
    if (isNumberOne(left) && isVariableSquared(right, variable)) {
      return makeCall("arctan", [makeSymbol(variable, node)], node);
    }
    if (isNumberOne(right) && isVariableSquared(left, variable)) {
      return makeCall("arctan", [makeSymbol(variable, node)], node);
    }
  }
  return null;
}

function makeNumber(value: number, reference: Node): Node {
  return {
    type: "Number",
    value: value.toString(),
    start: reference.start,
    end: reference.end,
  };
}

function makeSymbol(name: string, reference: Node): Node {
  return {
    type: "Symbol",
    name,
    start: reference.start,
    end: reference.end,
  };
}

function makeBinary(operator: "+" | "-" | "*" | "/" | "^", left: Node, right: Node, reference: Node): Node {
  return {
    type: "Binary",
    operator,
    left,
    right,
    start: reference.start,
    end: reference.end,
  };
}

function makeUnary(operator: "-" | "+", argument: Node, reference: Node): Node {
  return {
    type: "Unary",
    operator,
    argument,
    start: reference.start,
    end: reference.end,
  };
}

function makeCall(callee: string, args: Node[], reference: Node): Node {
  return {
    type: "Call",
    callee,
    args,
    start: reference.start,
    end: reference.end,
  };
}
