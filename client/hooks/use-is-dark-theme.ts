import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/** Resolved light/dark theme (handles `system` + pre-hydration flash script). */
export function useIsDarkTheme(): boolean {
  const { resolvedTheme } = useTheme();
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (resolvedTheme === "dark") setIsDark(true);
    else if (resolvedTheme === "light") setIsDark(false);
  }, [resolvedTheme]);

  return isDark;
}
