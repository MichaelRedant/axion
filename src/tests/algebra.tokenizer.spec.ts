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
});
