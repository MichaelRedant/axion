import type { Node, BinaryOperator, UnaryOperator } from "./ast";
import { ParserError } from "./errors";
import type { Token } from "./tokenizer";

interface OperatorBinding {
  readonly lbp: number;
  readonly rbp: number;
}

const OPERATOR_TABLE: Record<BinaryOperator, OperatorBinding> = {
  "+": { lbp: 10, rbp: 10 },
  "-": { lbp: 10, rbp: 10 },
  "*": { lbp: 20, rbp: 20 },
  "/": { lbp: 20, rbp: 20 },
  "^": { lbp: 30, rbp: 29 }, // right associative
  "=": { lbp: 5, rbp: 4 },
  "->": { lbp: 1, rbp: 0 },
};

/**
 * Pratt parser for Axion expressions.
 */
export class Parser {
  private readonly tokens: readonly Token[];
  private index = 0;

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  parse(): Node {
    const expr = this.parseExpression(0);
    if (!this.isAtEnd()) {
      const token = this.peek();
      const value = token?.value ?? "EOF";
      const position = token?.start ?? this.lastEnd();
      throw new ParserError(`Onverwacht token "${value}"`, position);
    }
    return expr;
  }

  private parseExpression(rbp: number): Node {
    const token = this.next();
    if (!token) {
      throw new ParserError("Onverwachte einde van invoer", this.lastEnd());
    }

    let left = this.nud(token);

    while (!this.isAtEnd()) {
      const nextToken = this.peek();
      if (
        this.isInfixOperator(nextToken) &&
        rbp < this.lbp()
      ) {
        const operatorToken = this.next();
        if (!operatorToken) {
          break;
        }
        left = this.led(operatorToken, left);
        continue;
      }

      if (this.shouldImplicitMultiply(nextToken)) {
        const right = this.parseExpression(OPERATOR_TABLE["*"].rbp);
        left = {
          type: "Binary",
          operator: "*",
          left,
          right,
          start: left.start,
          end: right.end,
        };
        continue;
      }

      break;
    }

    return left;
  }

  private nud(token: Token): Node {
    switch (token.type) {
      case "number":
        return {
          type: "Number",
          value: token.value,
          start: token.start,
          end: token.end,
        };
      case "identifier":
        if (this.match("leftParen")) {
          const { args, end } = this.readArguments(token);
          return {
            type: "Call",
            callee: token.value,
            args,
            start: token.start,
            end,
          };
        }
        return {
          type: "Symbol",
          name: token.value,
          start: token.start,
          end: token.end,
        };
      case "operator":
        if (token.value === "+" || token.value === "-") {
          const argument = this.parseExpression(25);
          return {
            type: "Unary",
            operator: token.value as UnaryOperator,
            argument,
            start: token.start,
            end: argument.end,
          };
        }
        throw new ParserError(
          `Onverwachte eenzijdige operator "${token.value}"`,
          token.start,
        );
      case "leftParen": {
        const expression = this.parseExpression(0);
        const closing = this.expect("rightParen", "Ontbrekende sluitende haak");
        return {
          ...expression,
          start: token.start,
          end: closing.end,
        };
      }
      default:
        throw new ParserError(
          `Onverwacht token "${token.value}"`,
          token.start,
        );
    }
  }

  private led(token: Token, left: Node): Node {
    if (token.type !== "operator" || !this.isInfixOperator(token)) {
      throw new ParserError(`Ongeldige operator "${token.value}"`, token.start);
    }

    const binding = OPERATOR_TABLE[token.value as BinaryOperator];
    const right = this.parseExpression(binding.rbp);

    return {
      type: "Binary",
      operator: token.value as BinaryOperator,
      left,
      right,
      start: left.start,
      end: right.end,
    };
  }

  private readArguments(openToken: Token): { args: Node[]; end: number } {
    const args: Node[] = [];
    if (this.match("rightParen")) {
      return { args, end: this.previous().end };
    }

    do {
      args.push(this.parseExpression(0));
    } while (this.match("comma"));

    const closing = this.expect(
      "rightParen",
      `Ontbrekende sluitende haak voor functie "${openToken.value}"`,
    );
    return { args, end: closing.end };
  }

  private isInfixOperator(token: Token | undefined): token is Token & {
    type: "operator";
  } {
    return !!token && token.type === "operator" && token.value in OPERATOR_TABLE;
  }

  private lbp(): number {
    const token = this.peek();
    if (!token || token.type !== "operator") {
      return 0;
    }
    return OPERATOR_TABLE[token.value as BinaryOperator]?.lbp ?? 0;
  }

  private match(type: Token["type"]): boolean {
    if (this.check(type)) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private expect(type: Token["type"], message: string): Token {
    const token = this.next();
    if (!token || token.type !== type) {
      throw new ParserError(
        message,
        token ? token.start : this.lastEnd(),
      );
    }
    return token;
  }

  private check(type: Token["type"]): boolean {
    const token = this.peek();
    return !!token && token.type === type;
  }

  private shouldImplicitMultiply(token: Token | undefined): boolean {
    if (!token) return false;
    const prev = this.previousToken();
    if (!prev) return false;

    const prevCanCombine =
      prev.type === "number" ||
      prev.type === "identifier" ||
      prev.type === "rightParen";

    if (!prevCanCombine) return false;

    return (
      token.type === "number" ||
      token.type === "identifier" ||
      token.type === "leftParen"
    );
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private next(): Token | undefined {
    return this.tokens[this.index++];
  }

  private previous(): Token {
    return this.tokens[this.index - 1]!;
  }

  private previousToken(): Token | undefined {
    return this.tokens[this.index - 1];
  }

  private isAtEnd(): boolean {
    return this.index >= this.tokens.length;
  }

  private lastEnd(): number {
    return this.tokens[this.tokens.length - 1]?.end ?? 0;
  }
}

export function parse(tokens: readonly Token[]): Node {
  return new Parser(tokens).parse();
}
