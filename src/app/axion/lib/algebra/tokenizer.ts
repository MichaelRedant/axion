import { TokenizerError } from "./errors";

export type TokenType =
  | "number"
  | "identifier"
  | "operator"
  | "leftParen"
  | "rightParen"
  | "comma";

export interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

const isDigit = (char: string) => /[0-9]/.test(char);
const isAlpha = (char: string) => /[a-z]/i.test(char);
const isAlphaNumeric = (char: string) => /[a-z0-9]/i.test(char);

/**
 * tokenize converts a raw expression into a stream of tokens.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index]!;

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (isDigit(char) || (char === "." && isDigit(input[index + 1] ?? ""))) {
      const start = index;
      let value = char;
      index += 1;

      while (index < input.length) {
        const current = input[index]!;
        if (isDigit(current)) {
          value += current;
          index += 1;
        } else if (current === "." && !value.includes(".")) {
          value += current;
          index += 1;
        } else {
          break;
        }
      }

      tokens.push({
        type: "number",
        value,
        start,
        end: index,
      });
      continue;
    }

    if (isAlpha(char)) {
      const start = index;
      let value = char;
      index += 1;
      while (index < input.length && isAlphaNumeric(input[index]!)) {
        value += input[index];
        index += 1;
      }
      tokens.push({
        type: "identifier",
        value,
        start,
        end: index,
      });
      continue;
    }

    if ("+-*/^=".includes(char)) {
      tokens.push({
        type: "operator",
        value: char,
        start: index,
        end: index + 1,
      });
      index += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({
        type: "leftParen",
        value: char,
        start: index,
        end: index + 1,
      });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({
        type: "rightParen",
        value: char,
        start: index,
        end: index + 1,
      });
      index += 1;
      continue;
    }

    if (char === ",") {
      tokens.push({
        type: "comma",
        value: char,
        start: index,
        end: index + 1,
      });
      index += 1;
      continue;
    }

    throw new TokenizerError(`Onbekend teken '${char}'`, index);
  }

  return tokens;
}
