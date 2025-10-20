import { describe, expect, it } from "vitest";
import { tokenize } from "@/app/axion/lib/algebra/tokenizer";
import { parse } from "@/app/axion/lib/algebra/parser";
import {
  addMatrices,
  determinant,
  eigenDecomposition,
  inverse,
  matrixToLatex,
  parseMatrixNode,
  parseVectorNode,
  rank,
  singularValueDecomposition,
  solveLinearSystem,
} from "@/app/axion/lib/algebra/matrix";

function parseCall(input: string) {
  const tokens = tokenize(input);
  const ast = parse(tokens);
  if (ast.type !== "Call") {
    throw new Error("expression is geen aanroep");
  }
  return ast;
}

describe("matrix utilities", () => {
  it("parses matrix(row(...)) syntax", () => {
    const node = parseCall("matrix(row(1,2), row(3,4))");
    const { matrix, rows, cols } = parseMatrixNode(node);
    expect(rows).toBe(2);
    expect(cols).toBe(2);
    expect(matrix).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("supports addition", () => {
    const node = parseCall("matrix(row(1,2), row(3,4))");
    const { matrix } = parseMatrixNode(node);
    const sum = addMatrices(matrix, matrix);
    expect(sum).toEqual([
      [2, 4],
      [6, 8],
    ]);
  });

  it("computes determinant and rank", () => {
    const node = parseCall("matrix(row(2,1), row(5,3))");
    const { matrix } = parseMatrixNode(node);
    expect(determinant(matrix)).toBeCloseTo(1, 6);
    expect(rank(matrix)).toBe(2);
  });

  it("computes the inverse", () => {
    const node = parseCall("matrix(row(4,7), row(2,6))");
    const { matrix } = parseMatrixNode(node);
    const inv = inverse(matrix);
    expect(inv[0]![0]).toBeCloseTo(0.6, 6);
    expect(inv[1]![0]).toBeCloseTo(-0.2, 6);
  });

  it("parses vectors", () => {
    const node = parseCall("vector(5,6)");
    const vector = parseVectorNode(node);
    expect(vector).toEqual([5, 6]);
  });

  it("solves linear systems", () => {
    const aNode = parseCall("matrix(row(2,1), row(5,3))");
    const bNode = parseCall("vector(1,2)");
    const { matrix } = parseMatrixNode(aNode);
    const vector = parseVectorNode(bNode);
    const solution = solveLinearSystem(matrix, vector);
    expect(solution.solution[0]).toBeCloseTo(1, 6);
    expect(solution.solution[1]).toBeCloseTo(-1, 6);
    expect(matrixToLatex(matrix)).toContain("\\begin{array}");
  });

  it("computes eigenvalues and eigenvectors numerically", () => {
    const node = parseCall("matrix(row(2,0), row(0,3))");
    const { matrix } = parseMatrixNode(node);
    const { eigenvalues } = eigenDecomposition(matrix);
    eigenvalues.sort((a, b) => a - b);
    expect(eigenvalues[0]).toBeCloseTo(2, 3);
    expect(eigenvalues[1]).toBeCloseTo(3, 3);
  });

  it("computes singular values", () => {
    const node = parseCall("matrix(row(1,0), row(0,2))");
    const { matrix } = parseMatrixNode(node);
    const { singularValues } = singularValueDecomposition(matrix);
    singularValues.sort((a, b) => a - b);
    expect(singularValues[0]).toBeCloseTo(1, 6);
    expect(singularValues[1]).toBeCloseTo(2, 6);
  });
});
