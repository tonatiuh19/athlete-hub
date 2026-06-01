import * as React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const ScrollableTabsList = React.forwardRef<
  React.ElementRef<typeof TabsList>,
  React.ComponentPropsWithoutRef<typeof TabsList>
>(({ className, ...props }, ref) => (
  <TabsList
    ref={ref}
    className={cn(
      "relative w-full h-auto min-h-11 p-1.5 gap-1",
      "inline-flex flex-nowrap justify-start items-stretch",
      "overflow-x-auto overflow-y-hidden scrollbar-hide",
      "snap-x snap-proximity scroll-smooth",
      "bg-card/70 border border-border/80 rounded-xl shadow-sm",
      "[mask-image:linear-gradient(to_right,transparent_0,black_12px,black_calc(100%-12px),transparent_100%)]",
      className,
    )}
    {...props}
  />
));
ScrollableTabsList.displayName = "ScrollableTabsList";

const ScrollableTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTrigger>,
  React.ComponentPropsWithoutRef<typeof TabsTrigger>
>(({ className, ...props }, ref) => (
  <TabsTrigger
    ref={ref}
    className={cn(
      "shrink-0 snap-start rounded-lg px-3 py-2 text-xs sm:text-sm font-medium",
      "text-muted-foreground hover:text-foreground transition-colors",
      "data-[state=active]:bg-cyan/15 data-[state=active]:text-cyan",
      "data-[state=active]:shadow-none data-[state=active]:ring-1 data-[state=active]:ring-cyan/30",
      className,
    )}
    {...props}
  />
));
ScrollableTabsTrigger.displayName = "ScrollableTabsTrigger";

const VerticalTabsList = React.forwardRef<
  React.ElementRef<typeof TabsList>,
  React.ComponentPropsWithoutRef<typeof TabsList>
>(({ className, ...props }, ref) => (
  <TabsList
    ref={ref}
    className={cn(
      "flex flex-col h-auto w-full lg:w-52 xl:w-56 shrink-0",
      "p-2 gap-0.5 rounded-xl",
      "bg-card/70 border border-border/80 shadow-sm",
      "overflow-y-auto overflow-x-hidden scrollbar-hide",
      "max-h-[min(280px,45vh)] lg:max-h-[calc(100dvh-11rem)]",
      "lg:sticky lg:top-20",
      className,
    )}
    {...props}
  />
));
VerticalTabsList.displayName = "VerticalTabsList";

const VerticalTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTrigger>,
  React.ComponentPropsWithoutRef<typeof TabsTrigger>
>(({ className, ...props }, ref) => (
  <TabsTrigger
    ref={ref}
    className={cn(
      "w-full justify-start rounded-lg px-3 py-2.5 text-left text-sm font-medium",
      "text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors",
      "border-l-2 border-transparent",
      "data-[state=active]:bg-cyan/10 data-[state=active]:text-cyan data-[state=active]:border-l-cyan",
      "data-[state=active]:shadow-none data-[state=active]:ring-0",
      className,
    )}
    {...props}
  />
));
VerticalTabsTrigger.displayName = "VerticalTabsTrigger";

/** Scroll the active tab trigger into view inside a scrollable tab list. */
export function useScrollActiveTab(tab: string, listRef: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-state="active"]');
    active?.scrollIntoView({ inline: "nearest", behavior: "smooth", block: "nearest" });
  }, [tab, listRef]);
}

export { ScrollableTabsList, ScrollableTabsTrigger, VerticalTabsList, VerticalTabsTrigger };
