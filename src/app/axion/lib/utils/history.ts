import { nanoid } from "nanoid";

export interface HistoryEntry {
  readonly id: string;
  readonly input: string;
  readonly exact: string;
  readonly approx: string | null;
  readonly timestamp: number;
  readonly pinned: boolean;
}

export interface HistoryState {
  readonly entries: HistoryEntry[];
}

/**
 * createEntry builds a new history item with a generated identifier.
 */
export function createEntry(params: Omit<HistoryEntry, "id" | "timestamp" | "pinned">): HistoryEntry {
  return {
    id: nanoid(),
    timestamp: Date.now(),
    pinned: false,
    ...params,
  };
}

/**
 * Adds or updates a history entry within the existing state.
 */
export function addEntry(state: HistoryState, entry: HistoryEntry): HistoryState {
  const withoutExisting = state.entries.filter((item) => item.id !== entry.id);
  const pinned = withoutExisting.filter((item) => item.pinned);
  const rest = withoutExisting.filter((item) => !item.pinned);
  return {
    entries: [...pinned, entry, ...rest],
  };
}

export function togglePin(state: HistoryState, id: string): HistoryState {
  const updated = state.entries.map((entry) =>
    entry.id === id ? { ...entry, pinned: !entry.pinned } : entry,
  );

  const pinned = updated.filter((entry) => entry.pinned);
  const rest = updated.filter((entry) => !entry.pinned);

  return { entries: [...pinned, ...rest] };
}

export function clearHistory(state: HistoryState): HistoryState {
  return {
    entries: state.entries.filter((entry) => entry.pinned),
  };
}
