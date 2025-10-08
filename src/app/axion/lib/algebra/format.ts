import type { BinaryNode, Node, UnaryNode } from "./ast";

const BINARY_PRECEDENCE: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "^": 3,
};

/**
 * Converts an AST node into a KaTeX-compatible string.
 */
export function toKaTeX(node: Node, parentPrecedence = 0): string {
  switch (node.type) {
    case "Number":
      return formatNumber(node.value);
    case "Symbol":
      return `\\mathrm{${node.name}}`;
    case "Unary":
      return formatUnary(node, parentPrecedence);
    case "Binary":
      return formatBinary(node, parentPrecedence);
    case "Call":
      return formatCall(node);
    default:
      return "";
  }
}

function formatNumber(value: string): string {
  if (value.includes(".")) {
    const [whole, fraction] = value.split(".");
    return `${whole}.{${fraction}}`;
  }
  return value;
}

function formatUnary(node: UnaryNode, parentPrecedence: number): string {
  const arg = toKaTeX(node.argument, 4);
  const expression = node.operator === "-" ? `-${arg}` : arg;
  return parentPrecedence > 3 ? `\\left(${expression}\\right)` : expression;
}

function formatBinary(node: BinaryNode, parentPrecedence: number): string {
  const precedence = BINARY_PRECEDENCE[node.operator];
  const left = toKaTeX(node.left, precedence);
  const right = toKaTeX(node.right, precedence);

  let expression: string;

  switch (node.operator) {
    case "+":
      expression = `${left} + ${right}`;
      break;
    case "-":
      expression = `${left} - ${right}`;
      break;
    case "*":
      expression = `${left} \\cdot ${right}`;
      break;
    case "/":
      expression = `\\frac{${toKaTeX(node.left)}}{${toKaTeX(node.right)}}`;
      break;
    case "^":
      expression = `${toKaTeX(node.left, precedence)}^{${toKaTeX(node.right, precedence)}}`;
      break;
    default:
      expression = `${left} ${node.operator} ${right}`;
  }

  return precedence < parentPrecedence
    ? `\\left(${expression}\\right)`
    : expression;
}

function formatCall(node: Extract<Node, { type: "Call" }>): string {
  if (node.callee === "sqrt" && node.args.length === 1) {
    return `\\sqrt{${toKaTeX(node.args[0]!)}}`;
  }

  if (node.callee === "log" && node.args.length === 2) {
    const [value, base] = node.args;
    return `\\log_{${toKaTeX(base!)}}\\left(${toKaTeX(value!)}\\right)`;
  }

  const callee = formatCallee(node.callee);
  const args = node.args.map((arg) => toKaTeX(arg)).join(",\\;");
  return `${callee}\\left(${args}\\right)`;
}

function formatCallee(name: string): string {
  switch (name) {
    case "sin":
    case "cos":
    case "tan":
    case "log":
    case "ln":
      return `\\${name}`;
    case "sqrt":
      return "\\sqrt";
    default:
      return `\\operatorname{${name}}`;
  }
}
