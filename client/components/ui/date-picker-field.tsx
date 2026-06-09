import { useMemo, useState } from "react";
import { format, startOfDay, subYears } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Matcher } from "react-day-picker";

import { cn } from "@/lib/utils";
import { getDateFnsLocale } from "@/utils/dateLocale";
import { parseIsoDate, toIsoDate } from "@/utils/datePickerValue";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type DatePickerVariant = "default" | "birthDate";

export interface DatePickerFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  variant?: DatePickerVariant;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  triggerClassName?: string;
  /** Show calendar icon inside trigger */
  showIcon?: boolean;
  /** Highlight trigger as invalid */
  invalid?: boolean;
  clearable?: boolean;
}

export default function DatePickerField({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  variant = "default",
  minDate,
  maxDate,
  className,
  triggerClassName,
  showIcon = true,
  invalid = false,
  clearable = true,
}: DatePickerFieldProps) {
  const { t, i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const [open, setOpen] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);
  const birthMin = useMemo(() => subYears(today, 100), [today]);
  const defaultBirthMonth = useMemo(() => subYears(today, 28), [today]);

  const selected = parseIsoDate(value);
  const isBirthDate = variant === "birthDate";

  const effectiveMin = isBirthDate ? (minDate ?? birthMin) : minDate;
  const effectiveMax = isBirthDate ? (maxDate ?? today) : maxDate;

  const disabledMatcher = useMemo(() => {
    const matchers: Matcher[] = [];
    if (effectiveMin) matchers.push({ before: effectiveMin });
    if (effectiveMax) matchers.push({ after: effectiveMax });
    return matchers.length ? matchers : undefined;
  }, [effectiveMin, effectiveMax]);

  const displayLabel =
    selected != null
      ? format(selected, "PP", { locale })
      : (placeholder ??
        (isBirthDate
          ? t("common.datePicker.birthPlaceholder")
          : t("common.datePicker.placeholder")));

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) onBlur?.();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            "relative flex w-full items-center gap-2 rounded-xl border border-input bg-card/80 text-left text-sm transition-all",
            "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            "disabled:pointer-events-none disabled:opacity-50",
            showIcon ? "h-12 pl-10 pr-3" : "h-10 px-3",
            invalid && "border-destructive focus-visible:ring-destructive/30",
            !selected && "text-muted-foreground",
            triggerClassName,
            className,
          )}
        >
          {showIcon ? (
            <CalendarDays className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
          ) : null}
          <span className="flex-1 truncate">{displayLabel}</span>
          {clearable && selected && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={t("common.datePicker.clear")}
              className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto overflow-hidden border-border/60 bg-card p-0 shadow-xl"
        align="start"
        sideOffset={6}
      >
        <div className="border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">
            {isBirthDate ? t("auth.athlete.dobLabel") : t("common.datePicker.pickDate")}
          </p>
        </div>
        <Calendar
          mode="single"
          locale={locale}
          selected={selected}
          onSelect={(date) => {
            onChange(toIsoDate(date));
            setOpen(false);
            onBlur?.();
          }}
          defaultMonth={selected ?? (isBirthDate ? defaultBirthMonth : today)}
          captionLayout={isBirthDate ? "dropdown" : "label"}
          reverseYears={isBirthDate}
          startMonth={isBirthDate ? birthMin : effectiveMin}
          endMonth={isBirthDate ? today : effectiveMax}
          disabled={disabledMatcher}
          initialFocus
        />
        {clearable && value ? (
          <div className="border-t border-border/50 p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full text-muted-foreground"
              onClick={() => {
                onChange("");
                setOpen(false);
                onBlur?.();
              }}
            >
              {t("common.datePicker.clear")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
