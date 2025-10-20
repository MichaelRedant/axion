import { type BinaryOperator, type Node } from "../ast";
import { AxionError, EvaluationError } from "../errors";
import {
  addMatrices,
  determinant,
  eigenDecomposition,
  formatMatrix,
  formatScalar,
  formatVector,
  gaussianElimination,
  inverse as invertMatrix,
  matrixToLatex,
  multiplyMatrices,
  parseMatrixNode,
  parseVectorNode,
  rank as rankOfMatrix,
  reducedRowEchelon,
  singularValueDecomposition,
  solveLinearSystem,
  type Matrix,
} from "../matrix";
import type { PlotAnnotation, PlotConfig, SolutionBundle, SolutionStep } from "../solution";
import type {
  ProblemStrategy,
  StrategyContext,
  StrategyDescriptor,
  StrategyResult,
} from "./base";

const SUPPORTED_OPERATIONS = new Set([
  "matadd",
  "matmul",
  "det",
  "rank",
  "inv",
  "inverse",
  "eigen",
  "eig",
  "svd",
  "solvesystem",
]);

export const MATRIX_STRATEGY_DESCRIPTOR: StrategyDescriptor = {
  id: "strategy.matrix",
  handles: ["matrix"],
  priority: 550,
};

export class MatrixStrategy implements ProblemStrategy {
  readonly descriptor = MATRIX_STRATEGY_DESCRIPTOR;

  matches(context: StrategyContext): boolean {
    if (context.ast.type !== "Call") {
      return false;
    }
    return SUPPORTED_OPERATIONS.has(context.ast.callee.toLowerCase());
  }

  solve(context: StrategyContext): StrategyResult | null {
    if (context.ast.type !== "Call") {
      return null;
    }

    const callee = context.ast.callee.toLowerCase();

    try {
      switch (callee) {
        case "matadd":
          return this.solveAddition(context);
        case "matmul":
          return this.solveMultiplication(context);
        case "det":
          return this.solveDeterminant(context);
        case "rank":
          return this.solveRank(context);
        case "inv":
        case "inverse":
          return this.solveInverse(context);
        case "eigen":
        case "eig":
          return this.solveEigen(context);
        case "svd":
          return this.solveSvd(context);
        case "solvesystem":
          return this.solveLinearSystemCall(context);
        default:
          return null;
      }
    } catch (error) {
      if (error instanceof AxionError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new EvaluationError(error.message, context.ast.start);
      }
      throw new EvaluationError("Onbekende matrixfout", context.ast.start);
    }
  }

  private solveAddition(context: StrategyContext): StrategyResult {
    const [left, right] = this.getMatrices(context, 2, "matAdd");
    if (left.rows !== right.rows || left.cols !== right.cols) {
      throw new EvaluationError("matAdd vereist matrices met gelijke dimensies", context.ast.start);
    }

    const result = addMatrices(left.matrix, right.matrix);
    const steps: SolutionStep[] = [
      {
        id: "dims",
        title: "Dimensiecontrole",
        description: `Beide matrices hebben dimensie ${left.rows}x${left.cols}.`,
      },
      {
        id: "sum",
        title: "Elementgewijze som",
        description: "Tel elk element van A op bij het corresponderende element van B.",
        latex: formatMatrix(result),
      },
    ];

    return this.buildSolution(context, formatMatrix(result), steps, {
      details: { dimensie: `${left.rows}x${left.cols}` },
    });
  }

  private solveMultiplication(context: StrategyContext): StrategyResult {
    const [left, right] = this.getMatrices(context, 2, "matMul");
    if (left.cols !== right.rows) {
      throw new EvaluationError(
        "matMul vereist compatibele dimensies (kolommen van A gelijk aan rijen van B)",
        context.ast.start,
      );
    }

    const product = multiplyMatrices(left.matrix, right.matrix);
    const steps: SolutionStep[] = [
      {
        id: "dims",
        title: "Dimensiecontrole",
        description: `A heeft ${left.rows}x${left.cols}, B heeft ${right.rows}x${right.cols}.`,
      },
      {
        id: "product",
        title: "Matrixproduct",
        description: "Bereken het product door rijen van A met kolommen van B te vermenigvuldigen.",
        latex: formatMatrix(product),
      },
    ];

    return this.buildSolution(context, formatMatrix(product), steps, {
      details: { dimensies: `${left.rows}x${left.cols} x ${right.rows}x${right.cols}` },
    });
  }

  private solveDeterminant(context: StrategyContext): StrategyResult {
    const [target] = this.getMatrices(context, 1, "det");
    if (target.rows !== target.cols) {
      throw new EvaluationError("det vereist een vierkante matrix", context.ast.start);
    }

    const triangular = triangularize(target.matrix);
    const diagProduct = triangular.matrix.reduce((acc, row, index) => acc * row[index]!, 1);
    const determinantValue = triangular.swaps % 2 === 0 ? diagProduct : -diagProduct;

    const steps: SolutionStep[] = [
      {
        id: "start",
        title: "Startmatrix",
        description: "Begin met matrix A.",
        latex: formatMatrix(target.matrix),
      },
      ...triangular.snapshots.slice(1).map((snapshot, index) => ({
        id: `tri-${index + 1}`,
        title: `Kolom ${index + 1}`,
        description: triangular.notes[index] ?? "Voer rijoperaties uit.",
        latex: formatMatrix(snapshot),
      })),
      {
        id: "product",
        title: "Diagonaalproduct",
        description: "Neem het product van de diagonaalelementen en corrigeer voor ruilingen.",
        latex: `\\det\\left(${formatMatrix(target.matrix)}\\right) = ${formatScalar(determinantValue)}`,
      },
    ];

    return this.buildSolution(context, `\\det\\left(${formatMatrix(target.matrix)}\\right) = ${formatScalar(determinantValue)}`, steps, {
      approx: formatScalar(determinantValue),
      approxValue: determinantValue,
      details: { swaps: triangular.swaps },
    });
  }

  private solveRank(context: StrategyContext): StrategyResult {
    const [target] = this.getMatrices(context, 1, "rank");
    const reduction = reducedRowEchelon(target.matrix);
    const rankValue = rankOfMatrix(target.matrix);

    const steps: SolutionStep[] = [
      {
        id: "start",
        title: "Startmatrix",
        description: "Begin met matrix A.",
        latex: formatMatrix(target.matrix),
      },
      {
        id: "rref",
        title: "Rijen-echelonvorm",
        description: "Voer Gauss-Jordan eliminatie uit tot rijen-echelonvorm.",
        latex: matrixToLatex(reduction.matrix),
      },
      {
        id: "count",
        title: "Niet-nullo rijen",
        description: `Het aantal niet-nullo rijen is ${rankValue}.`,
      },
    ];

    return this.buildSolution(context, `\\operatorname{rank}\\left(${formatMatrix(target.matrix)}\\right) = ${rankValue}`, steps, {
      approx: formatScalar(rankValue),
      approxValue: rankValue,
    });
  }

  private solveInverse(context: StrategyContext): StrategyResult {
    const [target] = this.getMatrices(context, 1, "inverse");
    if (target.rows !== target.cols) {
      throw new EvaluationError("inverse vereist een vierkante matrix", context.ast.start);
    }

    const size = target.rows;
    const augmented = target.matrix.map((row, index) => [
      ...row,
      ...identityMatrix(size)[index]!,
    ]);

    const elimination = gaussianElimination(augmented, true);
    const finalSnapshot = elimination.snapshots.at(-1) ?? augmented;
    const inverseMatrix = invertMatrix(target.matrix);

    const steps: SolutionStep[] = [
      {
        id: "augment",
        title: "Augmenteer met identiteit",
        description: "Vorm de geaugmenteerde matrix [A | I].",
        latex: matrixToLatex(augmented, true),
      },
      {
        id: "eliminate",
        title: "Elimineer",
        description: "Pas rijoperaties toe tot links de identiteit verschijnt.",
        latex: matrixToLatex(finalSnapshot, true),
      },
      {
        id: "extract",
        title: "Lees inverse af",
        description: "De rechterblok bevat A^{-1}.",
        latex: formatMatrix(inverseMatrix),
      },
    ];

    return this.buildSolution(context, `A^{-1} = ${formatMatrix(inverseMatrix)}`, steps, {
      details: { dimensie: `${size}x${size}` },
    });
  }

  private solveEigen(context: StrategyContext): StrategyResult {
    const [target] = this.getMatrices(context, 1, "eigen");
    if (target.rows !== target.cols) {
      throw new EvaluationError("eigen vereist een vierkante matrix", context.ast.start);
    }

    const { eigenvalues, eigenvectors } = eigenDecomposition(target.matrix);
    const formattedValues = eigenvalues.map(formatScalar);

    const steps: SolutionStep[] = [
      {
        id: "iter",
        title: "QR-iteraties",
        description: "Diagonaliseer A via QR-iteraties om eigenwaarden af te lezen.",
      },
      {
        id: "vectors",
        title: "Eigenvectoren",
        description: "Kolommen van Q leveren eigenvectoren.",
        latex: formatMatrix(eigenvectors),
      },
    ];

    const plotConfig = buildEigenPlotConfig(eigenvectors, eigenvalues);

    return this.buildSolution(context, `\\lambda = \\{${formattedValues.join(", ")}\\}`, steps, {
      details: { eigenwaarden: formattedValues },
      plotConfig,
    });
  }

  private solveSvd(context: StrategyContext): StrategyResult {
    const [target] = this.getMatrices(context, 1, "svd");
    const { singularValues, U, V } = singularValueDecomposition(target.matrix);
    const formatted = singularValues.map(formatScalar);

    const steps: SolutionStep[] = [
      {
        id: "normal",
        title: "Diagonaliseer A^\\top A",
        description: "De eigenwaarden van A^\\top A leveren de kwadraten van de singular values.",
      },
      {
        id: "assemble",
        title: "Assembleer SVD",
        description: "Bouw U en V op uit de eigenvectoren en vorm Sigma.",
        latex: `U = ${formatMatrix(U)},\\quad V = ${formatMatrix(V)}`,
      },
    ];

    const plotConfig = buildSvdSurfacePlot(singularValues);

    const exact = `\\sigma = \\{${formatted.join(", ")}\\}`;
    return this.buildSolution(context, exact, steps, {
      details: { singularValues: formatted },
      plotConfig,
    });
  }

  private solveLinearSystemCall(context: StrategyContext): StrategyResult {
    if (context.ast.type !== "Call") {
      throw new EvaluationError("solveSystem verwacht een functieaanroep", context.ast.start);
    }
    const [matrixNode, vectorNode] = context.ast.args;
    if (!matrixNode || !vectorNode) {
      throw new EvaluationError("solveSystem verwacht twee argumenten", context.ast.start);
    }

    const matrix = parseMatrixNode(matrixNode);
    const vector = parseVectorNode(vectorNode);
    const system = solveLinearSystem(matrix.matrix, vector);

    const augmentedMatrices = matrix.matrix.map((row, index) => [...row, vector[index]!]);
    const augmentedStart = system.augmentedLatex[0] ?? matrixToLatex(augmentedMatrices, true);
    const augmentedFinal = system.augmentedLatex.at(-1) ?? augmentedStart;
    const assignments = system.solution.map((value, index) => `x_{${index + 1}} = ${formatScalar(value)}`);
    const solutionVector = formatVector(system.solution);

    const steps: SolutionStep[] = [
      {
        id: "augment",
        title: "Augmenteer",
        description: "Vorm de geaugmenteerde matrix [A | b].",
        latex: augmentedStart,
      },
      {
        id: "eliminate",
        title: "Gauss-Jordan eliminatie",
        description:
          system.steps.length
            ? system.steps.join(", ")
            : "Voer Gauss-Jordan eliminatie uit om links de identiteit te bekomen.",
        latex: augmentedFinal,
      },
      {
        id: "solution",
        title: "Lees oplossing",
        description: assignments.join(" ; "),
        latex: solutionVector,
      },
    ];

    const plotConfig = buildSolveSystemPlot(matrix.matrix, vector, system.solution);

    return this.buildSolution(context, `\\vec{x} = ${solutionVector}`, steps, {
      details: {
        operaties: system.steps,
        variabelen: assignments,
      },
      plotConfig,
    });
  }

  private getMatrices(context: StrategyContext, count: number, name: string) {
    if (context.ast.type !== "Call") {
      throw new EvaluationError(`${name} verwacht een functieaanroep`, context.ast.start);
    }
    if (context.ast.args.length < count) {
      throw new EvaluationError(`${name} verwacht ${count} argumenten`, context.ast.start);
    }
    return context.ast.args.slice(0, count).map((node) => parseMatrixNode(node));
  }

  private buildSolution(
    context: StrategyContext,
    exact: string,
    steps: SolutionStep[],
    options: {
      approx?: string | null;
      approxValue?: number | null;
      details?: Record<string, unknown>;
      plotConfig?: PlotConfig | null;
    } = {},
  ): StrategyResult {
    const bundle: SolutionBundle = {
      type: context.descriptor.type,
      descriptor: context.descriptor,
      exact,
      approx: options.approx ?? null,
      approxValue: options.approxValue ?? null,
      steps,
      plotConfig: options.plotConfig ?? null,
      followUps: [],
      details: options.details,
    };
    return { solution: bundle };
  }
}

function identityMatrix(size: number): Matrix {
  return Array.from({ length: size }, (_row, index) =>
    Array.from({ length: size }, (_col, column) => (index === column ? 1 : 0)),
  );
}

interface Triangularisation {
  readonly matrix: Matrix;
  readonly swaps: number;
  readonly snapshots: Matrix[];
  readonly notes: string[];
}

function triangularize(input: Matrix): Triangularisation {
  const matrix = input.map((row) => [...row]);
  const size = matrix.length;
  const snapshots: Matrix[] = [matrix.map((row) => [...row])];
  const notes: string[] = [];
  let swaps = 0;

  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(matrix[row]![col]!) > Math.abs(matrix[pivot]![col]!)) {
        pivot = row;
      }
    }

    const operations: string[] = [];

    if (pivot !== col) {
      [matrix[pivot], matrix[col]] = [matrix[col]!, matrix[pivot]!];
      swaps += 1;
      operations.push(`R_${col + 1} \\leftrightarrow R_${pivot + 1}`);
    }

    const pivotValue = matrix[col]![col]!;
    if (Math.abs(pivotValue) < 1e-10) {
      snapshots.push(matrix.map((row) => [...row]));
      notes.push(operations.join(", ") || `Pivot in kolom ${col + 1}`);
      continue;
    }

    for (let row = col + 1; row < size; row += 1) {
      const factor = matrix[row]![col]! / pivotValue;
      if (Math.abs(factor) < 1e-10) {
        continue;
      }
      for (let k = col; k < size; k += 1) {
        matrix[row]![k] -= factor * matrix[col]![k]!;
      }
      operations.push(`R_${row + 1} \\leftarrow R_${row + 1} - ${formatScalar(factor)} R_${col + 1}`);
    }

    snapshots.push(matrix.map((row) => [...row]));
    notes.push(operations.join(", ") || `Pivot in kolom ${col + 1}`);
  }

  return { matrix, swaps, snapshots, notes };
}

function buildEigenPlotConfig(matrix: Matrix, eigenvalues: number[]): PlotConfig | null {
  if (!matrix.length || matrix[0]?.length === 0) {
    return null;
  }

  const dimension = matrix.length;
  if (dimension < 2) {
    return null;
  }

  const vector = matrix.map((row) => row[0] ?? 0);
  const parameter = "t";

  const xExpression = createLinearExpression(vector[0] ?? 0, parameter);
  const yExpression = createLinearExpression(vector[1] ?? 0, parameter);

  const config: PlotConfig = {
    type: "parametric",
    parameter,
    range: [-2, 2],
    samples: 120,
    xExpression,
    yExpression,
    label: `Eigenvector ?=${formatScalar(eigenvalues[0] ?? 0)}`,
    axes: {
      x: { label: "x" },
      y: { label: "y" },
    },
    annotations: [
      {
        type: "point",
        coordinates: [0, 0],
        label: "Oorsprong",
      },
    ],
  };

  return config;
}

function buildSvdSurfacePlot(singularValues: number[]): PlotConfig | null {
  if (singularValues.length < 2) {
    return null;
  }

  const [sigma1, sigma2] = singularValues;
  const xSquared = createPowerExpression("x", 2);
  const ySquared = createPowerExpression("y", 2);
  const expression = addNodes(
    scaleNode(sigma1, xSquared),
    scaleNode(sigma2, ySquared),
  );

  const config: PlotConfig = {
    type: "surface",
    expression,
    variables: ["x", "y", "z"],
    xRange: [-2, 2],
    yRange: [-2, 2],
    resolution: 40,
    label: "S(x, y)",
    axes: {
      x: { label: "x" },
      y: { label: "y" },
      z: { label: "z" },
    },
  };

  return config;
}

function buildSolveSystemPlot(matrix: Matrix, vector: number[], solution: number[]): PlotConfig | null {
  const cols = matrix[0]?.length ?? 0;
  if (cols !== 2) {
    return null;
  }

  const variables: [string, string] = ["x", "y"];
  let expression: Node | null = null;

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const equation = createLinearCombinationNode(matrix[rowIndex] ?? [], variables, vector[rowIndex] ?? 0);
    const squared = squareNode(equation);
    expression = expression ? addNodes(expression, squared) : squared;
  }

  if (!expression) {
    return null;
  }

  const annotations: PlotAnnotation[] = [];
  if (solution.length >= 2 && solution.every((value) => Number.isFinite(value))) {
    annotations.push({
      type: "point",
      coordinates: [solution[0]!, solution[1]!],
      label: "Oplossing",
    });
  }

  const config: PlotConfig = {
    type: "implicit",
    expression,
    variables,
    xRange: [-6, 6],
    yRange: [-6, 6],
    resolution: 80,
    label: "Ax = b",
    annotations,
  };
  return config;
}

function numberNode(value: number): Node {
  return {
    type: "Number",
    value: formatScalar(value),
    start: 0,
    end: 0,
  };
}

function symbolNode(name: string): Node {
  return {
    type: "Symbol",
    name,
    start: 0,
    end: 0,
  };
}

function binaryNode(operator: BinaryOperator, left: Node, right: Node): Node {
  return {
    type: "Binary",
    operator,
    left,
    right,
    start: left.start ?? 0,
    end: right.end ?? 0,
  };
}

function approxZero(value: number): boolean {
  return Math.abs(value) < 1e-9;
}

function createLinearExpression(coefficient: number, variable: string): Node {
  if (approxZero(coefficient)) {
    return numberNode(0);
  }
  if (approxZero(coefficient - 1)) {
    return symbolNode(variable);
  }
  if (approxZero(coefficient + 1)) {
    return binaryNode("*", numberNode(-1), symbolNode(variable));
  }
  return binaryNode("*", numberNode(coefficient), symbolNode(variable));
}

function createPowerExpression(variable: string, exponent: number): Node {
  return binaryNode("^", symbolNode(variable), numberNode(exponent));
}

function scaleNode(factor: number, node: Node): Node {
  if (approxZero(factor)) {
    return numberNode(0);
  }
  if (approxZero(factor - 1)) {
    return node;
  }
  return binaryNode("*", numberNode(factor), node);
}

function addNodes(left: Node, right: Node): Node {
  if (left.type === "Number" && approxZero(Number(left.value))) {
    return right;
  }
  if (right.type === "Number" && approxZero(Number(right.value))) {
    return left;
  }
  return binaryNode("+", left, right);
}

function squareNode(node: Node): Node {
  return binaryNode("^", node, numberNode(2));
}

function createLinearCombinationNode(coefficients: number[], variables: [string, string], constant: number): Node {
  const [xVar, yVar] = variables;
  const termX = scaleNode(coefficients[0] ?? 0, symbolNode(xVar));
  const termY = scaleNode(coefficients[1] ?? 0, symbolNode(yVar));
  const left = addNodes(termX, termY);
  return binaryNode("-", left, numberNode(constant));
}

