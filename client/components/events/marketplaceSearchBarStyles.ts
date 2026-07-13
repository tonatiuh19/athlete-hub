import { cn } from "@/lib/utils";

/** Shared chrome for hero + events marketplace search bars. */
export function marketplaceSearchOuterClass(active: boolean, roundedClass = "rounded-2xl") {
  return cn(
    "relative p-px transition-all duration-300",
    roundedClass,
    active
      ? "bg-gradient-to-r from-primary/80 via-primary/50 to-accent/60 shadow-glow-triboo"
      : "bg-gradient-to-r from-primary/30 via-primary/20 to-accent/25 shadow-[0_8px_32px_hsl(var(--foreground)/0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]",
  );
}

export function marketplaceSearchInnerClass(active: boolean, roundedClass = "rounded-[calc(1rem-1px)]") {
  return cn(
    "relative flex items-center gap-1 px-2 min-h-[52px]",
    roundedClass,
    "bg-card/95 backdrop-blur-xl",
    "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]",
    active && "bg-card",
  );
}

export function marketplaceSearchGlowClass(active: boolean, roundedClass = "rounded-[1.4rem]") {
  return cn(
    "absolute -inset-1.5 z-0 bg-triboo-gradient pointer-events-none blur-xl transition-opacity duration-300",
    roundedClass,
    active ? "opacity-25" : "opacity-15",
  );
}

/**
 * Input chrome for marketplace / hero search bars.
 * Always uses semantic foreground tokens — the inner shell is `bg-card`, so
 * placeholders must follow theme (never hardcoded white).
 */
export function marketplaceSearchInputClass() {
  return cn(
    "w-full min-w-0 flex-1 bg-transparent border-0 p-0 m-0 text-base outline-none shadow-none ring-0 appearance-none",
    "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 caret-primary",
    "text-foreground placeholder:text-muted-foreground",
  );
}
