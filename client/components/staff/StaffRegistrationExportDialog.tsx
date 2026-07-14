import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppDispatch } from "@/store/hooks";
import {
  exportEventRegistrationsCsv,
  fetchRegistrationExportCatalog,
} from "@/store/slices/staffPortalSlice";
import type {
  RegistrationExportCatalogResponse,
  RegistrationExportColumnMeta,
  RegistrationExportPresetId,
  StaffRole,
} from "@shared/api";
import { REGISTRATION_EXPORT_STATUSES } from "@shared/registrationExport";
import { logger } from "@/utils/logger";

const STORAGE_PREFIX = "registration-export-columns:";

function loadSavedColumns(eventId: number): string[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${eventId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((x) => String(x)).filter(Boolean);
  } catch {
    return null;
  }
}

function saveColumns(eventId: number, columns: string[]) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${eventId}`, JSON.stringify(columns));
  } catch {
    /* ignore quota */
  }
}

function coreLabel(
  t: (key: string, opts?: Record<string, string>) => string,
  col: RegistrationExportColumnMeta,
): string {
  if (col.kind !== "core") return col.label;
  const key = col.id.replace(/^core\./, "");
  const i18nKey = `staffPortal.registrations.export.columns.${key}`;
  const translated = t(i18nKey);
  return translated === i18nKey ? col.label : translated;
}

interface StaffRegistrationExportDialogProps {
  eventId: number;
  role: StaffRole;
  /** Current list search — applied to export when set */
  searchQuery?: string;
  disabled?: boolean;
}

export default function StaffRegistrationExportDialog({
  eventId,
  role,
  searchQuery = "",
  disabled = false,
}: StaffRegistrationExportDialogProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<RegistrationExportCatalogResponse | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(
    new Set(["confirmed", "pending_payment"]),
  );
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<RegistrationExportPresetId | "custom">(
    "essentials",
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingCatalog(true);
      setCatalogError(null);
      setExportError(null);
      const result = await dispatch(fetchRegistrationExportCatalog({ eventId, role }));
      if (cancelled) return;
      if (fetchRegistrationExportCatalog.fulfilled.match(result)) {
        const data = result.payload;
        setCatalog(data);
        const saved = loadSavedColumns(eventId);
        const savedValid = saved?.filter((id) => data.columns.some((c) => c.id === id)) ?? null;
        if (savedValid && savedValid.length > 0) {
          setSelected(new Set(savedValid));
          setActivePreset("custom");
        } else {
          const ids =
            data.presets.find((p) => p.id === "essentials")?.column_ids ??
            data.columns.filter((c) => c.kind === "core").map((c) => c.id);
          setSelected(new Set(ids));
          setActivePreset("essentials");
        }
        setStatuses(new Set(data.default_statuses));
      } else {
        setCatalogError(result.payload || t("staffPortal.errors.loadExportCatalog"));
      }
      setLoadingCatalog(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventId, role, dispatch, t]);

  const groups = useMemo(() => {
    if (!catalog) return [] as Array<{ id: string; label: string; columns: RegistrationExportColumnMeta[] }>;
    const map = new Map<string, { id: string; label: string; columns: RegistrationExportColumnMeta[] }>();
    for (const col of catalog.columns) {
      const g = map.get(col.group_id) ?? {
        id: col.group_id,
        label: col.group_label,
        columns: [],
      };
      g.columns.push(col);
      map.set(col.group_id, g);
    }
    return [...map.values()];
  }, [catalog]);

  const applyPreset = (presetId: RegistrationExportPresetId) => {
    if (!catalog) return;
    const preset = catalog.presets.find((p) => p.id === presetId);
    if (!preset) return;
    setSelected(new Set(preset.column_ids));
    setActivePreset(presetId);
  };

  const toggleColumn = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    setActivePreset("custom");
  };

  const toggleGroup = (columnIds: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of columnIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    setActivePreset("custom");
  };

  const toggleStatus = (status: string, checked: boolean) => {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (checked) next.add(status);
      else next.delete(status);
      return next;
    });
  };

  const handleExport = async () => {
    if (selected.size === 0 || statuses.size === 0) return;
    setExporting(true);
    setExportError(null);
    const columns = [...selected];
    saveColumns(eventId, columns);
    const result = await dispatch(
      exportEventRegistrationsCsv({
        eventId,
        role,
        columns,
        statuses: [...statuses],
        q: searchQuery.trim() || undefined,
      }),
    );
    setExporting(false);
    if (exportEventRegistrationsCsv.fulfilled.match(result)) {
      logger.info("Registration export downloaded", {
        eventId,
        columns: columns.length,
      });
      setOpen(false);
    } else {
      setExportError(result.payload || t("staffPortal.errors.exportRegistrations"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="shrink-0">
          <Download className="w-4 h-4 mr-2" />
          {t("staffPortal.registrations.exportCsv")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[min(90vh,720px)] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle>{t("staffPortal.registrations.export.title")}</DialogTitle>
          <DialogDescription>
            {t("staffPortal.registrations.export.subtitle")}
            {searchQuery.trim() ? (
              <span className="block mt-1 text-foreground">
                {t("staffPortal.registrations.export.searchApplied", {
                  q: searchQuery.trim(),
                })}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3 flex flex-wrap gap-2 shrink-0 border-b border-border">
          {(["essentials", "race_day", "logistics", "full"] as RegistrationExportPresetId[]).map(
            (preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={activePreset === preset ? "default" : "outline"}
                onClick={() => applyPreset(preset)}
                disabled={!catalog || loadingCatalog}
              >
                {t(`staffPortal.registrations.export.presets.${preset}`)}
              </Button>
            ),
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0 px-6 py-4">
          {loadingCatalog ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              {t("staffPortal.registrations.export.loading")}
            </div>
          ) : catalogError ? (
            <p className="text-sm text-destructive py-4">{catalogError}</p>
          ) : catalog ? (
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-semibold mb-2">
                  {t("staffPortal.registrations.export.statusesTitle")}
                </h3>
                <div className="flex flex-wrap gap-3">
                  {REGISTRATION_EXPORT_STATUSES.map((status) => (
                    <label key={status} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={statuses.has(status)}
                        onCheckedChange={(v) => toggleStatus(status, Boolean(v))}
                      />
                      {t(`staffPortal.registrations.export.statuses.${status}`, {
                        defaultValue: status,
                      })}
                    </label>
                  ))}
                </div>
              </section>

              {groups.map((group) => {
                const ids = group.columns.map((c) => c.id);
                const allOn = ids.every((id) => selected.has(id));
                const someOn = !allOn && ids.some((id) => selected.has(id));
                return (
                  <section key={group.id}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold">
                        {group.id === "core"
                          ? t("staffPortal.registrations.export.groups.core")
                          : group.id === "fields"
                            ? t("staffPortal.registrations.export.groups.fields")
                            : group.label}
                      </h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => toggleGroup(ids, !allOn)}
                      >
                        {allOn || someOn
                          ? t("staffPortal.registrations.export.clearGroup")
                          : t("staffPortal.registrations.export.selectGroup")}
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.columns.map((col) => (
                        <label
                          key={col.id}
                          className="flex items-start gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40"
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={selected.has(col.id)}
                            onCheckedChange={(v) => toggleColumn(col.id, Boolean(v))}
                          />
                          <span className="min-w-0">
                            <span className="font-medium leading-snug block">
                              {coreLabel(t, col)}
                            </span>
                            {col.description ? (
                              <span className="text-xs text-muted-foreground block mt-0.5">
                                {col.description}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground order-2 sm:order-1">
            {t("staffPortal.registrations.export.selectedCount", {
              count: selected.size,
            })}
          </p>
          <div className="flex gap-2 order-1 sm:order-2 w-full sm:w-auto">
            {exportError ? (
              <p className="text-xs text-destructive flex-1 self-center sm:hidden">{exportError}</p>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleExport}
              disabled={
                exporting ||
                loadingCatalog ||
                !catalog ||
                selected.size === 0 ||
                statuses.size === 0
              }
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {t("staffPortal.registrations.export.download")}
            </Button>
          </div>
          {exportError ? (
            <p className="text-xs text-destructive w-full hidden sm:block order-3">{exportError}</p>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
