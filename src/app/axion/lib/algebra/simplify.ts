import Big from "big.js";
import type {
  BinaryNode,
  BinaryOperator,
  Node,
  NumberNode,
  SymbolNode,
  UnaryNode,
} from "./ast";

interface LinearTerm {
  readonly symbol: string;
  readonly coefficient: Big;
  readonly start: number;
  readonly end: number;
}

/**
 * Recursively simplifies an AST using a handful of algebraic identities.
 */
export function simplify(node: Node): Node {
  switch (node.type) {
    case "Unary":
      return simplifyUnary(node);
    case "Binary":
      return simplifyBinary(node);
    case "Call":
      return {
        ...node,
        args: node.args.map(simplify),
      };
    default:
      return node;
  }
}

function simplifyUnary(node: UnaryNode): Node {
  const argument = simplify(node.argument);
  if (argument.type === "Number") {
    const value = new Big(argument.value);
    return {
      type: "Number",
      value: node.operator === "-" ? value.mul(-1).toString() : value.toString(),
      start: node.start,
      end: node.end,
    };
  }
  if (node.operator === "+" && argument.type !== "Unary") {
    return argument;
  }
  return {
    ...node,
    argument,
  };
}

function simplifyBinary(node: BinaryNode): Node {
  const left = simplify(node.left);
  const right = simplify(node.right);

  switch (node.operator) {
    case "+":
    case "-":
      return simplifyAddition(node.operator, left, right, node.start, node.end);
    case "*":
      return simplifyMultiplication(left, right, node.start, node.end);
    case "/":
      return simplifyDivision(left, right, node.start, node.end);
    case "^":
      return simplifyPower(left, right, node.start, node.end);
    default:
      return {
        ...node,
        left,
        right,
      };
  }
}

function simplifyAddition(
  operator: BinaryOperator,
  left: Node,
  right: Node,
  start: number,
  end: number,
): Node {
  const terms = flattenAddition(operator, left, right);
  const grouped = new Map<string, Big>();
  const nonLinear: Node[] = [];

  for (const { node: term } of terms) {
    const linear = asLinearTerm(term);
    if (linear) {
      const key = linear.symbol;
      const current = grouped.get(key) ?? new Big(0);
      grouped.set(key, current.plus(linear.coefficient));
    } else {
      nonLinear.push(term);
    }
  }

  const result: Node[] = [];

  const constant = grouped.get("__CONST__");
  if (constant && !constant.eq(0)) {
    result.push(numberNode(constant, start, end));
  }

  grouped.forEach((value, key) => {
    if (key === "__CONST__" || value.eq(0)) {
      return;
    }
    if (key !== "__CONST__") {
      result.push(buildLinearNode(value, key, start, end));
    }
  });

  result.push(...nonLinear);

  if (result.length === 0) {
    return numberNode(new Big(0), start, end);
  }

  let expression = result[0]!;
  for (let index = 1; index < result.length; index += 1) {
    const term = result[index]!;
    expression = {
      type: "Binary",
      operator: "+",
      left: expression,
      right: term,
      start: expression.start,
      end: term.end,
    };
  }
  return expression;
}

function flattenAddition(
  operator: BinaryOperator,
  left: Node,
  right: Node,
): { node: Node; index: number }[] {
  const result: { node: Node; index: number }[] = [];
  let counter = 0;

  const push = (node: Node) => {
    result.push({ node, index: counter++ });
  };

  const walk = (expr: Node) => {
    if (expr.type === "Binary" && (expr.operator === "+" || expr.operator === "-")) {
      walk(expr.left);
      walk(expr.operator === "-" ? negate(expr.right) : expr.right);
    } else {
      push(expr);
    }
  };

  walk(left);
  walk(operator === "-" ? negate(right) : right);
  return result;
}

function negate(node: Node): Node {
  return {
    type: "Unary",
    operator: "-",
    argument: node,
    start: node.start,
    end: node.end,
  };
}

function buildLinearNode(
  coefficient: Big,
  symbol: string,
  start: number,
  end: number,
): Node {
  if (symbol === "__CONST__") {
    return numberNode(coefficient, start, end);
  }

  if (coefficient.eq(1)) {
    const base: SymbolNode = {
      type: "Symbol",
      name: symbol,
      start,
      end,
    };
    return base;
  }

  if (coefficient.eq(-1)) {
    return {
      type: "Unary",
      operator: "-",
      argument: {
        type: "Symbol",
        name: symbol,
        start,
        end,
      },
      start,
      end,
    };
  }

  return {
    type: "Binary",
    operator: "*",
    left: numberNode(coefficient, start, end),
    right: {
      type: "Symbol",
      name: symbol,
      start,
      end,
    },
    start,
    end,
  };
}

function asLinearTerm(node: Node): LinearTerm | null {
  if (node.type === "Number") {
    return {
      symbol: "__CONST__",
      coefficient: new Big(node.value),
      start: node.start,
      end: node.end,
    };
  }

  if (node.type === "Symbol") {
    return {
      symbol: node.name,
      coefficient: new Big(1),
      start: node.start,
      end: node.end,
    };
  }

  if (node.type === "Unary" && node.operator === "-") {
    const inner = asLinearTerm(node.argument);
    if (inner) {
      return {
        ...inner,
        coefficient: inner.coefficient.mul(-1),
      };
    }
  }

  if (node.type === "Binary" && node.operator === "*") {
    if (node.left.type === "Number" && node.right.type === "Symbol") {
      return {
        symbol: node.right.name,
        coefficient: new Big(node.left.value),
        start: node.start,
        end: node.end,
      };
    }
    if (node.right.type === "Number" && node.left.type === "Symbol") {
      return {
        symbol: node.left.name,
        coefficient: new Big(node.right.value),
        start: node.start,
        end: node.end,
      };
    }
  }

  return null;
}

function simplifyMultiplication(left: Node, right: Node, start: number, end: number): Node {
  if (isNumberNode(left) && isNumberNode(right)) {
    return numberNode(
      new Big(left.value).times(new Big(right.value)),
      start,
      end,
    );
  }

  if (isNumberNode(left)) {
    const value = new Big(left.value);
    if (value.eq(1)) {
      return right;
    }
    if (value.eq(0)) {
      return numberNode(new Big(0), start, end);
    }
  }

  if (isNumberNode(right)) {
    const value = new Big(right.value);
    if (value.eq(1)) {
      return left;
    }
    if (value.eq(0)) {
      return numberNode(new Big(0), start, end);
    }
  }

  return {
    type: "Binary",
    operator: "*",
    left,
    right,
    start,
    end,
  };
}

function simplifyDivision(left: Node, right: Node, start: number, end: number): Node {
  if (isNumberNode(left) && isNumberNode(right)) {
    return numberNode(new Big(left.value).div(new Big(right.value)), start, end);
  }

  if (isNumberNode(right) && new Big(right.value).eq(1)) {
    return left;
  }

  return {
    type: "Binary",
    operator: "/",
    left,
    right,
    start,
    end,
  };
}

function simplifyPower(left: Node, right: Node, start: number, end: number): Node {
  if (isNumberNode(right)) {
    const exponent = new Big(right.value);
    if (exponent.eq(1)) {
      return left;
    }
    if (exponent.eq(0)) {
      return numberNode(new Big(1), start, end);
    }
  }

  return {
    type: "Binary",
    operator: "^",
    left,
    right,
    start,
    end,
  };
}

function isNumberNode(node: Node): node is NumberNode {
  return node.type === "Number";
}

function numberNode(value: Big, start: number, end: number): NumberNode {
  return {
    type: "Number",
    value: value.toString(),
    start,
    end,
  };
}
