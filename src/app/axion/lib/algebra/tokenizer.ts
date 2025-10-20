import { TokenizerError } from "./errors";

export type TokenType =
  | "number"
  | "identifier"
  | "operator"
  | "leftParen"
  | "rightParen"
  | "leftBracket"
  | "rightBracket"
  | "leftBrace"
  | "rightBrace"
  | "comma"
  | "semicolon"
  | "string";

export interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

const isDigit = (char: string) => /[0-9]/.test(char);
const isAlpha = (char: string) => /[a-z_]/i.test(char);
const isAlphaNumeric = (char: string) => /[a-z0-9_]/i.test(char);

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
      let hasDecimal = char === ".";
      let hasExponent = false;
      index += 1;

      while (index < input.length) {
        const current = input[index]!;
        if (isDigit(current)) {
          value += current;
          index += 1;
        } else if (current === "." && !hasDecimal && !hasExponent) {
          value += current;
          hasDecimal = true;
          index += 1;
        } else if ((current === "e" || current === "E") && !hasExponent) {
          const next = input[index + 1];
          const nextNext = input[index + 2];
          const sign = next === "+" || next === "-";
          const digitAfter = isDigit(sign ? nextNext ?? "" : next ?? "");
          if (!digitAfter) {
            break;
          }
          value += current;
          hasExponent = true;
          index += 1;
          if (sign) {
            value += next!;
            index += 1;
          }
        } else {
          break;
        }
      }

      if (hasExponent) {
        while (index < input.length && isDigit(input[index]!)) {
          value += input[index];
          index += 1;
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

    if (char === "-" && input[index + 1] === ">") {
      tokens.push({
        type: "operator",
        value: "->",
        start: index,
        end: index + 2,
      });
      index += 2;
      continue;
    }

    if ((char === "<" || char === ">") && input[index + 1] === "=") {
      tokens.push({
        type: "operator",
        value: `${char}=`,
        start: index,
        end: index + 2,
      });
      index += 2;
      continue;
    }

    if ((char === ":" || char === "!" || char === "%") && input[index + 1] === "=") {
      tokens.push({
        type: "operator",
        value: `${char}=`,
        start: index,
        end: index + 2,
      });
      index += 2;
      continue;
    }

    if ("+-*/^=<>:!".includes(char)) {
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

    if (char === "[") {
      tokens.push({
        type: "leftBracket",
        value: char,
        start: index,
        end: index + 1,
      });
      index += 1;
      continue;
    }

    if (char === "]") {
      tokens.push({
        type: "rightBracket",
        value: char,
        start: index,
        end: index + 1,
      });
      index += 1;
      continue;
    }

    if (char === "{") {
      tokens.push({
        type: "leftBrace",
        value: char,
        start: index,
        end: index + 1,
      });
      index += 1;
      continue;
    }

    if (char === "}") {
      tokens.push({
        type: "rightBrace",
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

    if (char === ";") {
      tokens.push({
        type: "semicolon",
        value: char,
        start: index,
        end: index + 1,
      });
      index += 1;
      continue;
    }

    if (char === '"') {
      const start = index;
      index += 1;
      let value = "";
      let closed = false;
      while (index < input.length) {
        const current = input[index]!;
        if (current === '\\' && index + 1 < input.length) {
          value += current + input[index + 1];
          index += 2;
          continue;
        }
        if (current === '"') {
          closed = true;
          index += 1;
          break;
        }
        value += current;
        index += 1;
      }

      if (!closed) {
        throw new TokenizerError("Onbeëindigde string", start);
      }

      tokens.push({
        type: "string",
        value,
        start,
        end: index,
      });
      continue;
    }

    throw new TokenizerError(`Onbekend teken '${char}'`, index);
  }

  return tokens;
}

