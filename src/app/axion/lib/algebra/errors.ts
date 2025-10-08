/**
 * Custom error hierarchy used throughout the algebra pipeline.
 */
export abstract class AxionError extends Error {
  readonly position: number;

  constructor(message: string, position: number) {
    super(message);
    this.name = this.constructor.name;
    this.position = position;
  }
}

export class TokenizerError extends AxionError {}
export class ParserError extends AxionError {}
export class EvaluationError extends AxionError {}
