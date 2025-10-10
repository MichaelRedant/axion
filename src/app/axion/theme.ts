export type ThemeId = "neon" | "retro" | "dark";

interface ThemeDefinition {
  readonly id: ThemeId;
  readonly label: string;
  readonly description?: string;
}

export const THEMES: ThemeDefinition[] = [
  { id: "neon", label: "Neon" },
  { id: "retro", label: "Retro Keyboard" },
  { id: "dark", label: "Midnight" },
];

export const DEFAULT_THEME: ThemeId = "neon";
