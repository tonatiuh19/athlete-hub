/** App color theme preference (next-themes + DB preferred_theme). */
export type AppTheme = "light" | "dark" | "system";

export const DEFAULT_THEME: AppTheme = "system";
export const SUPPORTED_THEMES: AppTheme[] = ["light", "dark", "system"];

/** Normalize DB / API / toggle values to light | dark | system */
export function normalizeTheme(input?: string | null): AppTheme {
  if (!input) return DEFAULT_THEME;
  const tag = input.trim().toLowerCase();
  if (tag === "light" || tag === "dark" || tag === "system") return tag;
  return DEFAULT_THEME;
}

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark" || value === "system";
}
