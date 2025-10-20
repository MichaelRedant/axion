import type { EvaluationFailure, EvaluationSuccess } from "../algebra/engine";

export type NotebookCellStatus = "idle" | "running" | "success" | "error";

export interface NotebookCell {
  readonly id: string;
  readonly order: number;
  readonly input: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly status: NotebookCellStatus;
  readonly output: NotebookCellOutput | null;
}

export type NotebookCellOutput = NotebookCellSuccessOutput | NotebookCellErrorOutput;

export interface NotebookCellSuccessOutput {
  readonly type: "success";
  readonly evaluation: EvaluationSuccess;
}

export interface NotebookCellErrorOutput {
  readonly type: "error";
  readonly error: EvaluationFailure;
}

export interface NotebookState {
  readonly cells: NotebookCell[];
  readonly selectedId: string | null;
}

export interface NotebookSerializedState {
  readonly version: number;
  readonly selectedId: string | null;
  readonly cells: NotebookSerializedCell[];
}

export type NotebookSerializedCell = Omit<NotebookCell, "output"> & {
  readonly output: NotebookSerializedOutput | null;
};

export type NotebookSerializedOutput =
  | NotebookCellSuccessOutput
  | NotebookCellErrorOutput;

export interface NotebookActions {
  readonly createCell: (options?: { afterId?: string | null; input?: string }) => string;
  readonly updateInput: (id: string, nextInput: string) => void;
  readonly markEvaluating: (id: string) => void;
  readonly setSuccess: (id: string, evaluation: EvaluationSuccess) => void;
  readonly setError: (id: string, error: EvaluationFailure) => void;
  readonly clearOutput: (id: string) => void;
  readonly remove: (id: string) => void;
  readonly select: (id: string | null) => void;
  readonly reorder: (id: string, targetOrder: number) => void;
  readonly hydrate: (state: NotebookState) => void;
}
