import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StaffEventCategoryPatch } from "@shared/api";

export type CategoryFormValues = StaffEventCategoryPatch & {
  name?: string;
  price_cents?: number;
};

export interface StaffEventCategoryFormFieldsProps {
  values: CategoryFormValues;
  onChange: (patch: Partial<CategoryFormValues>) => void;
  idPrefix: string;
  showPrice?: boolean;
  priceDisplay?: number;
  onPriceChange?: (priceMxn: number) => void;
}

const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;
const GENDERS = ["any", "male", "female"] as const;

export default function StaffEventCategoryFormFields({
  values,
  onChange,
  idPrefix,
  showPrice = true,
  priceDisplay,
  onPriceChange,
}: StaffEventCategoryFormFieldsProps) {
  const { t } = useTranslation();

  const priceMxn =
    priceDisplay ??
    (values.price_cents != null ? values.price_cents / 100 : undefined);

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2 space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>
          {t("staffPortal.eventEdit.categoryName")} *
        </Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.name ?? ""}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("staffPortal.eventEdit.categoryNamePlaceholder")}
        />
      </div>

      {showPrice ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-price`}>
            {t("staffPortal.eventEdit.categoryPrice")} *
          </Label>
          <Input
            id={`${idPrefix}-price`}
            type="number"
            min={0}
            step={0.01}
            value={priceMxn ?? ""}
            onChange={(e) => {
              const mxn = Number(e.target.value);
              if (onPriceChange) {
                onPriceChange(mxn);
              } else {
                onChange({
                  price_cents: Number.isFinite(mxn)
                    ? Math.round(mxn * 100)
                    : undefined,
                });
              }
            }}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-distance`}>
          {t("staffPortal.eventEdit.categoryDistance")}
        </Label>
        <Input
          id={`${idPrefix}-distance`}
          type="number"
          min={0}
          step={0.01}
          value={values.distance_km ?? ""}
          onChange={(e) =>
            onChange({
              distance_km: e.target.value ? Number(e.target.value) : null,
            })
          }
          placeholder="21"
        />
        <p className="text-xs text-muted-foreground">
          {t("staffPortal.eventEdit.categoryDistanceHint")}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-capacity`}>
          {t("staffPortal.eventEdit.categoryCapacity")}
        </Label>
        <Input
          id={`${idPrefix}-capacity`}
          type="number"
          min={0}
          value={values.capacity ?? ""}
          onChange={(e) =>
            onChange({
              capacity: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          {t("staffPortal.eventEdit.categoryCapacityHint")}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-gender`}>
          {t("staffPortal.eventEdit.categoryGenderLabel")}
        </Label>
        <Select
          value={values.gender_restriction ?? "any"}
          onValueChange={(v) => onChange({ gender_restriction: v })}
        >
          <SelectTrigger id={`${idPrefix}-gender`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GENDERS.map((g) => (
              <SelectItem key={g} value={g}>
                {t(`staffPortal.eventEdit.categoryGender.${g}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t("staffPortal.eventEdit.categoryGenderHint")}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-difficulty`}>
          {t("staffPortal.eventEdit.categoryDifficultyLabel")}
        </Label>
        <Select
          value={values.difficulty ?? "none"}
          onValueChange={(v) =>
            onChange({ difficulty: v === "none" ? null : v })
          }
        >
          <SelectTrigger id={`${idPrefix}-difficulty`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              {t("staffPortal.eventEdit.categoryDifficulty.none")}
            </SelectItem>
            {DIFFICULTIES.map((d) => (
              <SelectItem key={d} value={d}>
                {t(`staffPortal.eventEdit.categoryDifficulty.${d}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-min-age`}>
          {t("staffPortal.eventEdit.categoryMinAge")}
        </Label>
        <Input
          id={`${idPrefix}-min-age`}
          type="number"
          min={0}
          max={120}
          value={values.min_age ?? ""}
          onChange={(e) =>
            onChange({
              min_age: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-max-age`}>
          {t("staffPortal.eventEdit.categoryMaxAge")}
        </Label>
        <Input
          id={`${idPrefix}-max-age`}
          type="number"
          min={0}
          max={120}
          value={values.max_age ?? ""}
          onChange={(e) =>
            onChange({
              max_age: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {t("staffPortal.eventEdit.categoryAgeHint")}
        </p>
      </div>

      <div className="sm:col-span-2 space-y-1.5">
        <Label htmlFor={`${idPrefix}-description`}>
          {t("staffPortal.eventEdit.categoryDescription")}
        </Label>
        <Textarea
          id={`${idPrefix}-description`}
          rows={2}
          value={values.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value || null })}
          placeholder={t("staffPortal.eventEdit.categoryDescriptionPlaceholder")}
        />
      </div>

      <label className="sm:col-span-2 flex items-center gap-2 text-sm">
        <Checkbox
          checked={Boolean(values.waitlist_enabled)}
          onCheckedChange={(checked) =>
            onChange({ waitlist_enabled: checked === true })
          }
        />
        {t("staffPortal.eventEdit.categoryWaitlist")}
      </label>

      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor={`${idPrefix}-reg-opens`}>
          {t("staffPortal.eventEdit.categoryRegOpens")}
        </Label>
        <Input
          id={`${idPrefix}-reg-opens`}
          type="datetime-local"
          value={
            typeof values.registration_opens_at === "string"
              ? values.registration_opens_at
              : ""
          }
          onChange={(e) =>
            onChange({ registration_opens_at: e.target.value || null })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor={`${idPrefix}-reg-closes`}>
          {t("staffPortal.eventEdit.categoryRegCloses")}
        </Label>
        <Input
          id={`${idPrefix}-reg-closes`}
          type="datetime-local"
          value={
            typeof values.registration_closes_at === "string"
              ? values.registration_closes_at
              : ""
          }
          onChange={(e) =>
            onChange({ registration_closes_at: e.target.value || null })
          }
        />
      </div>
    </div>
  );
}
