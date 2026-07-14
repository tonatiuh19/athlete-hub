import { Label } from "@/components/ui/label";
import type { EventBibMode } from "@shared/bibMode";
import { cn } from "@/lib/utils";

interface StaffEventBibModePickerProps {
  value: EventBibMode;
  onChange: (mode: EventBibMode) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
  /** When true, show the “these numbers ARE dorsales” strong note for folio mode. */
  strongFolioNote?: boolean;
  className?: string;
  /** When true, picker is read-only display (mirror). */
  readOnly?: boolean;
  /** Unique radio group name when multiple pickers exist in the DOM. */
  groupName?: string;
}

/** Event policy: folio number is also the race bib (dorsal), or kept separate. */
export default function StaffEventBibModePicker({
  value,
  onChange,
  t,
  strongFolioNote = false,
  className,
  readOnly = false,
  groupName = "event-bib-mode",
}: StaffEventBibModePickerProps) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-border/70 bg-card/60 p-4",
        className,
      )}
      role="group"
      aria-label={t("staffPortal.eventEdit.bibMode.title")}
    >
      <div>
        <Label className="text-sm font-semibold">
          {t("staffPortal.eventEdit.bibMode.title")}
        </Label>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {t("staffPortal.eventEdit.bibMode.subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label
          className={cn(
            "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors",
            value === "folio"
              ? "border-primary/40 bg-primary/10"
              : "border-border/70 bg-background",
            readOnly && "cursor-default",
          )}
        >
          <input
            type="radio"
            name={groupName}
            className="mt-1"
            checked={value === "folio"}
            disabled={readOnly}
            onChange={() => onChange("folio")}
          />
          <span>
            <span className="font-medium block">
              {t("staffPortal.eventEdit.bibMode.folioOption")}
            </span>
            <span className="text-xs text-muted-foreground leading-relaxed">
              {t("staffPortal.eventEdit.bibMode.folioHint")}
            </span>
          </span>
        </label>

        <label
          className={cn(
            "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors",
            value === "separate"
              ? "border-primary/40 bg-primary/10"
              : "border-border/70 bg-background",
            readOnly && "cursor-default",
          )}
        >
          <input
            type="radio"
            name={groupName}
            className="mt-1"
            checked={value === "separate"}
            disabled={readOnly}
            onChange={() => onChange("separate")}
          />
          <span>
            <span className="font-medium block">
              {t("staffPortal.eventEdit.bibMode.separateOption")}
            </span>
            <span className="text-xs text-muted-foreground leading-relaxed">
              {t("staffPortal.eventEdit.bibMode.separateHint")}
            </span>
          </span>
        </label>
      </div>

      {value === "folio" && strongFolioNote ? (
        <p className="text-xs rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 leading-relaxed text-foreground">
          {t("staffPortal.eventEdit.bibMode.folioStrongNote")}
        </p>
      ) : null}

      {value === "separate" ? (
        <p className="text-xs rounded-lg border border-border/70 bg-muted/30 px-3 py-2 leading-relaxed text-muted-foreground">
          {t("staffPortal.eventEdit.bibMode.separateNudge")}
        </p>
      ) : null}

      {readOnly ? (
        <p className="text-[11px] text-muted-foreground">
          {t("staffPortal.eventEdit.bibMode.changeInDetails")}
        </p>
      ) : null}
    </div>
  );
}
