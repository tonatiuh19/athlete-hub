import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gift, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import EventAssetUpload from "@/components/staff/EventAssetUpload";
import StaffEventExtraFieldBuilder from "@/components/staff/StaffEventExtraFieldBuilder";
import StaffCheckoutSectionLegend from "@/components/staff/StaffCheckoutSectionLegend";
import StaffFormMissingChips from "@/components/staff/StaffFormMissingChips";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadEventAssetToCdn } from "@/lib/cdn-upload";
import { normalizeCdnUploadUrl } from "@/lib/cdn-url";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addEventExtra,
  deleteEventExtra,
  updateEventExtra,
} from "@/store/slices/staffPortalSlice";
import {
  EVENT_EXTRA_TEMPLATES,
  templateToExtraInput,
  type EventExtraTemplate,
} from "@/utils/eventExtraTemplates";
import { formatPriceMxn } from "@/utils/eventFormat";
import { getExtraFormMissing } from "@/utils/staffFormMissing";
import { getNumberLocale } from "@/utils/dateLocale";
import type {
  EventExtraField,
  EventExtraScopeType,
  EventExtraType,
  StaffEventCategory,
  StaffEventExtra,
  StaffEventExtraInput,
  StaffEventExtraPatch,
  StaffRole,
} from "@shared/api";

const EXTRA_TYPE_KEYS: EventExtraType[] = [
  "merch",
  "addon",
  "folio",
  "service",
  "experience",
  "custom",
];

const EMPTY_NEW: StaffEventExtraInput = {
  name: "",
  price_cents: 0,
  extra_type: "custom",
  max_per_athlete: 1,
  scope_type: "all_categories",
  category_ids: [],
  fields: [],
  is_free: false,
};

export interface StaffEventExtrasSectionProps {
  eventId: number;
  extras: StaffEventExtra[];
  categories: StaffEventCategory[];
  canManage: boolean;
  staffRole: StaffRole;
}

export default function StaffEventExtrasSection({
  eventId,
  extras,
  categories,
  canManage,
  staffRole,
}: StaffEventExtrasSectionProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { savingExtra, extraError } = useAppSelector((s) => s.staffPortal);
  const numLocale = getNumberLocale(i18n.language);
  const isAdmin = staffRole === "admin";
  const pendingImageRef = useRef<File | null>(null);

  const [editingExtraId, setEditingExtraId] = useState<number | null>(null);
  const [extraDraft, setExtraDraft] = useState<StaffEventExtraPatch>({});
  const [newExtra, setNewExtra] = useState<StaffEventExtraInput>({ ...EMPTY_NEW });
  const [newPriceMxn, setNewPriceMxn] = useState("");
  const [editPriceMxn, setEditPriceMxn] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffEventExtra | null>(null);

  const activeCategories = categories.filter((c) => c.is_active !== 0 && c.is_active !== false);
  const activeExtras = extras.filter((e) => e.is_active !== 0 && e.is_active !== false);
  const newExtraMissing = getExtraFormMissing(newExtra.name ?? "");
  const canAddExtra = Boolean(newExtra.name.trim());

  const applyTemplate = (template: EventExtraTemplate) => {
    const name = t(`staffPortal.eventEdit.extraTemplates.${template.nameKey}`);
    setNewExtra({
      ...templateToExtraInput(template, name, Math.round(template.suggestedPriceMxn * 100)),
      scope_type: "all_categories",
      category_ids: [],
      fields: [],
      is_free: false,
    });
    setNewPriceMxn(String(template.suggestedPriceMxn));
  };

  const startEdit = (extra: StaffEventExtra) => {
    setEditingExtraId(extra.id);
    setEditPriceMxn(
      extra.price_cents === 0
        ? ""
        : (extra.price_cents / 100).toFixed(2).replace(/\.00$/, ""),
    );
    pendingImageRef.current = null;
    setExtraDraft({
      name: extra.name,
      description: extra.description ?? null,
      price_cents: extra.price_cents,
      extra_type: extra.extra_type,
      max_per_athlete: extra.max_per_athlete,
      capacity: extra.capacity ?? null,
      image_url: extra.image_url ?? null,
      is_free: extra.price_cents === 0,
      scope_type: extra.scope_type ?? "all_categories",
      category_ids: extra.category_ids ?? [],
      sales_closes_at: extra.sales_closes_at ?? null,
      fields: extra.fields ?? [],
    });
  };

  const resolveImageUrl = async (previewUrl: string | null | undefined) => {
    if (pendingImageRef.current) {
      setUploadingImage(true);
      try {
        const url = await uploadEventAssetToCdn(
          pendingImageRef.current,
          `extra_${eventId}_${Date.now()}`,
          isAdmin,
          "image",
        );
        pendingImageRef.current = null;
        return url;
      } finally {
        setUploadingImage(false);
      }
    }
    if (!previewUrl || previewUrl.startsWith("blob:")) return null;
    return normalizeCdnUploadUrl(previewUrl) ?? previewUrl;
  };

  const buildBody = async (
    draft: StaffEventExtraInput | StaffEventExtraPatch,
    priceMxn: string,
  ): Promise<StaffEventExtraInput | StaffEventExtraPatch> => {
    const isFree = Boolean(draft.is_free);
    const priceMxnNum = parseFloat(priceMxn.replace(",", "."));
    const price_cents = isFree
      ? 0
      : Number.isFinite(priceMxnNum)
        ? Math.round(priceMxnNum * 100)
        : Number(draft.price_cents) || 0;
    const image_url = await resolveImageUrl(draft.image_url);
    return {
      ...draft,
      price_cents,
      is_free: isFree,
      image_url,
    };
  };

  const handleAdd = async () => {
    if (!newExtra.name.trim()) return;
    const body = (await buildBody(newExtra, newPriceMxn)) as StaffEventExtraInput;
    await dispatch(
      addEventExtra({
        eventId,
        role: staffRole,
        body: { ...body, name: newExtra.name.trim() },
      }),
    );
    setNewExtra({ ...EMPTY_NEW });
    setNewPriceMxn("");
    pendingImageRef.current = null;
  };

  const handleSaveEdit = async () => {
    if (editingExtraId == null) return;
    const body = await buildBody(extraDraft, editPriceMxn);
    await dispatch(
      updateEventExtra({
        eventId,
        extraId: editingExtraId,
        role: staffRole,
        body,
      }),
    );
    setEditingExtraId(null);
    setExtraDraft({});
    pendingImageRef.current = null;
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || savingExtra) return;
    const extraId = deleteTarget.id;
    setDeleteTarget(null);
    await dispatch(deleteEventExtra({ eventId, extraId, role: staffRole }));
  };

  const deleteHasSales = (deleteTarget?.sold_count ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{t("staffPortal.eventEdit.extrasTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {t("staffPortal.eventEdit.extrasIntro")}
        </p>
        <StaffCheckoutSectionLegend variant="extras" />
      </div>

      {extraError ? (
        <p className="text-sm text-destructive" role="alert">
          {extraError}
        </p>
      ) : null}

      {canManage ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            {t("staffPortal.eventEdit.extraTemplatesHeading")}
          </div>
          <div className="flex flex-wrap gap-2">
            {EVENT_EXTRA_TEMPLATES.map((template) => (
              <Button
                key={template.id}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-primary/25 hover:border-primary/50 hover:bg-primary/5"
                onClick={() => applyTemplate(template)}
              >
                {t(`staffPortal.eventEdit.extraTemplates.${template.nameKey}`)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {activeExtras.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-6 text-center">
          {t("staffPortal.eventEdit.extrasEmpty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {activeExtras.map((extra) => (
            <li
              key={extra.id}
              className="rounded-xl border border-border bg-card/40 p-4 space-y-3"
            >
              {editingExtraId === extra.id ? (
                <ExtraFormFields
                  draft={extraDraft}
                  priceMxn={editPriceMxn}
                  categories={activeCategories}
                  fieldsLocked={extra.fields_locked}
                  isAdmin={isAdmin}
                  onDraftChange={setExtraDraft}
                  onPriceChange={setEditPriceMxn}
                  onImageSelect={(file) => {
                    pendingImageRef.current = file;
                  }}
                  onImageClear={() => {
                    pendingImageRef.current = null;
                  }}
                  t={t}
                />
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {extra.image_url ? (
                    <img
                      src={extra.image_url}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover border border-border shrink-0"
                    />
                  ) : null}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{extra.name}</p>
                      <span className="text-[10px] uppercase tracking-wide rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                        {t(`staffPortal.eventEdit.extraTypes.${extra.extra_type}`)}
                      </span>
                      {extra.scope_type === "selected_categories" ? (
                        <span className="text-[10px] uppercase tracking-wide rounded-full border border-primary/30 px-2 py-0.5 text-primary">
                          {t("staffPortal.eventEdit.extraScopeSelected")}
                        </span>
                      ) : null}
                    </div>
                    {extra.description ? (
                      <p className="text-xs text-muted-foreground">{extra.description}</p>
                    ) : null}
                    <p className="text-sm font-medium text-primary">
                      {extra.price_cents === 0
                        ? t("staffPortal.eventEdit.extraFreeBadge")
                        : formatPriceMxn(extra.price_cents, numLocale)}
                      {extra.max_per_athlete > 1 ? ` · max ${extra.max_per_athlete}` : ""}
                      {extra.capacity != null ? ` · ${extra.sold_count}/${extra.capacity}` : ""}
                      {(extra.fields?.length ?? 0) > 0
                        ? ` · ${t("staffPortal.eventEdit.extraFieldsCount", {
                            count: extra.fields.length,
                          })}`
                        : ""}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2 shrink-0">
                      <Button type="button" variant="outline" size="sm" onClick={() => startEdit(extra)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={savingExtra}
                        onClick={() => setDeleteTarget(extra)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
              {editingExtraId === extra.id && canManage ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingExtra || uploadingImage}
                    onClick={handleSaveEdit}
                  >
                    {savingExtra || uploadingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    {t("common.save")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingExtraId(null);
                      setExtraDraft({});
                      pendingImageRef.current = null;
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 md:p-5 space-y-4">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t("staffPortal.eventEdit.addExtra")}
          </p>
          <ExtraFormFields
            draft={newExtra}
            priceMxn={newPriceMxn}
            categories={activeCategories}
            fieldsLocked={false}
            isAdmin={isAdmin}
            onDraftChange={(d) => setNewExtra((prev) => ({ ...prev, ...d }))}
            onPriceChange={setNewPriceMxn}
            onImageSelect={(file) => {
              pendingImageRef.current = file;
            }}
            onImageClear={() => {
              pendingImageRef.current = null;
            }}
            t={t}
          />
          <StaffFormMissingChips
            items={newExtraMissing}
            showCompleteState={canAddExtra}
          />
          <Button
            type="button"
            disabled={savingExtra || uploadingImage || !canAddExtra}
            onClick={handleAdd}
          >
            {savingExtra || uploadingImage ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {t("staffPortal.eventEdit.addExtraCta")}
          </Button>
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !savingExtra) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteHasSales
                ? t("staffPortal.eventEdit.extraDeactivateTitle")
                : t("staffPortal.eventEdit.extraDeleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteHasSales
                ? t("staffPortal.eventEdit.extraDeactivateDescription", {
                    name: deleteTarget?.name ?? "",
                    count: deleteTarget?.sold_count ?? 0,
                  })
                : t("staffPortal.eventEdit.extraDeleteDescription", {
                    name: deleteTarget?.name ?? "",
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingExtra}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={savingExtra}
              onClick={() => void handleConfirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {savingExtra ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : deleteHasSales ? (
                t("staffPortal.eventEdit.extraDeactivateConfirm")
              ) : (
                t("staffPortal.eventEdit.extraDeleteConfirm")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExtraFormFields({
  draft,
  priceMxn,
  categories,
  fieldsLocked,
  isAdmin,
  onDraftChange,
  onPriceChange,
  onImageSelect,
  onImageClear,
  t,
}: {
  draft: StaffEventExtraInput | StaffEventExtraPatch;
  priceMxn: string;
  categories: StaffEventCategory[];
  fieldsLocked: boolean;
  isAdmin: boolean;
  onDraftChange: (patch: StaffEventExtraPatch) => void;
  onPriceChange: (v: string) => void;
  onImageSelect: (file: File) => void;
  onImageClear: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const scopeType = draft.scope_type ?? "all_categories";
  const selectedCategoryIds = draft.category_ids ?? [];
  const isFree = Boolean(draft.is_free);
  const fields = (draft.fields ?? []) as EventExtraField[];

  const toggleCategory = (categoryId: number, checked: boolean) => {
    const set = new Set(selectedCategoryIds);
    if (checked) set.add(categoryId);
    else set.delete(categoryId);
    onDraftChange({ category_ids: [...set] });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label>{t("staffPortal.eventEdit.extraName")}</Label>
          <Input
            id="extra-new-name"
            value={draft.name ?? ""}
            onChange={(e) => onDraftChange({ name: e.target.value })}
            placeholder={t("staffPortal.eventEdit.extraNamePlaceholder")}
          />
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <Label>{t("staffPortal.eventEdit.extraImage")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("staffPortal.eventEdit.extraImageHint")}
          </p>
          <EventAssetUpload
            kind="image"
            compact
            staffIsAdmin={isAdmin}
            previewUrl={draft.image_url ?? null}
            onSelectFile={onImageSelect}
            onClear={() => {
              onImageClear();
              onDraftChange({ image_url: null });
            }}
          />
        </div>

        <div className="sm:col-span-2 flex items-center gap-2">
          <Checkbox
            id="extra-is-free"
            checked={isFree}
            onCheckedChange={(checked) => {
              const free = checked === true;
              onDraftChange({ is_free: free, price_cents: free ? 0 : draft.price_cents });
              if (free) onPriceChange("");
            }}
          />
          <Label htmlFor="extra-is-free" className="text-sm font-normal">
            {t("staffPortal.eventEdit.extraFreeToggle")}
          </Label>
        </div>

        <div className="space-y-1.5">
          <Label>{t("staffPortal.eventEdit.extraPriceMxn")}</Label>
          <Input
            inputMode="decimal"
            value={priceMxn}
            disabled={isFree}
            onChange={(e) => onPriceChange(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("staffPortal.eventEdit.extraType")}</Label>
          <Select
            value={draft.extra_type ?? "custom"}
            onValueChange={(v) => onDraftChange({ extra_type: v as EventExtraType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXTRA_TYPE_KEYS.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`staffPortal.eventEdit.extraTypes.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t("staffPortal.eventEdit.extraMaxPerAthlete")}</Label>
          <Input
            type="number"
            min={1}
            max={99}
            value={draft.max_per_athlete ?? 1}
            onChange={(e) =>
              onDraftChange({ max_per_athlete: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("staffPortal.eventEdit.extraCapacity")}</Label>
          <Input
            type="number"
            min={1}
            value={draft.capacity ?? ""}
            onChange={(e) =>
              onDraftChange({
                capacity: e.target.value ? Math.max(1, Number(e.target.value)) : null,
              })
            }
            placeholder={t("staffPortal.eventEdit.unlimited")}
          />
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <Label>{t("staffPortal.eventEdit.extraDescription")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("staffPortal.eventEdit.extraDescriptionHint")}
          </p>
          <Textarea
            rows={2}
            value={draft.description ?? ""}
            onChange={(e) => onDraftChange({ description: e.target.value || null })}
            placeholder={t("staffPortal.eventEdit.extraDescriptionPlaceholder")}
          />
        </div>

        <div className="sm:col-span-2 space-y-2 rounded-lg border border-border/70 p-3">
          <Label>{t("staffPortal.eventEdit.extraScopeTitle")}</Label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="extra-scope"
                checked={scopeType === "all_categories"}
                onChange={() => onDraftChange({ scope_type: "all_categories", category_ids: [] })}
              />
              {t("staffPortal.eventEdit.extraScopeAll")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="extra-scope"
                checked={scopeType === "selected_categories"}
                disabled={categories.length === 0}
                onChange={() =>
                  onDraftChange({ scope_type: "selected_categories" as EventExtraScopeType })
                }
              />
              {t("staffPortal.eventEdit.extraScopeSelected")}
            </label>
          </div>
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("staffPortal.eventEdit.extraScopeNoCategories")}
            </p>
          ) : null}
          {scopeType === "selected_categories" && categories.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 pt-1">
              {categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedCategoryIds.includes(cat.id)}
                    onCheckedChange={(checked) => toggleCategory(cat.id, checked === true)}
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label>{t("staffPortal.eventEdit.extraSalesCloses")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("staffPortal.eventEdit.extraSalesClosesHint")}
          </p>
          <Input
            type="datetime-local"
            value={toDatetimeLocal(draft.sales_closes_at)}
            onChange={(e) =>
              onDraftChange({
                sales_closes_at: e.target.value ? fromDatetimeLocal(e.target.value) : null,
              })
            }
          />
        </div>
      </div>

      <StaffEventExtraFieldBuilder
        fields={fields}
        locked={fieldsLocked}
        onChange={(next) => onDraftChange({ fields: next })}
      />
    </div>
  );
}

function toDatetimeLocal(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}
