import Big from "big.js";
import {
  cloneNode,
  type BinaryNode,
  type BinaryOperator,
  type Node,
  type NumberNode,
  type SymbolNode,
  type UnaryNode,
} from "./ast";
import { isUnitSymbol } from "./core/units";

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

function binaryNode(
  operator: BinaryOperator,
  left: Node,
  right: Node,
  start?: number,
  end?: number,
): BinaryNode {
  return {
    type: "Binary",
    operator,
    left,
    right,
    start: start ?? left.start,
    end: end ?? right.end,
  };
}

function unaryNode(operator: "-" | "+", argument: Node, start?: number, end?: number): UnaryNode {
  return {
    type: "Unary",
    operator,
    argument,
    start: start ?? argument.start,
    end: end ?? argument.end,
  };
}

function ensureNumber(value: number | Big, reference: Node): NumberNode {
  const bigValue = value instanceof Big ? value : new Big(value);
  return numberNode(bigValue, reference.start, reference.end);
}

function dedupeSpan(nodes: Node[]): { start: number; end: number } {
  const start = Math.min(...nodes.map((node) => node.start));
  const end = Math.max(...nodes.map((node) => node.end));
  return { start, end };
}

export function expand(node: Node): Node {
  switch (node.type) {
    case "Binary": {
      const left = expand(node.left);
      const right = expand(node.right);
      if (node.operator === "*") {
        return simplify(distribute(left, right, node));
      }
      if (node.operator === "^" && isPositiveIntegerNode(right)) {
        return simplify(expandPower(left, Number(right.value), node));
      }
      return {
        ...node,
        left,
        right,
      };
    }
    case "Unary":
      return {
        ...node,
        argument: expand(node.argument),
      };
    case "Call":
      return {
        ...node,
        args: node.args.map(expand),
      };
    default:
      return node;
  }
}

function distribute(left: Node, right: Node, reference: Node): Node {
  if (isAddition(left)) {
    return left.left && left.right
      ? simplify(
          binaryNode(
            "+",
            distribute(left.left, right, reference),
            distribute(left.right, right, reference),
            reference.start,
            reference.end,
          ),
        )
      : simplify(left);
  }
  if (isAddition(right)) {
    return right.left && right.right
      ? simplify(
          binaryNode(
            "+",
            distribute(left, right.left, reference),
            distribute(left, right.right, reference),
            reference.start,
            reference.end,
          ),
        )
      : simplify(right);
  }
  return binaryNode("*", left, right, reference.start, reference.end);
}

function expandPower(base: Node, exponent: number, reference: Node): Node {
  if (exponent <= 1) {
    return cloneNode(base);
  }
  let result = cloneNode(base);
  for (let index = 1; index < exponent; index += 1) {
    result = simplify(distribute(result, base, reference));
  }
  return result;
}

export function factor(node: Node): Node {
  const simplified = simplify(node);
  const variables = collectVariables(simplified);
  const primary = variables.values().next().value ?? null;
  if (!primary) {
    return simplified;
  }
  const polynomial = extractPolynomial(simplified, primary);
  if (!polynomial) {
    return simplified;
  }
  const factored = factorQuadratic(polynomial, primary, simplified);
  return factored ?? simplified;
}

export function rationalSimplify(node: Node): Node {
  const simplified = simplify(node);
  if (!isFraction(simplified)) {
    return simplified;
  }
  const numerator = simplify(simplified.left);
  const denominator = simplify(simplified.right);
  const numeratorCoeff = extractCoefficient(numerator);
  const denominatorCoeff = extractCoefficient(denominator);

  const gcd = gcdBig(numeratorCoeff.coefficient.abs(), denominatorCoeff.coefficient.abs());
  let normalizedNumerator = numeratorCoeff.coefficient.div(gcd);
  let normalizedDenominator = denominatorCoeff.coefficient.div(gcd);

  if (normalizedDenominator.lt(0)) {
    normalizedNumerator = normalizedNumerator.mul(-1);
    normalizedDenominator = normalizedDenominator.mul(-1);
  }

  const newNumerator = rebuildCoefficient(normalizedNumerator, numeratorCoeff.remainder, numerator);
  const newDenominator = rebuildCoefficient(normalizedDenominator, denominatorCoeff.remainder, denominator);

  if (
    normalizedDenominator.eq(1) &&
    isNumberNode(denominatorCoeff.remainder) &&
    denominatorCoeff.remainder.value === "1"
  ) {
    return simplify(newNumerator);
  }

  return simplify(
    binaryNode("/", newNumerator, newDenominator, simplified.start, simplified.end),
  );
}

export function partialFraction(node: Node): Node {
  const simplified = rationalSimplify(node);
  if (!isFraction(simplified)) {
    return simplified;
  }

  const numerator = simplify(simplified.left);
  const denominator = simplify(simplified.right);

  const product = decomposeProduct(denominator);
  if (!product || product.length !== 2) {
    return simplified;
  }

  const linear1 = extractLinearForm(product[0]);
  const linear2 = extractLinearForm(product[1]);
  if (!linear1 || !linear2 || linear1.variable !== linear2.variable) {
    return simplified;
  }

  let numeratorLinear = extractLinearForm(numerator);
  if (!numeratorLinear) {
    if (numerator.type === "Number") {
      numeratorLinear = {
        coefficient: new Big(0),
        constant: new Big(numerator.value),
        variable: linear1.variable,
      };
    } else {
      return simplified;
    }
  }

  if (numeratorLinear.variable === "__constant__") {
    numeratorLinear = {
      ...numeratorLinear,
      variable: linear1.variable,
    };
  }

  if (linear1.variable === "__constant__" || linear2.variable === "__constant__") {
    return simplified;
  }
  const solution = solvePartialFraction(linear1, linear2, numeratorLinear);
  if (!solution) {
    return simplified;
  }

  const { A, B } = solution;

  const term1 = binaryNode(
    "/",
    numberNode(A, simplified.start, simplified.end),
    cloneNode(product[0]),
    simplified.start,
    simplified.end,
  );
  const term2 = binaryNode(
    "/",
    numberNode(B, simplified.start, simplified.end),
    cloneNode(product[1]),
    simplified.start,
    simplified.end,
  );

  return simplify(
    binaryNode(
      "+",
      term1,
      term2,
      simplified.start,
      simplified.end,
    ),
  );
}

function isAddition(node: Node): node is BinaryNode {
  return node.type === "Binary" && (node.operator === "+" || node.operator === "-");
}

function isFraction(node: Node): node is BinaryNode {
  return node.type === "Binary" && node.operator === "/";
}

function isPositiveIntegerNode(node: Node): node is NumberNode {
  if (!isNumberNode(node)) return false;
  const value = Number(node.value);
  return Number.isInteger(value) && value > 0;
}

export function collectVariables(node: Node, into: Set<string> = new Set()): Set<string> {
  switch (node.type) {
    case "Symbol":
      if (!isUnitSymbol(node.name)) {
        into.add(node.name);
      }
      break;
    case "Unary":
      collectVariables(node.argument, into);
      break;
    case "Binary":
      collectVariables(node.left, into);
      collectVariables(node.right, into);
      break;
    case "Call":
      node.args.forEach((arg) => collectVariables(arg, into));
      break;
    default:
      break;
  }
  return into;
}

export type Polynomial = Map<number, Big>;

export function extractPolynomial(node: Node, variable: string): Polynomial | null {
  const coefficients = new Map<number, Big>();
  const success = accumulatePolynomial(node, variable, coefficients, 1);
  return success ? coefficients : null;
}

function accumulatePolynomial(
  node: Node,
  variable: string,
  coefficients: Polynomial,
  scale: number,
): boolean {
  switch (node.type) {
    case "Number": {
      const value = new Big(node.value).times(scale);
      coefficients.set(0, (coefficients.get(0) ?? new Big(0)).plus(value));
      return true;
    }
    case "Symbol": {
      if (node.name !== variable) {
        return false;
      }
      coefficients.set(1, (coefficients.get(1) ?? new Big(0)).plus(scale));
      return true;
    }
    case "Unary": {
      const nextScale = node.operator === "-" ? -scale : scale;
      return accumulatePolynomial(node.argument, variable, coefficients, nextScale);
    }
    case "Binary": {
      if (node.operator === "+") {
        return (
          accumulatePolynomial(node.left, variable, coefficients, scale) &&
          accumulatePolynomial(node.right, variable, coefficients, scale)
        );
      }
      if (node.operator === "-") {
        return (
          accumulatePolynomial(node.left, variable, coefficients, scale) &&
          accumulatePolynomial(node.right, variable, coefficients, -scale)
        );
      }
      if (node.operator === "*") {
        const left = extractScalar(node.left, variable);
        const right = extractScalar(node.right, variable);
        if (!left || !right) {
          return false;
        }
        const degree = left.degree + right.degree;
        const coefficient = left.coefficient.times(right.coefficient).times(scale);
        coefficients.set(degree, (coefficients.get(degree) ?? new Big(0)).plus(coefficient));
        return true;
      }
      if (node.operator === "^") {
        if (node.left.type === "Symbol" && node.left.name === variable && node.right.type === "Number") {
          const exponent = Number(node.right.value);
          if (!Number.isInteger(exponent) || exponent < 0) {
            return false;
          }
          coefficients.set(exponent, (coefficients.get(exponent) ?? new Big(0)).plus(scale));
          return true;
        }
      }
      return false;
    }
    default:
      return false;
  }
}

interface ScalarExtraction {
  readonly coefficient: Big;
  readonly degree: number;
}

function extractScalar(node: Node, variable: string): ScalarExtraction | null {
  if (node.type === "Number") {
    return { coefficient: new Big(node.value), degree: 0 };
  }
  if (node.type === "Symbol") {
    if (node.name !== variable) {
      return null;
    }
    return { coefficient: new Big(1), degree: 1 };
  }
  if (node.type === "Unary") {
    const inner = extractScalar(node.argument, variable);
    if (!inner) {
      return null;
    }
    const sign = node.operator === "-" ? -1 : 1;
    return {
      coefficient: inner.coefficient.times(sign),
      degree: inner.degree,
    };
  }
  if (node.type === "Binary" && node.operator === "*") {
    const left = extractScalar(node.left, variable);
    const right = extractScalar(node.right, variable);
    if (!left || !right) {
      return null;
    }
    return {
      coefficient: left.coefficient.times(right.coefficient),
      degree: left.degree + right.degree,
    };
  }
  if (node.type === "Binary" && node.operator === "^") {
    if (node.left.type === "Symbol" && node.left.name === variable && node.right.type === "Number") {
      const exponent = Number(node.right.value);
      if (!Number.isInteger(exponent) || exponent < 0) {
        return null;
      }
      return {
        coefficient: new Big(1),
        degree: exponent,
      };
    }
  }
  return null;
}

function factorQuadratic(
  polynomial: Polynomial,
  variable: string,
  reference: Node,
): Node | null {
  const a = polynomial.get(2) ?? new Big(0);
  const b = polynomial.get(1) ?? new Big(0);
  const c = polynomial.get(0) ?? new Big(0);
  if (a.eq(0)) {
    return null;
  }
  const discriminant = b.pow(2).minus(a.times(c).times(4));
  if (discriminant.lt(0)) {
    return null;
  }
  const sqrt = sqrtBig(discriminant);
  if (!sqrt) {
    return null;
  }

  const twoA = a.times(2);
  const root1 = b.mul(-1).plus(sqrt).div(twoA);
  const root2 = b.mul(-1).minus(sqrt).div(twoA);

  const factor1 = buildLinearFactor(variable, root1, reference);
  const factor2 = buildLinearFactor(variable, root2, reference);

  const leading = a.eq(1) ? null : numberNode(a, reference.start, reference.end);

  const { start, end } = dedupeSpan([factor1, factor2, reference]);
  const product = binaryNode("*", factor1, factor2, start, end);
  if (!leading) {
    return product;
  }
  return binaryNode("*", leading, product, start, end);
}

function sqrtBig(value: Big): Big | null {
  const numeric = Number(value.toString());
  if (numeric < 0) {
    return null;
  }
  const root = Math.sqrt(numeric);
  if (!Number.isFinite(root)) {
    return null;
  }
  const approximation = new Big(root.toPrecision(12));
  if (approximation.pow(2).minus(value).abs().gt(1e-8)) {
    return null;
  }
  return approximation;
}

function buildLinearFactor(variable: string, constant: Big, reference: Node): Node {
  const symbol: SymbolNode = {
    type: "Symbol",
    name: variable,
    start: reference.start,
    end: reference.end,
  };
  if (constant.eq(0)) {
    return cloneNode(symbol);
  }
  const number = numberNode(constant.mul(-1), reference.start, reference.end);
  return binaryNode("+", symbol, number, reference.start, reference.end);
}

interface CoefficientExtraction {
  readonly coefficient: Big;
  readonly remainder: Node;
}

function extractCoefficient(node: Node): CoefficientExtraction {
  if (node.type === "Number") {
    return { coefficient: new Big(node.value), remainder: ensureNumber(1, node) };
  }
  if (node.type === "Binary" && node.operator === "*") {
    if (isNumberNode(node.left)) {
      return {
        coefficient: new Big(node.left.value),
        remainder: node.right,
      };
    }
    if (isNumberNode(node.right)) {
      return {
        coefficient: new Big(node.right.value),
        remainder: node.left,
      };
    }
  }
  return { coefficient: new Big(1), remainder: node };
}

function rebuildCoefficient(coefficient: Big, remainder: Node, reference: Node): Node {
  if (coefficient.eq(1)) {
    return cloneNode(remainder);
  }
  return binaryNode("*", numberNode(coefficient, reference.start, reference.end), cloneNode(remainder), reference.start, reference.end);
}

function gcdBig(left: Big, right: Big): Big {
  let a = Math.abs(Number(left.toString()));
  let b = Math.abs(Number(right.toString()));
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return new Big(1);
  }
  while (b > 1e-10) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  if (a < 1e-10) {
    return new Big(1);
  }
  return new Big(a.toFixed(10));
}

interface LinearForm {
  readonly coefficient: Big;
  readonly constant: Big;
  readonly variable: string;
}

function extractLinearForm(node: Node): LinearForm | null {
  if (node.type === "Symbol") {
    return {
      coefficient: new Big(1),
      constant: new Big(0),
      variable: node.name,
    };
  }
  if (node.type === "Number") {
    return {
      coefficient: new Big(0),
      constant: new Big(node.value),
      variable: "__constant__",
    };
  }
  if (node.type === "Unary") {
    const inner = extractLinearForm(node.argument);
    if (!inner) {
      return null;
    }
    const sign = node.operator === "-" ? -1 : 1;
    return {
      coefficient: inner.coefficient.times(sign),
      constant: inner.constant.times(sign),
      variable: inner.variable,
    };
  }
  if (node.type === "Binary") {
    if (node.operator === "+") {
      const left = extractLinearForm(node.left);
      const right = extractLinearForm(node.right);
      if (!left || !right || left.variable !== right.variable) {
        return null;
      }
      return {
        coefficient: left.coefficient.plus(right.coefficient),
        constant: left.constant.plus(right.constant),
        variable: left.variable,
      };
    }
    if (node.operator === "-") {
      const left = extractLinearForm(node.left);
      const right = extractLinearForm(node.right);
      if (!left || !right || left.variable !== right.variable) {
        return null;
      }
      return {
        coefficient: left.coefficient.minus(right.coefficient),
        constant: left.constant.minus(right.constant),
        variable: left.variable,
      };
    }
    if (node.operator === "*") {
      if (node.left.type === "Number") {
        const inner = extractLinearForm(node.right);
        if (!inner) {
          return null;
        }
        return {
          coefficient: inner.coefficient.times(new Big(node.left.value)),
          constant: inner.constant.times(new Big(node.left.value)),
          variable: inner.variable,
        };
      }
      if (node.right.type === "Number") {
        const inner = extractLinearForm(node.left);
        if (!inner) {
          return null;
        }
        return {
          coefficient: inner.coefficient.times(new Big(node.right.value)),
          constant: inner.constant.times(new Big(node.right.value)),
          variable: inner.variable,
        };
      }
    }
  }
  return null;
}

function decomposeProduct(node: Node): Node[] | null {
  if (node.type === "Binary" && node.operator === "*") {
    const left = decomposeProduct(node.left);
    const right = decomposeProduct(node.right);
    if (!left || !right) {
      return null;
    }
    return [...left, ...right];
  }
  return [node];
}

function solvePartialFraction(
  left: LinearForm,
  right: LinearForm,
  numerator: LinearForm,
): { A: Big; B: Big } | null {
  if (left.variable !== right.variable || left.variable !== numerator.variable) {
    return null;
  }

  const a1 = left.coefficient;
  const b1 = left.constant;
  const a2 = right.coefficient;
  const b2 = right.constant;

  const matrixDet = a2.times(b1).minus(a1.times(b2));
  if (matrixDet.eq(0)) {
    return null;
  }

  // Solve:
  // A * a2 + B * a1 = numerator.coefficient
  // A * b2 + B * b1 = numerator.constant

  const A = numerator.coefficient.times(b1).minus(numerator.constant.times(a1)).div(matrixDet);
  const B = numerator.constant.times(a2).minus(numerator.coefficient.times(b2)).div(matrixDet);

  return { A, B };
}

