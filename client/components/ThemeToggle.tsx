import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: "default" | "compact" | "ghost" | "nav";
  className?: string;
}

export default function ThemeToggle({
  variant = "default",
  className = "",
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = (resolvedTheme ?? theme ?? "dark") === "dark";

  const toggle = () => setTheme(isDark ? "light" : "dark");

  const base =
    variant === "compact"
      ? "h-8 w-8 rounded-lg"
      : variant === "ghost" || variant === "nav"
        ? "h-9 w-9 rounded-xl"
        : "px-3 py-2 text-sm rounded-xl";

  const navStyles =
    variant === "nav"
      ? "border border-white/15 bg-white/[0.08] text-white hover:border-primary/50 hover:bg-white/[0.12]"
      : "border border-border bg-card/60 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary";

  if (!mounted) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center", base, className)}
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? t("common.theme.light") : t("common.theme.dark")}
      aria-label={isDark ? t("common.theme.light") : t("common.theme.dark")}
      className={cn(
        "inline-flex items-center justify-center transition-all",
        variant === "nav" ? navStyles : navStyles,
        base,
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
