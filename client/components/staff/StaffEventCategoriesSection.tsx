import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import StaffEventCategoryFormFields from "@/components/staff/StaffEventCategoryFormFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addEventCategory,
  deleteEventCategory,
  updateEventCategory,
} from "@/store/slices/staffPortalSlice";
import {
  EVENT_CATEGORY_TEMPLATES,
} from "@/utils/eventCategoryTemplates";
import { formatCategoryEligibility } from "@/utils/formatCategoryEligibility";
import { getNumberLocale } from "@/utils/dateLocale";
import { fromDatetimeLocal, toDatetimeLocal } from "@/utils/datetimeLocal";
import type {
  StaffEventCategory,
  StaffEventCategoryInput,
  StaffEventCategoryPatch,
  StaffRole,
} from "@shared/api";

const EMPTY_NEW: StaffEventCategoryInput = {
  name: "",
  price_cents: 0,
  gender_restriction: "any",
  waitlist_enabled: false,
};

export interface StaffEventCategoriesSectionProps {
  eventId: number;
  categories: StaffEventCategory[];
  canManage: boolean;
  staffRole: StaffRole;
}

export default function StaffEventCategoriesSection({
  eventId,
  categories,
  canManage,
  staffRole,
}: StaffEventCategoriesSectionProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { savingCategory, categoryError } = useAppSelector((s) => s.staffPortal);
  const numLocale = getNumberLocale(i18n.language);

  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<StaffEventCategoryPatch>({});
  const [newCategory, setNewCategory] = useState<StaffEventCategoryInput>({
    ...EMPTY_NEW,
  });
  const [newPriceMxn, setNewPriceMxn] = useState("");

  const startEditCategory = (c: StaffEventCategory) => {
    setEditingCategoryId(c.id);
    setCategoryDraft({
      name: c.name,
      description: c.description ?? null,
      price_cents: c.price_cents,
      capacity: c.capacity ?? null,
      distance_km: c.distance_km ?? null,
      gender_restriction: c.gender_restriction ?? "any",
      min_age: c.min_age ?? null,
      max_age: c.max_age ?? null,
      difficulty: c.difficulty ?? null,
      waitlist_enabled: Boolean(c.waitlist_enabled),
      registration_opens_at: c.registration_opens_at
        ? toDatetimeLocal(c.registration_opens_at)
        : null,
      registration_closes_at: c.registration_closes_at
        ? toDatetimeLocal(c.registration_closes_at)
        : null,
    });
  };

  const handleSaveCategoryEdit = async () => {
    if (editingCategoryId == null) return;
    const opensLocal =
      typeof categoryDraft.registration_opens_at === "string"
        ? categoryDraft.registration_opens_at
        : "";
    const closesLocal =
      typeof categoryDraft.registration_closes_at === "string"
        ? categoryDraft.registration_closes_at
        : "";

    await dispatch(
      updateEventCategory({
        eventId,
        categoryId: editingCategoryId,
        role: staffRole,
        body: {
          ...categoryDraft,
          registration_opens_at: opensLocal
            ? fromDatetimeLocal(opensLocal)
            : null,
          registration_closes_at: closesLocal
            ? fromDatetimeLocal(closesLocal)
            : null,
        },
      }),
    );
    setEditingCategoryId(null);
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim() || !newPriceMxn) return;
    const price_cents = Math.round(Number(newPriceMxn) * 100);
    if (!Number.isFinite(price_cents) || price_cents < 0) return;

    await dispatch(
      addEventCategory({
        eventId,
        role: staffRole,
        body: {
          ...newCategory,
          name: newCategory.name.trim(),
          price_cents,
          description: newCategory.description?.trim() || undefined,
        },
      }),
    );
    setNewCategory({ ...EMPTY_NEW });
    setNewPriceMxn("");
  };

  const applyTemplate = (templateId: (typeof EVENT_CATEGORY_TEMPLATES)[number]["id"]) => {
    const template = EVENT_CATEGORY_TEMPLATES.find((tpl) => tpl.id === templateId);
    if (!template) return;
    const name = t(`staffPortal.eventEdit.categoryTemplates.${template.nameKey}`);
    setNewCategory((prev) => ({
      ...prev,
      name,
      ...template.defaults,
    }));
  };

  const canAdd =
    Boolean(newCategory.name.trim()) &&
    Boolean(newPriceMxn) &&
    Number.isFinite(Number(newPriceMxn));

  return (
    <div className="card-sport p-6 space-y-5">
      <div>
        <h2 className="font-semibold">{t("staffPortal.eventEdit.categoriesTitle")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("staffPortal.eventEdit.categoriesSubtitle")}
        </p>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("staffPortal.eventEdit.noCategories")}
        </p>
      ) : (
        <div className="space-y-3">
          {categories.map((c) => {
            const eligibility = formatCategoryEligibility(c, t);
            return (
              <div
                key={c.id}
                className="rounded-xl border border-border p-4 space-y-3"
              >
                {editingCategoryId === c.id ? (
                  <>
                    <StaffEventCategoryFormFields
                      idPrefix={`cat-edit-${c.id}`}
                      values={categoryDraft}
                      onChange={(patch) =>
                        setCategoryDraft((d) => ({ ...d, ...patch }))
                      }
                    />
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={handleSaveCategoryEdit}>
                        {t("staffPortal.eventEdit.save")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingCategoryId(null)}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ${(c.price_cents / 100).toLocaleString(numLocale)} MXN ·{" "}
                        {c.sold_count}
                        {c.capacity != null ? ` / ${c.capacity}` : ""}{" "}
                        {t("staffPortal.dashboard.registered").toLowerCase()}
                        {Boolean(c.waitlist_enabled)
                          ? ` · ${t("staffPortal.eventEdit.waitlistOn")}`
                          : ""}
                      </p>
                      {eligibility.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {eligibility.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {c.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-2 pt-0.5">
                          {c.description}
                        </p>
                      ) : null}
                    </div>
                    {canManage ? (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditCategory(c)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() =>
                            dispatch(
                              deleteEventCategory({
                                eventId,
                                categoryId: c.id,
                                role: staffRole,
                              }),
                            )
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canManage ? (
        <div className="pt-4 border-t border-border space-y-4">
          <div>
            <h3 className="text-sm font-medium">
              {t("staffPortal.eventEdit.categoryTemplatesTitle")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("staffPortal.eventEdit.categoryTemplatesHint")}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {EVENT_CATEGORY_TEMPLATES.map((tpl) => (
                <Button
                  key={tpl.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => applyTemplate(tpl.id)}
                >
                  {t(`staffPortal.eventEdit.categoryTemplates.${tpl.nameKey}`)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium">{t("staffPortal.eventEdit.addCategory")}</h3>
            {categoryError ? (
              <p className="text-sm text-destructive mt-1">{categoryError}</p>
            ) : null}
            <div className="mt-3 space-y-3">
              <StaffEventCategoryFormFields
                idPrefix="cat-new"
                values={newCategory}
                onChange={(patch) =>
                  setNewCategory((prev) => ({ ...prev, ...patch }))
                }
                priceDisplay={newPriceMxn ? Number(newPriceMxn) : undefined}
                onPriceChange={(mxn) => setNewPriceMxn(String(mxn))}
              />
              <Button
                type="button"
                onClick={handleAddCategory}
                disabled={savingCategory || !canAdd}
                className="w-full sm:w-auto"
              >
                {savingCategory ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {t("staffPortal.eventEdit.addCategorySubmit")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
