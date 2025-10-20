import type { EvaluationFailure, EvaluationSuccess } from "../algebra/engine";

export type NotebookCellStatus = "success" | "error";

export interface NotebookCell {
  readonly id: string;
  readonly input: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly status: NotebookCellStatus;
  readonly pinned: boolean;
  readonly payload: NotebookCellPayload;
}

export type NotebookCellPayload = NotebookSuccessPayload | NotebookErrorPayload;

export interface NotebookSuccessPayload {
  readonly type: "success";
  readonly evaluation: EvaluationSuccess;
}

export interface NotebookErrorPayload {
  readonly type: "error";
  readonly error: EvaluationFailure;
}

export interface NotebookState {
  readonly cells: NotebookCell[];
}

export interface NotebookSerializedState {
  readonly version: number;
  readonly cells: NotebookSerializedCell[];
}

export type NotebookSerializedCell = Omit<NotebookCell, "payload"> & {
  readonly payload: NotebookSerializedPayload;
};

export type NotebookSerializedPayload =
  | NotebookSerializedSuccess
  | NotebookSerializedFailure;

export interface NotebookSerializedSuccess {
  readonly type: "success";
  readonly evaluation: EvaluationSuccess;
}

export interface NotebookSerializedFailure {
  readonly type: "error";
  readonly error: EvaluationFailure;
}

export interface NotebookActions {
  readonly appendSuccess: (input: string, evaluation: EvaluationSuccess) => void;
  readonly appendError: (input: string, error: EvaluationFailure) => void;
  readonly togglePin: (id: string) => void;
  readonly remove: (id: string) => void;
  readonly reorder: (sourceId: string, targetId: string) => void;
  readonly replaceInput: (id: string, nextInput: string) => void;
  readonly clearUnpinned: () => void;
}
