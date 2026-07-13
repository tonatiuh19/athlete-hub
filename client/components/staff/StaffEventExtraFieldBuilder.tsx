import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXTRA_FIELD_TYPES,
  MAX_EXTRA_FIELDS,
  buildMxShippingTemplate,
  buildShirtFitSizeTemplates,
  buildShirtSizeTemplate,
  canAddExtraField,
  type EventExtraFieldDefinition,
} from "@shared/extraFields";
import type { EventExtraField } from "@shared/api";

interface StaffEventExtraFieldBuilderProps {
  fields: EventExtraField[];
  locked: boolean;
  onChange: (fields: EventExtraField[]) => void;
}

function toDraft(fields: EventExtraField[]): EventExtraFieldDefinition[] {
  return fields.map((f, i) => ({
    field_key: f.field_key,
    label: f.label,
    field_type: f.field_type,
    field_kind: f.field_kind ?? "standard",
    options_json: f.options_json ?? null,
    is_required: Boolean(f.is_required),
    sort_order: i,
  }));
}

export default function StaffEventExtraFieldBuilder({
  fields,
  locked,
  onChange,
}: StaffEventExtraFieldBuilderProps) {
  const { t } = useTranslation();
  const draft = toDraft(fields);
  const canAdd = canAddExtraField(draft);

  const updateField = (index: number, patch: Partial<EventExtraField>) => {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange(next);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const addField = (template?: EventExtraFieldDefinition) => {
    if (!canAdd) return;
    const base = template ?? {
      field_key: `field_${fields.length + 1}`,
      label: "",
      field_type: "text" as const,
      field_kind: "standard" as const,
      options_json: null,
      is_required: false,
      sort_order: fields.length,
    };
    onChange([
      ...fields,
      {
        ...base,
        field_key: `${base.field_key}_${fields.length + 1}`.slice(0, 80),
        sort_order: fields.length,
      },
    ]);
  };

  const addTemplates = (templates: EventExtraFieldDefinition[]) => {
    let next = [...fields];
    for (const template of templates) {
      if (!canAddExtraField(toDraft(next))) break;
      next = [
        ...next,
        {
          ...template,
          field_key: `${template.field_key}_${next.length + 1}`.slice(0, 80),
          sort_order: next.length,
        },
      ];
    }
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card/30 p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">{t("staffPortal.eventEdit.extraFieldsTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("staffPortal.eventEdit.extraFieldsHint", { max: MAX_EXTRA_FIELDS })}
        </p>
        {locked ? (
          <p className="text-xs text-destructive">{t("staffPortal.eventEdit.extraFieldsLocked")}</p>
        ) : null}
      </div>

      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("staffPortal.eventEdit.extraFieldsEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {fields.map((field, index) => (
            <li key={`${field.field_key}-${index}`} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {field.field_kind === "mx_shipping_block"
                    ? t("staffPortal.eventEdit.extraFieldShippingBlock")
                    : t("staffPortal.eventEdit.extraFieldItem", { index: index + 1 })}
                </p>
                {!locked && field.field_kind !== "mx_shipping_block" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeField(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">{t("staffPortal.eventEdit.extraFieldLabel")}</Label>
                  <Input
                    value={field.label}
                    disabled={locked}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                  />
                </div>

                {field.field_kind !== "mx_shipping_block" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">{t("staffPortal.eventEdit.extraFieldType")}</Label>
                    <Select
                      value={field.field_type}
                      disabled={locked}
                      onValueChange={(v) =>
                        updateField(index, {
                          field_type: v as EventExtraField["field_type"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXTRA_FIELD_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`staffPortal.eventEdit.extraFieldTypes.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 pt-5">
                  <Checkbox
                    id={`extra-required-${index}`}
                    checked={Boolean(field.is_required)}
                    disabled={locked}
                    onCheckedChange={(checked) =>
                      updateField(index, { is_required: checked === true })
                    }
                  />
                  <Label htmlFor={`extra-required-${index}`} className="text-xs font-normal">
                    {t("staffPortal.eventEdit.fieldRequired")}
                  </Label>
                </div>

                {field.field_type === "select" && field.field_kind !== "mx_shipping_block" ? (
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">{t("staffPortal.eventEdit.extraFieldOptions")}</Label>
                    <Input
                      disabled={locked}
                      value={(field.options_json ?? []).join(", ")}
                      onChange={(e) =>
                        updateField(index, {
                          options_json: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder={t("staffPortal.eventEdit.extraFieldOptionsPlaceholder")}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!locked ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!canAdd} onClick={() => addField()}>
            <Plus className="h-4 w-4 mr-1" />
            {t("staffPortal.eventEdit.extraFieldAdd")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canAdd}
            onClick={() => addField(buildMxShippingTemplate(t("staffPortal.eventEdit.extraFieldShippingBlock")))}
          >
            {t("staffPortal.eventEdit.extraFieldAddShipping")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canAdd}
            onClick={() => addField(buildShirtSizeTemplate())}
          >
            {t("staffPortal.eventEdit.extraFieldAddShirtSize")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canAddExtraField(toDraft([...fields, ...buildShirtFitSizeTemplates()]))}
            onClick={() => addTemplates(buildShirtFitSizeTemplates())}
          >
            {t("staffPortal.eventEdit.extraFieldAddShirtFit")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
