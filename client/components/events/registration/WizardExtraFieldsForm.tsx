import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import GeoCitySelector from "@/components/geo/GeoCitySelector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildExtraFieldInitialValues,
  emptyMxShippingValue,
  prefillExtraFieldsFromProfile,
  type MxShippingValue,
} from "@shared/extraFields";
import type { EventExtraField } from "@shared/api";

export type ExtraFieldValues = Record<string, string | boolean | MxShippingValue>;

interface WizardExtraFieldsFormProps {
  extraId: number;
  fields: EventExtraField[];
  values: ExtraFieldValues;
  profilePrefill?: {
    shirt_size?: string | null;
    city?: string | null;
    state?: string | null;
    geo_city_id?: number | null;
    state_id?: number | null;
  };
  onChange: (extraId: number, values: ExtraFieldValues) => void;
}

export default function WizardExtraFieldsForm({
  extraId,
  fields,
  values,
  profilePrefill,
  onChange,
}: WizardExtraFieldsFormProps) {
  const { t } = useTranslation();
  const [local, setLocal] = useState<ExtraFieldValues>(values);

  useEffect(() => {
    setLocal(values);
  }, [values, extraId]);

  const commit = (next: ExtraFieldValues) => {
    setLocal(next);
    onChange(extraId, next);
  };

  const applyProfile = () => {
    if (!profilePrefill) return;
    const next = prefillExtraFieldsFromProfile(fields, profilePrefill);
    commit({ ...local, ...next });
  };

  if (!fields.length) return null;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {t("registrationWizard.extras.questionsTitle")}
        </p>
        {profilePrefill ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={applyProfile}>
            {t("registrationWizard.extras.useProfile")}
          </Button>
        ) : null}
      </div>

      {fields.map((field) => {
        if (field.field_kind === "mx_shipping_block") {
          const shipping = (local[field.field_key] as MxShippingValue) ?? emptyMxShippingValue();
          return (
            <div key={field.field_key} className="space-y-2">
              <Label className="text-xs">
                {field.label}
                {field.is_required ? " *" : ""}
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder={t("registrationWizard.extras.shipping.street")}
                  value={shipping.street ?? ""}
                  onChange={(e) =>
                    commit({
                      ...local,
                      [field.field_key]: { ...shipping, street: e.target.value },
                    })
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder={t("registrationWizard.extras.shipping.ext")}
                    value={shipping.ext ?? ""}
                    onChange={(e) =>
                      commit({
                        ...local,
                        [field.field_key]: { ...shipping, ext: e.target.value },
                      })
                    }
                  />
                  <Input
                    placeholder={t("registrationWizard.extras.shipping.int")}
                    value={shipping.int ?? ""}
                    onChange={(e) =>
                      commit({
                        ...local,
                        [field.field_key]: { ...shipping, int: e.target.value },
                      })
                    }
                  />
                </div>
                <Input
                  className="sm:col-span-2"
                  placeholder={t("registrationWizard.extras.shipping.colonia")}
                  value={shipping.colonia ?? ""}
                  onChange={(e) =>
                    commit({
                      ...local,
                      [field.field_key]: { ...shipping, colonia: e.target.value },
                    })
                  }
                />
                <Input
                  placeholder={t("registrationWizard.extras.shipping.postalCode")}
                  value={shipping.postal_code ?? ""}
                  onChange={(e) =>
                    commit({
                      ...local,
                      [field.field_key]: { ...shipping, postal_code: e.target.value },
                    })
                  }
                />
                <div className="sm:col-span-2">
                  <GeoCitySelector
                    stateId={shipping.state_id ?? null}
                    cityId={shipping.geo_city_id ?? null}
                    cityName={shipping.city ?? ""}
                    stateName={shipping.state ?? ""}
                    onChange={(sel) =>
                      commit({
                        ...local,
                        [field.field_key]: {
                          ...shipping,
                          state_id: sel.stateId,
                          geo_city_id: sel.geoCityId,
                          city: sel.city,
                          state: sel.state,
                        },
                      })
                    }
                  />
                </div>
                <Textarea
                  className="sm:col-span-2"
                  rows={2}
                  placeholder={t("registrationWizard.extras.shipping.references")}
                  value={shipping.references ?? ""}
                  onChange={(e) =>
                    commit({
                      ...local,
                      [field.field_key]: { ...shipping, references: e.target.value },
                    })
                  }
                />
              </div>
            </div>
          );
        }

        const raw = local[field.field_key];

        if (field.field_type === "checkbox") {
          return (
            <label key={field.field_key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={raw === true}
                onCheckedChange={(checked) =>
                  commit({ ...local, [field.field_key]: checked === true })
                }
              />
              <span>
                {field.label}
                {field.is_required ? " *" : ""}
              </span>
            </label>
          );
        }

        if (field.field_type === "select") {
          return (
            <div key={field.field_key} className="space-y-1">
              <Label className="text-xs">
                {field.label}
                {field.is_required ? " *" : ""}
              </Label>
              <Select
                value={String(raw ?? "")}
                onValueChange={(v) => commit({ ...local, [field.field_key]: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("registrationWizard.extras.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(field.options_json ?? []).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (field.field_type === "textarea") {
          return (
            <div key={field.field_key} className="space-y-1">
              <Label className="text-xs">
                {field.label}
                {field.is_required ? " *" : ""}
              </Label>
              <Textarea
                rows={2}
                value={String(raw ?? "")}
                onChange={(e) => commit({ ...local, [field.field_key]: e.target.value })}
              />
            </div>
          );
        }

        return (
          <div key={field.field_key} className="space-y-1">
            <Label className="text-xs">
              {field.label}
              {field.is_required ? " *" : ""}
            </Label>
            <Input
              type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
              value={String(raw ?? "")}
              onChange={(e) => commit({ ...local, [field.field_key]: e.target.value })}
            />
          </div>
        );
      })}
    </div>
  );
}

export function buildInitialExtraFieldAnswers(
  fields: EventExtraField[],
): ExtraFieldValues {
  return buildExtraFieldInitialValues(fields);
}
