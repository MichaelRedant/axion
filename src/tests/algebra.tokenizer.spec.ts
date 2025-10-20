import { describe, expect, it } from "vitest";
import { tokenize } from "@/app/axion/lib/algebra/tokenizer";

describe("tokenize", () => {
  it('parses "3.5*x^2 + sin(pi/2)" correctly', () => {
    const input = "3.5*x^2 + sin(pi/2)";
    const tokens = tokenize(input);

    expect(tokens.map((token) => token.type)).toEqual([
      "number",
      "operator",
      "identifier",
      "operator",
      "number",
      "operator",
      "identifier",
      "leftParen",
      "identifier",
      "operator",
      "number",
      "rightParen",
    ]);

    expect(tokens.map((token) => token.value)).toEqual([
      "3.5",
      "*",
      "x",
      "^",
      "2",
      "+",
      "sin",
      "(",
      "pi",
      "/",
      "2",
      ")",
    ]);
  });

  it("recognises scientific notation and underscores", () => {
    const input = "diff(unit_step(x), x) + 6.02e23";
    const tokens = tokenize(input);

    expect(tokens.map((token) => token.type)).toEqual([
      "identifier",
      "leftParen",
      "identifier",
      "leftParen",
      "identifier",
      "rightParen",
      "comma",
      "identifier",
      "rightParen",
      "operator",
      "number",
    ]);

    expect(tokens.map((token) => token.value)).toEqual([
      "diff",
      "(",
      "unit_step",
      "(",
      "x",
      ")",
      ",",
      "x",
      ")",
      "+",
      "6.02e23",
    ]);
  });

  it("tokenises punctuation for lists and statements", () => {
    const input = "matrix([1,2],[3,4]);";
    const tokens = tokenize(input);

    expect(tokens.map((token) => token.type)).toEqual([
      "identifier",
      "leftParen",
      "leftBracket",
      "number",
      "comma",
      "number",
      "rightBracket",
      "comma",
      "leftBracket",
      "number",
      "comma",
      "number",
      "rightBracket",
      "rightParen",
      "semicolon",
    ]);
  });

  it("parses string literals", () => {
    const input = 'assume("x>0")';
    const tokens = tokenize(input);

    expect(tokens.map((token) => token.type)).toEqual([
      "identifier",
      "leftParen",
      "string",
      "rightParen",
    ]);
    expect(tokens[2]?.value).toBe("x>0");
  });
});
