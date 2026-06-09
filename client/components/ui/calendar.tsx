import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn("p-3 [--cell-size:2.25rem]", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-3", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-3", defaultClassNames.month),
        month_caption: cn(
          "relative flex h-9 w-full items-center justify-center",
          defaultClassNames.month_caption,
        ),
        nav: cn(
          "absolute inset-x-0 top-0 flex items-center justify-between",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 text-primary opacity-90 hover:bg-primary/10 hover:text-primary hover:opacity-100",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 text-primary opacity-90 hover:bg-primary/10 hover:text-primary hover:opacity-100",
          defaultClassNames.button_next,
        ),
        dropdowns: cn(
          "flex w-full items-center justify-center gap-2 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "relative rounded-lg border border-input bg-card shadow-sm",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          "absolute inset-0 cursor-pointer opacity-0",
          defaultClassNames.dropdown,
        ),
        caption_label: cn("text-sm font-semibold", defaultClassNames.caption_label),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground w-9 text-[0.7rem] font-medium uppercase tracking-wide",
          defaultClassNames.weekday,
        ),
        week: cn("mt-1 flex w-full", defaultClassNames.week),
        day: cn("relative p-0 text-center", defaultClassNames.day),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal transition-colors rounded-md",
          "hover:bg-primary/10 hover:text-foreground",
          "aria-selected:bg-primary aria-selected:text-primary-foreground",
          "aria-selected:hover:bg-primary aria-selected:hover:text-primary-foreground",
          "aria-selected:focus:bg-primary aria-selected:focus:text-primary-foreground",
          "aria-selected:font-semibold aria-selected:shadow-[0_0_10px_hsl(var(--primary)/0.35)]",
          defaultClassNames.day_button,
        ),
        selected: cn(
          "[&_.rdp-day_button]:bg-primary [&_.rdp-day_button]:text-primary-foreground",
          defaultClassNames.selected,
        ),
        today: cn(
          "[&_.rdp-day_button]:text-primary [&_.rdp-day_button]:font-medium",
          "[&_.rdp-day_button]:ring-1 [&_.rdp-day_button]:ring-primary/45",
          "rdp-today:not(.rdp-selected) [&_.rdp-day_button]:bg-primary/10",
          defaultClassNames.today,
        ),
        outside: cn("text-muted-foreground/35", defaultClassNames.outside),
        disabled: cn("text-muted-foreground opacity-35", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...rest }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", chevronClassName)} {...rest} />;
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("h-4 w-4", chevronClassName)} {...rest} />;
          }
          return <ChevronDown className={cn("h-4 w-4", chevronClassName)} {...rest} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
