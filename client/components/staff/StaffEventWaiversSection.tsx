import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import RichHtmlEditor from "@/components/blog/RichHtmlEditor";
import EventAssetUpload from "@/components/staff/EventAssetUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadEventAssetToCdn } from "@/lib/cdn-upload";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateEventWaivers } from "@/store/slices/staffPortalSlice";
import type { EventWaiverInput, EventWaiverRow, StaffRole } from "@shared/api";

type WaiverDraft = EventWaiverInput & { _key: string };

const EMPTY_WAIVER = (): WaiverDraft => ({
  _key: crypto.randomUUID(),
  title: "",
  content_html: "",
  pdf_url: null,
  content_type: "html",
  sort_order: 0,
});

function rowToDraft(w: EventWaiverRow, index: number): WaiverDraft {
  return {
    _key: `existing-${w.id}`,
    id: w.id,
    title: w.title,
    content_html: w.content_html ?? "",
    pdf_url: w.pdf_url ?? null,
    content_type: w.content_type ?? "html",
    sort_order: w.sort_order ?? index,
  };
}

function isDraftValid(d: WaiverDraft): boolean {
  if (!d.title.trim()) return false;
  const type = d.content_type ?? "html";
  if (type === "html") return Boolean(d.content_html?.trim());
  if (type === "pdf") return Boolean(d.pdf_url?.trim());
  return Boolean(d.content_html?.trim() || d.pdf_url?.trim());
}

export interface StaffEventWaiversSectionProps {
  eventId: number;
  waivers: EventWaiverRow[];
  canManage: boolean;
  staffRole: StaffRole;
  isAdmin: boolean;
}

export default function StaffEventWaiversSection({
  eventId,
  waivers,
  canManage,
  staffRole,
  isAdmin,
}: StaffEventWaiversSectionProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { savingWaiver, waiverError } = useAppSelector((s) => s.staffPortal);
  const pdfPendingRef = useRef<Map<string, File>>(new Map());
  const [drafts, setDrafts] = useState<WaiverDraft[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const active = waivers.filter((w) => Boolean(w.is_active));
    if (active.length > 0) {
      setDrafts(active.map(rowToDraft));
    } else {
      setDrafts([]);
    }
    pdfPendingRef.current.clear();
  }, [waivers]);

  const updateDraft = (key: string, patch: Partial<WaiverDraft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d._key === key ? { ...d, ...patch } : d)),
    );
  };

  const removeDraft = (key: string) => {
    pdfPendingRef.current.delete(key);
    setDrafts((prev) => prev.filter((d) => d._key !== key));
  };

  const handleSave = async () => {
    const valid = drafts.filter(isDraftValid);
    if (drafts.length > 0 && valid.length === 0) return;

    setUploading(true);
    try {
      const payload: EventWaiverInput[] = [];
      for (let i = 0; i < valid.length; i++) {
        const d = valid[i];
        let pdf_url = d.pdf_url?.startsWith("blob:") ? null : (d.pdf_url ?? null);
        const pending = pdfPendingRef.current.get(d._key);
        if (pending) {
          pdf_url = await uploadEventAssetToCdn(
            pending,
            `event_${eventId}_waiver_${d.id ?? i}`,
            isAdmin,
            "document",
          );
        }
        payload.push({
          id: d.id,
          title: d.title.trim(),
          content_html: d.content_html ?? "",
          pdf_url,
          content_type: d.content_type ?? "html",
          sort_order: i,
        });
      }

      await dispatch(
        updateEventWaivers({
          eventId,
          role: staffRole,
          waivers: payload,
        }),
      );
      pdfPendingRef.current.clear();
    } finally {
      setUploading(false);
    }
  };

  const busy = savingWaiver || uploading;
  const canSave = drafts.length === 0 || drafts.some(isDraftValid);

  return (
    <div className="card-sport p-6 space-y-4">
      <div>
        <h2 className="font-semibold">{t("staffPortal.eventEdit.waiverTitle")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("staffPortal.eventEdit.waiverSubtitle")}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {t("staffPortal.eventEdit.waiverMultiHint")}
        </p>
      </div>

      {waiverError ? <p className="text-sm text-destructive">{waiverError}</p> : null}

      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("staffPortal.eventEdit.waiverEmpty")}</p>
      ) : (
        <div className="space-y-6">
          {drafts.map((d, index) => {
            const showHtml =
              d.content_type === "html" || d.content_type === "both";
            const showPdf =
              d.content_type === "pdf" || d.content_type === "both";

            return (
              <div
                key={d._key}
                className="rounded-xl border border-border/60 p-4 space-y-4 bg-card/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("staffPortal.eventEdit.waiverItemLabel", { index: index + 1 })}
                  </span>
                  {canManage && drafts.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive shrink-0"
                      onClick={() => removeDraft(d._key)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>{t("staffPortal.eventEdit.waiverName")}</Label>
                  <Input
                    placeholder={t("staffPortal.eventEdit.waiverName")}
                    value={d.title}
                    disabled={!canManage}
                    onChange={(e) => updateDraft(d._key, { title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("staffPortal.eventEdit.waiverContentType")}</Label>
                  <Select
                    value={d.content_type ?? "html"}
                    disabled={!canManage}
                    onValueChange={(v) =>
                      updateDraft(d._key, {
                        content_type: v as WaiverDraft["content_type"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="html">
                        {t("staffPortal.eventEdit.waiverTypeHtml")}
                      </SelectItem>
                      <SelectItem value="pdf">
                        {t("staffPortal.eventEdit.waiverTypePdf")}
                      </SelectItem>
                      <SelectItem value="both">
                        {t("staffPortal.eventEdit.waiverTypeBoth")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {showHtml ? (
                  <div className="space-y-2">
                    <Label>{t("staffPortal.eventEdit.waiverContent")}</Label>
                    <RichHtmlEditor
                      value={d.content_html ?? ""}
                      onChange={(html) => updateDraft(d._key, { content_html: html })}
                      placeholder={t("staffPortal.eventEdit.waiverContentPlaceholder")}
                    />
                  </div>
                ) : null}

                {showPdf ? (
                  <div className="space-y-2">
                    <Label>{t("staffPortal.eventEdit.waiverPdf")}</Label>
                    <EventAssetUpload
                      kind="document"
                      previewUrl={d.pdf_url ?? null}
                      fileName={
                        pdfPendingRef.current.get(d._key)?.name ??
                        (d.pdf_url ? t("staffPortal.eventEdit.waiverPdfUploaded") : null)
                      }
                      onSelectFile={(file) => {
                        pdfPendingRef.current.set(d._key, file);
                        updateDraft(d._key, { pdf_url: URL.createObjectURL(file) });
                      }}
                      onClear={() => {
                        pdfPendingRef.current.delete(d._key);
                        updateDraft(d._key, { pdf_url: null });
                      }}
                    />
                  </div>
                ) : null}

                {d.id && waivers.find((w) => w.id === d.id) ? (
                  <p className="text-xs text-muted-foreground">
                    {t("staffPortal.eventEdit.waiverVersion", {
                      version: waivers.find((w) => w.id === d.id)!.version,
                    })}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDrafts((prev) => [...prev, EMPTY_WAIVER()])}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("staffPortal.eventEdit.addWaiver")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={busy || !canSave}>
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {t("staffPortal.eventEdit.saveWaivers")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
