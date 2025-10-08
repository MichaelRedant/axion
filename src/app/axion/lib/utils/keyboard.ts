export type ShortcutAction =
  | "evaluate"
  | "newline"
  | "historyPrev"
  | "historyNext"
  | "clear"
  | "help"
  | "toggleTheme";

export interface Shortcut {
  readonly keys: string[];
  readonly action: ShortcutAction;
  readonly descriptionKey: string;
}

/**
 * Keyboard shortcut map for the calculator textarea.
 */
export const SHORTCUTS: Shortcut[] = [
  {
    keys: ["Enter"],
    action: "evaluate",
    descriptionKey: "help.shortcutDescriptions.evaluate",
  },
  {
    keys: ["Shift", "Enter"],
    action: "newline",
    descriptionKey: "help.shortcutDescriptions.newline",
  },
  {
    keys: ["ArrowUp"],
    action: "historyPrev",
    descriptionKey: "help.shortcutDescriptions.historyPrev",
  },
  {
    keys: ["ArrowDown"],
    action: "historyNext",
    descriptionKey: "help.shortcutDescriptions.historyNext",
  },
  {
    keys: ["Meta", "k"],
    action: "clear",
    descriptionKey: "help.shortcutDescriptions.clear",
  },
  {
    keys: ["Control", "k"],
    action: "clear",
    descriptionKey: "help.shortcutDescriptions.clear",
  },
  {
    keys: ["Meta", "/"],
    action: "help",
    descriptionKey: "help.shortcutDescriptions.help",
  },
  {
    keys: ["Control", "/"],
    action: "help",
    descriptionKey: "help.shortcutDescriptions.help",
  },
  {
    keys: ["Meta", "l"],
    action: "toggleTheme",
    descriptionKey: "help.shortcutDescriptions.toggleTheme",
  },
  {
    keys: ["Control", "l"],
    action: "toggleTheme",
    descriptionKey: "help.shortcutDescriptions.toggleTheme",
  },
];

export function matchShortcut(event: KeyboardEvent): ShortcutAction | null {
  const pressed = normalizeEventKeys(event);
  const match = SHORTCUTS.find((shortcut) =>
    arraysEqual(pressed, shortcut.keys),
  );
  return match?.action ?? null;
}

function normalizeEventKeys(event: KeyboardEvent): string[] {
  const keys: string[] = [];
  if (event.metaKey) keys.push("Meta");
  if (event.ctrlKey) keys.push("Control");
  if (event.shiftKey) keys.push("Shift");
  if (event.altKey) keys.push("Alt");
  if (!["Shift", "Control", "Alt", "Meta"].includes(event.key)) {
    keys.push(event.key);
  }
  return keys;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}
