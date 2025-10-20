import type { AnnotationMap, ExpressionDomain } from "./core/types";

/**
 * AST node definitions for Axion's algebra engine.
 * Each node carries source span information for precise diagnostics.
 */
export type Node =
  | NumberNode
  | SymbolNode
  | UnaryNode
  | BinaryNode
  | CallNode;

export type BinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "^"
  | "="
  | "->"
  | "<"
  | ">"
  | "<="
  | ">=";
export type UnaryOperator = "+" | "-";

export interface BaseNode {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly domain?: ExpressionDomain;
  readonly annotations?: AnnotationMap;
}

export interface NumberNode extends BaseNode {
  readonly type: "Number";
  readonly value: string;
}

export interface SymbolNode extends BaseNode {
  readonly type: "Symbol";
  readonly name: string;
}

export interface UnaryNode extends BaseNode {
  readonly type: "Unary";
  readonly operator: UnaryOperator;
  readonly argument: Node;
}

export interface BinaryNode extends BaseNode {
  readonly type: "Binary";
  readonly operator: BinaryOperator;
  readonly left: Node;
  readonly right: Node;
}

export interface CallNode extends BaseNode {
  readonly type: "Call";
  readonly callee: string;
  readonly args: readonly Node[];
}

export type LiteralNode = NumberNode | SymbolNode;

export function cloneNode<T extends Node>(node: T): T {
  return structuredClone(node);
}

export const Operators = {
  isBinary(op: string): op is BinaryOperator {
    return ["+", "-", "*", "/", "^", "="].includes(op);
  },
  isUnary(op: string): op is UnaryOperator {
    return ["+", "-"].includes(op);
  },
};
