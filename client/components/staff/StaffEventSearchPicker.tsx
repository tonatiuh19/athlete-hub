import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface StaffEventSearchOption {
  id: number;
  title: string;
}

interface StaffEventSearchPickerProps {
  events: StaffEventSearchOption[];
  value: string;
  onChange: (value: string) => void;
  /** When true, includes an “All events” option with value `"all"`. */
  allowAll?: boolean;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

/** Searchable event filter / picker (Popover + Command). */
export default function StaffEventSearchPicker({
  events,
  value,
  onChange,
  allowAll = true,
  className,
  disabled = false,
  placeholder,
}: StaffEventSearchPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabel = useMemo(() => {
    if (value === "all" || !value) {
      return allowAll ? t("staffPortal.registrations.allEvents") : placeholder;
    }
    const hit = events.find((e) => String(e.id) === value);
    return hit?.title ?? placeholder ?? t("staffPortal.registrations.eventFilter");
  }, [value, events, allowAll, placeholder, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => e.title.toLowerCase().includes(q));
  }, [events, search]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full sm:w-64 justify-between font-normal shrink-0",
            (!value || value === "all") && allowAll && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate text-left">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("staffPortal.registrations.eventSearchPlaceholder")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{t("staffPortal.registrations.eventSearchEmpty")}</CommandEmpty>
            <CommandGroup>
              {allowAll ? (
                <CommandItem
                  value="all"
                  onSelect={() => {
                    onChange("all");
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")}
                  />
                  {t("staffPortal.registrations.allEvents")}
                </CommandItem>
              ) : null}
              {filtered.map((ev) => {
                const id = String(ev.id);
                return (
                  <CommandItem
                    key={ev.id}
                    value={id}
                    onSelect={() => {
                      onChange(id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === id ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{ev.title}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
