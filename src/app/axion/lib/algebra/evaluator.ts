import Big from "big.js";
import type { BinaryNode, CallNode, Node, SymbolNode, UnaryNode } from "./ast";
import { EvaluationError } from "./errors";

export interface EvaluationOptions {
  readonly env?: Record<string, number>;
  readonly precision?: number;
}

const DEFAULT_ENV: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

/**
 * evaluate produces a numeric approximation for a given AST node.
 */
export function evaluate(
  node: Node,
  options: EvaluationOptions = {},
): number {
  const env = { ...DEFAULT_ENV, ...(options.env ?? {}) };
  const precision = options.precision ?? 12;
  Big.DP = precision;

  const result = evaluateNode(node, env);
  return Number(result.toPrecision(precision));
}

type RuntimeValue = Big;

function evaluateNode(node: Node, env: Record<string, number>): RuntimeValue {
  switch (node.type) {
    case "Number":
      return new Big(node.value);
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
    return new Big(env[node.name]!);
  }
  throw new EvaluationError(`Onbekende variabele "${node.name}"`, node.start);
}

function evaluateUnary(
  node: UnaryNode,
  env: Record<string, number>,
): RuntimeValue {
  const value = evaluateNode(node.argument, env);
  return node.operator === "-" ? value.mul(-1) : value;
}

function evaluateBinary(
  node: BinaryNode,
  env: Record<string, number>,
): RuntimeValue {
  const left = evaluateNode(node.left, env);
  const right = evaluateNode(node.right, env);

  switch (node.operator) {
    case "+":
      return left.plus(right);
    case "-":
      return left.minus(right);
    case "*":
      return left.times(right);
    case "/":
      if (right.eq(0)) {
        throw new EvaluationError("Deling door nul", node.right.start);
      }
      return left.div(right);
    case "^":
      return new Big(Math.pow(left.toNumber(), right.toNumber()));
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
      return trig(Math.sin, args, node);
    case "cos":
      return trig(Math.cos, args, node);
    case "tan":
      return trig(Math.tan, args, node);
    case "ln":
      ensureArity(node, args, 1);
      return new Big(Math.log(args[0]!.toNumber()));
    case "log":
      if (args.length === 1) {
        return new Big(Math.log10(args[0]!.toNumber()));
      }
      if (args.length === 2) {
        return new Big(
          Math.log(args[0]!.toNumber()) / Math.log(args[1]!.toNumber()),
        );
      }
      throw new EvaluationError(
        `log verwacht 1 of 2 argumenten, kreeg ${args.length}`,
        node.start,
      );
    case "sqrt":
      ensureArity(node, args, 1);
      if (args[0]!.lt(0)) {
        throw new EvaluationError("Wortel van negatief getal", node.start);
      }
      return new Big(Math.sqrt(args[0]!.toNumber()));
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

function trig(
  operator: (value: number) => number,
  args: RuntimeValue[],
  node: CallNode,
): RuntimeValue {
  ensureArity(node, args, 1);
  return new Big(operator(args[0]!.toNumber()));
}

function assertUnreachable(_node: never): never {
  throw new EvaluationError("Onbekend node-type", 0);
}
