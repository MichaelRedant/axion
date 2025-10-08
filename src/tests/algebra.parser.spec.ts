import { describe, expect, it } from "vitest";
import { parse } from "@/app/axion/lib/algebra/parser";
import { tokenize } from "@/app/axion/lib/algebra/tokenizer";
import { ParserError } from "@/app/axion/lib/algebra/errors";

describe("parser", () => {
  it('builds a power AST for "(x+1)^2"', () => {
    const tokens = tokenize("(x+1)^2");
    const ast = parse(tokens);

    expect(ast).toMatchObject({
      type: "Binary",
      operator: "^",
      left: {
        type: "Binary",
        operator: "+",
        left: { type: "Symbol", name: "x" },
        right: { type: "Number", value: "1" },
      },
      right: { type: "Number", value: "2" },
    });
  });

  it("throws for unmatched parenthesis", () => {
    const tokens = tokenize("((1+2)");
    expect(() => parse(tokens)).toThrow(ParserError);
  });

  it("throws for missing arguments", () => {
    const tokens = tokenize("log(,10)");
    expect(() => parse(tokens)).toThrow(ParserError);
  });
});
