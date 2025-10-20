import { evaluate } from "./evaluator";
import type { CallNode, Node } from "./ast";
import { EvaluationError } from "./errors";

export type Matrix = number[][];
export type Vector = number[];

const EPSILON = 1e-10;
const MAX_ITERATIONS = 128;

export interface MatrixParseResult {
  readonly matrix: Matrix;
  readonly rows: number;
  readonly cols: number;
}

export function parseMatrixNode(node: Node): MatrixParseResult {
  if (node.type !== "Call") {
    throw new EvaluationError("matrix verwacht een functieaanroep", node.start);
  }

  const callee = node.callee.toLowerCase();
  if (callee !== "matrix" && callee !== "mat") {
    throw new EvaluationError("matrixfunctie verwacht syntax matrix(...)", node.start);
  }

  if (!node.args.length) {
    throw new EvaluationError("matrix vereist minstens één rij", node.start);
  }

  // Pattern: matrix(row(...), row(...))
  const rowCalls = node.args.filter(
    (arg): arg is CallNode => arg.type === "Call" && arg.callee.toLowerCase() === "row",
  );

  if (rowCalls.length === node.args.length) {
    const rows = rowCalls.map(parseRowCall);
    const width = rows[0]?.length ?? 0;
    if (!rows.every((row) => row.length === width)) {
      throw new EvaluationError("matrix verwacht rijen met gelijke lengte", node.start);
    }
    return {
      matrix: rows,
      rows: rows.length,
      cols: width,
    };
  }

  // Pattern: matrix(rows, cols, ...)
  if (node.args[0]?.type === "Number" && node.args[1]?.type === "Number") {
    const rows = Number(node.args[0].value);
    const cols = Number(node.args[1].value);
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
      throw new EvaluationError("matrix(rows, cols, ...) vereist positieve gehele dimensies", node.start);
    }
    const expected = rows * cols;
    const values = node.args.slice(2);
    if (values.length !== expected) {
      throw new EvaluationError(`matrix verwacht ${expected} elementen`, node.start);
    }

    const data: Matrix = [];
    for (let r = 0; r < rows; r += 1) {
      const row: number[] = [];
      for (let c = 0; c < cols; c += 1) {
        const index = r * cols + c;
        row.push(evaluateToNumber(values[index]!));
      }
      data.push(row);
    }
    return { matrix: data, rows, cols };
  }

  throw new EvaluationError("matrix verwacht row(...) argumenten of matrix(rows, cols, ...)", node.start);
}

export function parseVectorNode(node: Node): Vector {
  if (node.type === "Call") {
    const callee = node.callee.toLowerCase();
    if (callee === "vector" || callee === "vec" || callee === "column") {
      return node.args.map(evaluateToNumber);
    }
    if (callee === "row") {
      return node.args.map(evaluateToNumber);
    }
  }
  throw new EvaluationError("vector verwacht een aanroep vector(...)", node.start);
}

function parseRowCall(node: CallNode): number[] {
  return node.args.map(evaluateToNumber);
}

function evaluateToNumber(node: Node): number {
  const value = evaluate(node);
  if (typeof value !== "number") {
    throw new EvaluationError("matrix ondersteunt enkel reële waarden", node.start);
  }
  if (!Number.isFinite(value)) {
    throw new EvaluationError("matrix bevat een niet-finite waarde", node.start);
  }
  return value;
}

export function addMatrices(a: Matrix, b: Matrix): Matrix {
  ensureSameShape(a, b, "matrixsom");
  return a.map((row, rowIndex) =>
    row.map((value, colIndex) => value + b[rowIndex]![colIndex]!),
  );
}

export function subtractMatrices(a: Matrix, b: Matrix): Matrix {
  ensureSameShape(a, b, "matrixverschil");
  return a.map((row, rowIndex) =>
    row.map((value, colIndex) => value - b[rowIndex]![colIndex]!),
  );
}

export function multiplyMatrices(a: Matrix, b: Matrix): Matrix {
  if (!a.length || !b.length) {
    throw new Error("matrixproduct vereist niet-lege matrices");
  }
  if (a[0]!.length !== b.length) {
    throw new Error("matrixproduct vereist overeenkomende dimensies");
  }
  const rows = a.length;
  const cols = b[0]!.length;
  const inner = b.length;
  const result: Matrix = createZeroMatrix(rows, cols);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let sum = 0;
      for (let k = 0; k < inner; k += 1) {
        sum += a[r]![k]! * b[k]![c]!;
      }
      result[r]![c] = sum;
    }
  }
  return result;
}

export function transpose(matrix: Matrix): Matrix {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const result: Matrix = createZeroMatrix(cols, rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      result[c]![r] = matrix[r]![c]!;
    }
  }
  return result;
}

export function determinant(matrix: Matrix): number {
  ensureSquare(matrix, "determinant");
  const { copy, swaps } = toUpperTriangular(matrix);
  const det = copy.reduce((acc, row, index) => acc * row[index]!, 1);
  const result = swaps % 2 === 0 ? det : -det;
  return Math.abs(result) < EPSILON ? 0 : result;
}

export function rank(matrix: Matrix): number {
  const { copy } = toRowEchelon(matrix);
  let rankValue = 0;
  for (const row of copy) {
    if (row.some((value) => Math.abs(value) > EPSILON)) {
      rankValue += 1;
    }
  }
  return rankValue;
}

export function inverse(matrix: Matrix): Matrix {
  ensureSquare(matrix, "inverse");
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [
    ...row,
    ...identityMatrix(size)[index]!,
  ]);

  const { matrix: reduced } = gaussianElimination(augmented);
  const result: Matrix = [];
  for (let r = 0; r < size; r += 1) {
    const row = reduced[r]!;
    const left = row.slice(0, size);
    const right = row.slice(size);
    if (!approximatelyIdentity(left[r]!, 1)) {
      throw new Error("matrix is singulier en heeft geen inverse");
    }
    result.push(right);
  }
  return result;
}

export interface EigenDecomposition {
  readonly eigenvalues: number[];
  readonly eigenvectors: Matrix;
}

export function eigenDecomposition(matrix: Matrix): EigenDecomposition {
  ensureSquare(matrix, "eigenwaarden");
  let current = matrix.map((row) => [...row]);
  let eigenvectors = identityMatrix(matrix.length);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const { q, r } = qrDecomposition(current);
    current = multiplyMatrices(r, q);
    eigenvectors = multiplyMatrices(eigenvectors, q);
    if (offDiagonalNorm(current) < 1e-8) {
      break;
    }
  }

  const eigenvalues = current.map((row, index) => row[index]!);
  return { eigenvalues, eigenvectors };
}

export interface SingularValueDecomposition {
  readonly singularValues: number[];
  readonly U: Matrix;
  readonly V: Matrix;
}

export function singularValueDecomposition(matrix: Matrix): SingularValueDecomposition {
  const at = transpose(matrix);
  const normal = multiplyMatrices(at, matrix);
  const { eigenvalues, eigenvectors } = eigenDecomposition(normal);

  const pairs = eigenvalues.map((value, index) => ({
    value: Math.max(0, value),
    vector: eigenvectors.map((row) => row[index]!),
  }));

  pairs.sort((a, b) => b.value - a.value);

  const singularValues = pairs.map((pair) => Math.sqrt(pair.value));
  const V = buildMatrixFromColumns(pairs.map((pair) => pair.vector));
  const uColumns: number[][] = [];

  for (let i = 0; i < singularValues.length; i += 1) {
    const sigma = singularValues[i]!;
    if (Math.abs(sigma) < EPSILON) {
      uColumns.push(createZeroVector(matrix.length));
      continue;
    }
    const v = pairs[i]!.vector;
    const Av = multiplyMatrixVector(matrix, v);
    uColumns.push(scaleVector(Av, 1 / sigma));
  }

  return {
    singularValues,
    U: reorthonormaliseColumns(buildMatrixFromColumns(uColumns)),
    V,
  };
}

export interface LinearSolveResult {
  readonly solution: Vector;
  readonly steps: string[];
  readonly augmentedLatex: string[];
}

export function solveLinearSystem(matrix: Matrix, vector: Vector): LinearSolveResult {
  if (matrix.length !== vector.length) {
    throw new Error("A en b moeten compatibel zijn voor Ax = b");
  }
  const augmented = matrix.map((row, index) => [...row, vector[index]!]);
  const { matrix: reduced, operations, snapshots } = reducedRowEchelon(augmented, true);

  const solution: number[] = new Array(matrix[0]!.length).fill(0);
  for (let rowIndex = 0; rowIndex < reduced.length; rowIndex += 1) {
    const row = reduced[rowIndex]!;
    const pivotIndex = row.findIndex((value, colIndex) => colIndex < solution.length && Math.abs(value) > EPSILON);
    if (pivotIndex === -1) {
      if (Math.abs(row[row.length - 1] ?? 0) > EPSILON) {
        throw new Error("Systeem is inconsistent");
      }
      continue;
    }
    solution[pivotIndex] = row[row.length - 1]!;
  }

  return {
    solution,
    steps: operations,
    augmentedLatex: snapshots.map((snapshot) => matrixToLatex(snapshot, true)),
  };
}

export function matrixToLatex(matrix: Matrix, augmented = false): string {
  if (!matrix.length) {
    return "\\begin{bmatrix}\\end{bmatrix}";
  }
  const cols = matrix[0]!.length;
  const spec =
    augmented && cols > 1 ? `${"c".repeat(cols - 1)}|c` : "c".repeat(Math.max(cols, 1));
  const rows = matrix
    .map((row) => {
      if (augmented && row.length > 1) {
        const left = row.slice(0, row.length - 1).map(formatScalar);
        const right = formatScalar(row[row.length - 1]!);
        return [...left, right].join(" & ");
      }
      return row.map(formatScalar).join(" & ");
    })
    .join(" \\\\ ");
  return `\\left[\\begin{array}{${spec}}${rows}\\end{array}\\right]`;
}

export function vectorToLatex(vector: Vector): string {
  return matrixToLatex(vector.map((value) => [value]));
}

export function formatMatrix(matrix: Matrix): string {
  const rows = matrix
    .map((row) => row.map((value) => formatScalar(value)).join(" & "))
    .join(" \\\\ ");
  return `\\begin{bmatrix}${rows}\\end{bmatrix}`;
}

export function formatVector(vector: Vector): string {
  const rows = vector.map((value) => formatScalar(value)).join(" \\\\ ");
  return `\\begin{bmatrix}${rows}\\end{bmatrix}`;
}

function ensureSameShape(a: Matrix, b: Matrix, label: string) {
  if (a.length !== b.length || a[0]?.length !== b[0]?.length) {
    throw new Error(`${label} vereist matrices met gelijke dimensies`);
  }
}

function ensureSquare(matrix: Matrix, label: string) {
  if (matrix.length === 0 || matrix.length !== (matrix[0]?.length ?? 0)) {
    throw new Error(`${label} vereist een vierkante matrix`);
  }
}

function toUpperTriangular(matrix: Matrix) {
  const copy = matrix.map((row) => [...row]);
  let swaps = 0;
  const size = copy.length;

  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(copy[row]![col]!) > Math.abs(copy[pivot]![col]!)) {
        pivot = row;
      }
    }

    if (Math.abs(copy[pivot]![col]!) < EPSILON) {
      continue;
    }

    if (pivot !== col) {
      [copy[pivot], copy[col]] = [copy[col]!, copy[pivot]!];
      swaps += 1;
    }

    for (let row = col + 1; row < size; row += 1) {
      const factor = copy[row]![col]! / copy[col]![col]!;
      for (let k = col; k < size; k += 1) {
        copy[row]![k] -= factor * copy[col]![k]!;
      }
    }
  }

  return { copy, swaps };
}

function toRowEchelon(matrix: Matrix) {
  const copy = matrix.map((row) => [...row]);
  const rows = copy.length;
  const cols = copy[0]?.length ?? 0;
  let lead = 0;

  for (let r = 0; r < rows; r += 1) {
    if (lead >= cols) {
      break;
    }
    let i = r;
    while (Math.abs(copy[i]![lead]!) < EPSILON) {
      i += 1;
      if (i === rows) {
        i = r;
        lead += 1;
        if (lead === cols) {
          return { copy };
        }
      }
    }
    [copy[i], copy[r]] = [copy[r]!, copy[i]!];
    const pivot = copy[r]![lead]!;
    for (let j = 0; j < cols; j += 1) {
      copy[r]![j] /= pivot;
    }
    for (let ii = 0; ii < rows; ii += 1) {
      if (ii !== r) {
        const factor = copy[ii]![lead]!;
        for (let jj = 0; jj < cols; jj += 1) {
          copy[ii]![jj] -= factor * copy[r]![jj]!;
        }
      }
    }
    lead += 1;
  }

  return { copy };
}

export function gaussianElimination(augmented: Matrix, track = false): { matrix: Matrix; operations: string[]; snapshots: Matrix[] } {
  const copy = augmented.map((row) => [...row]);
  const rows = copy.length;
  const cols = copy[0]?.length ?? 0;
  const operations: string[] = [];
  const snapshots: Matrix[] = track ? [cloneMatrix(copy)] : [];

  for (let col = 0; col < rows; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < rows; row += 1) {
      if (Math.abs(copy[row]![col]!) > Math.abs(copy[pivot]![col]!)) {
        pivot = row;
      }
    }

    if (Math.abs(copy[pivot]![col]!) < EPSILON) {
      throw new Error("matrix is singulier en kan niet geïnverteerd worden");
    }

    if (pivot !== col) {
      [copy[pivot], copy[col]] = [copy[col]!, copy[pivot]!];
      operations.push(`R_${col + 1} \\leftrightarrow R_${pivot + 1}`);
    }

    const pivotValue = copy[col]![col]!;
    if (Math.abs(pivotValue - 1) > EPSILON) {
      for (let j = 0; j < cols; j += 1) {
        copy[col]![j] /= pivotValue;
      }
      operations.push(`R_${col + 1} \\leftarrow \\frac{1}{${formatScalar(pivotValue)}} R_${col + 1}`);
    }

    for (let row = 0; row < rows; row += 1) {
      if (row === col) continue;
      const factor = copy[row]![col]!;
      if (Math.abs(factor) < EPSILON) continue;
      for (let j = 0; j < cols; j += 1) {
        copy[row]![j] -= factor * copy[col]![j]!;
      }
      const sign = factor > 0 ? "-" : "+";
      operations.push(`R_${row + 1} \\leftarrow R_${row + 1} ${sign} ${formatScalar(Math.abs(factor))} R_${col + 1}`);
    }

    if (track) {
      snapshots.push(cloneMatrix(copy));
    }
  }

  return { matrix: copy, operations, snapshots };
}

export function reducedRowEchelon(matrix: Matrix, track = false): { matrix: Matrix; operations: string[]; snapshots: Matrix[] } {
  const copy = matrix.map((row) => [...row]);
  const rows = copy.length;
  const cols = copy[0]?.length ?? 0;
  let lead = 0;
  const operations: string[] = [];
  const snapshots: Matrix[] = track ? [cloneMatrix(copy)] : [];

  for (let r = 0; r < rows; r += 1) {
    if (lead >= cols) {
      break;
    }
    let i = r;
    while (Math.abs(copy[i]![lead]!) < EPSILON) {
      i += 1;
      if (i === rows) {
        i = r;
        lead += 1;
        if (lead >= cols) {
          break;
        }
      }
    }

    if (lead >= cols) {
      break;
    }

    [copy[i], copy[r]] = [copy[r]!, copy[i]!];
    if (i !== r) {
      operations.push(`R_${r + 1} \\leftrightarrow R_${i + 1}`);
    }

    const pivot = copy[r]![lead]!;
    if (Math.abs(pivot) > EPSILON) {
      for (let j = 0; j < cols; j += 1) {
        copy[r]![j] /= pivot;
      }
      operations.push(`R_${r + 1} \\leftarrow \\frac{1}{${formatScalar(pivot)}} R_${r + 1}`);
    }

    for (let row = 0; row < rows; row += 1) {
      if (row !== r) {
        const factor = copy[row]![lead]!;
        if (Math.abs(factor) > EPSILON) {
          for (let col = 0; col < cols; col += 1) {
            copy[row]![col] -= factor * copy[r]![col]!;
          }
          const sign = factor > 0 ? "-" : "+";
          operations.push(`R_${row + 1} \\leftarrow R_${row + 1} ${sign} ${formatScalar(Math.abs(factor))} R_${r + 1}`);
        }
      }
    }

    if (track) {
      snapshots.push(cloneMatrix(copy));
    }

    lead += 1;
  }

  return { matrix: copy, operations, snapshots };
}

function qrDecomposition(matrix: Matrix) {
  const size = matrix.length;
  const Q = identityMatrix(size);
  const R = matrix.map((row) => [...row]);

  for (let k = 0; k < size - 1; k += 1) {
    for (let i = size - 1; i > k; i -= 1) {
      const a = R[i - 1]![k]!;
      const b = R[i]![k]!;
      if (Math.abs(b) < EPSILON) {
        continue;
      }
      const r = Math.hypot(a, b);
      const c = a / r;
      const s = -b / r;
      for (let j = 0; j < size; j += 1) {
        const Rik = R[i - 1]![j]!;
        const Rjk = R[i]![j]!;
        R[i - 1]![j] = c * Rik - s * Rjk;
        R[i]![j] = s * Rik + c * Rjk;

        const Qik = Q[j]![i - 1]!;
        const Qjk = Q[j]![i]!;
        Q[j]![i - 1] = c * Qik - s * Qjk;
        Q[j]![i] = s * Qik + c * Qjk;
      }
    }
  }

  return { q: Q, r: R };
}

function offDiagonalNorm(matrix: Matrix): number {
  let sum = 0;
  for (let i = 0; i < matrix.length; i += 1) {
    for (let j = 0; j < matrix.length; j += 1) {
      if (i !== j) {
        sum += matrix[i]![j]! * matrix[i]![j]!;
      }
    }
  }
  return Math.sqrt(sum);
}

function createZeroMatrix(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

function cloneMatrix(matrix: Matrix): Matrix {
  return matrix.map((row) => [...row]);
}

function identityMatrix(size: number): Matrix {
  return Array.from({ length: size }, (_row, index) =>
    Array.from({ length: size }, (_col, colIndex) => (index === colIndex ? 1 : 0)),
  );
}

function createZeroVector(length: number): number[] {
  return Array.from({ length }, () => 0);
}

function matrixToColumns(matrix: Matrix): number[][] {
  const cols = matrix[0]?.length ?? 0;
  return Array.from({ length: cols }, (_value, index) => matrix.map((row) => row[index]!));
}

function buildMatrixFromColumns(columns: number[][]): Matrix {
  const rows = columns[0]?.length ?? 0;
  const matrix: Matrix = Array.from({ length: rows }, () => Array(columns.length).fill(0));
  for (let col = 0; col < columns.length; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      matrix[row]![col] = columns[col]![row]!;
    }
  }
  return matrix;
}

function multiplyMatrixVector(matrix: Matrix, vector: number[]): number[] {
  return matrix.map((row) => row.reduce((acc, value, index) => acc + value * (vector[index] ?? 0), 0));
}

function scaleVector(vector: number[], scalar: number): number[] {
  return vector.map((value) => value * scalar);
}

function reorthonormaliseColumns(matrix: Matrix): Matrix {
  const columns = matrixToColumns(matrix);
  const orthonormal: number[][] = [];

  for (const column of columns) {
    let projection = column.slice();
    for (const basis of orthonormal) {
      const dot = projection.reduce((acc, value, index) => acc + value * basis[index]!, 0);
      for (let i = 0; i < projection.length; i += 1) {
        projection[i] -= dot * basis[i]!;
      }
    }
    const norm = Math.hypot(...projection);
    if (norm < EPSILON) {
      orthonormal.push(Array(projection.length).fill(0));
      continue;
    }
    orthonormal.push(projection.map((value) => value / norm));
  }

  return buildMatrixFromColumns(orthonormal);
}

export function formatScalar(value: number): string {
  if (Math.abs(value) < EPSILON) {
    return "0";
  }
  return Number(value.toPrecision(6)).toString();
}

function approximatelyIdentity(value: number, target: number): boolean {
  return Math.abs(value - target) < 1e-6;
}
