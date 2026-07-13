import {
  parseRegistrationFieldOptions,
  registrationFieldValueEmpty,
  serializeRegistrationFieldValue,
  validateRegistrationFieldInput,
} from "./registrationFields.js";
import type { EventExtra } from "./api.js";

export function isExtraVisibleForCategory(
  extra: Pick<EventExtra, "scope_type" | "category_ids">,
  categoryId: number,
): boolean {
  const scope = extra.scope_type ?? "all_categories";
  if (scope === "all_categories") return true;
  return (extra.category_ids ?? []).includes(categoryId);
}

export function filterExtrasForCategory(extras: EventExtra[], categoryId: number): EventExtra[] {
  return extras.filter((extra) => isExtraVisibleForCategory(extra, categoryId));
}

export const EXTRA_FIELD_TYPES = [
  "text",
  "textarea",
  "select",
  "checkbox",
  "number",
  "date",
] as const;

export type ExtraFieldType = (typeof EXTRA_FIELD_TYPES)[number];

export type ExtraFieldKind = "standard" | "mx_shipping_block";

export const MAX_EXTRA_FIELDS = 5;

export const MX_SHIPPING_FIELD_KEY = "mx_shipping";

export interface MxShippingValue {
  street?: string;
  ext?: string;
  int?: string;
  colonia?: string;
  postal_code?: string;
  state_id?: number | null;
  geo_city_id?: number | null;
  city?: string;
  state?: string;
  references?: string;
}

export interface EventExtraFieldDefinition {
  id?: number;
  field_key: string;
  label: string;
  field_type: ExtraFieldType;
  field_kind?: ExtraFieldKind;
  options_json?: string[] | null;
  is_required: boolean | number;
  sort_order: number;
}

export function isValidExtraFieldType(value: unknown): value is ExtraFieldType {
  return typeof value === "string" && EXTRA_FIELD_TYPES.includes(value as ExtraFieldType);
}

export function extraFieldBudgetUsed(
  fields: Pick<EventExtraFieldDefinition, "field_kind">[],
): number {
  return fields.length;
}

export function canAddExtraField(
  fields: Pick<EventExtraFieldDefinition, "field_kind">[],
): boolean {
  return extraFieldBudgetUsed(fields) < MAX_EXTRA_FIELDS;
}

export function normalizeExtraFieldInput(
  raw: Record<string, unknown>,
  index: number,
): EventExtraFieldDefinition | null {
  const field_kind: ExtraFieldKind =
    raw.field_kind === "mx_shipping_block" ? "mx_shipping_block" : "standard";
  const field_key =
    field_kind === "mx_shipping_block"
      ? MX_SHIPPING_FIELD_KEY
      : String(raw.field_key ?? `field_${index + 1}`)
          .trim()
          .slice(0, 80);
  const label = String(raw.label ?? "").trim().slice(0, 200);
  if (!label) return null;

  const field_type =
    field_kind === "mx_shipping_block"
      ? "textarea"
      : isValidExtraFieldType(raw.field_type)
        ? raw.field_type
        : "text";

  const options_json =
    field_type === "select"
      ? parseRegistrationFieldOptions(raw.options_json)
      : null;

  return {
    field_key,
    label,
    field_type,
    field_kind,
    options_json,
    is_required: Boolean(raw.is_required),
    sort_order: Number(raw.sort_order) || index,
  };
}

export function validateExtraFieldDefinitions(
  fields: EventExtraFieldDefinition[],
): string | null {
  if (fields.length > MAX_EXTRA_FIELDS) {
    return `Maximum ${MAX_EXTRA_FIELDS} fields per add-on`;
  }
  const keys = new Set<string>();
  for (const field of fields) {
    if (keys.has(field.field_key)) {
      return `Duplicate field key: ${field.field_key}`;
    }
    keys.add(field.field_key);
    if (field.field_type === "select") {
      const opts = field.options_json ?? [];
      if (opts.length < 2) {
        return `${field.label} needs at least two select options`;
      }
    }
  }
  return null;
}

function mxShippingEmpty(value: MxShippingValue | null | undefined): boolean {
  if (!value) return true;
  const requiredParts = [
    value.street,
    value.colonia,
    value.postal_code,
    value.city,
    value.state,
  ];
  return requiredParts.every((p) => !String(p ?? "").trim());
}

export function validateMxShippingValue(
  label: string,
  required: boolean,
  raw: unknown,
): string | null {
  let value: MxShippingValue | null = null;
  if (raw && typeof raw === "object") {
    value = raw as MxShippingValue;
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      value = JSON.parse(raw) as MxShippingValue;
    } catch {
      return `${label} is invalid`;
    }
  }
  if (required && mxShippingEmpty(value)) {
    return `${label} is required`;
  }
  if (!value || mxShippingEmpty(value)) return null;
  if (!String(value.street ?? "").trim()) return `${label}: street is required`;
  if (!String(value.colonia ?? "").trim()) return `${label}: neighborhood is required`;
  if (!String(value.postal_code ?? "").trim()) return `${label}: postal code is required`;
  if (!String(value.city ?? "").trim() || !String(value.state ?? "").trim()) {
    return `${label}: city and state are required`;
  }
  return null;
}

export function validateExtraFieldAnswers(
  fields: EventExtraFieldDefinition[],
  answers: Record<string, unknown> | undefined,
): string | null {
  const values = answers ?? {};
  for (const field of fields) {
    if (field.field_kind === "mx_shipping_block") {
      const err = validateMxShippingValue(
        field.label,
        Boolean(field.is_required),
        values[field.field_key],
      );
      if (err) return err;
      continue;
    }
    const opts = field.options_json ?? [];
    const err = validateRegistrationFieldInput(
      {
        field_key: field.field_key,
        label: field.label,
        field_type: field.field_type,
        is_required: field.is_required,
        options_json: opts,
      },
      values[field.field_key] as string | boolean | undefined,
    );
    if (err) return err;
  }
  return null;
}

export function serializeExtraFieldAnswer(
  field: EventExtraFieldDefinition,
  raw: unknown,
): { value_text: string | null; value_json: MxShippingValue | null } {
  if (field.field_kind === "mx_shipping_block") {
    if (!raw || typeof raw !== "object") {
      return { value_text: null, value_json: null };
    }
    const v = raw as MxShippingValue;
    const summary = [
      v.street,
      v.ext ? `Ext ${v.ext}` : null,
      v.int ? `Int ${v.int}` : null,
      v.colonia,
      v.postal_code,
      v.city,
      v.state,
      v.references,
    ]
      .filter(Boolean)
      .join(", ");
    return { value_text: summary || null, value_json: v };
  }
  const text = serializeRegistrationFieldValue(
    { field_type: field.field_type },
    raw as string | boolean | undefined,
  );
  return { value_text: text, value_json: null };
}

export function formatExtraFieldAnswerDisplay(
  field: Pick<EventExtraFieldDefinition, "field_kind" | "field_type">,
  value_text: string | null,
  value_json: unknown,
): string {
  if (field.field_kind === "mx_shipping_block" && value_json && typeof value_json === "object") {
    return (
      value_text ||
      formatMxShippingSummary(value_json as MxShippingValue) ||
      "—"
    );
  }
  if (field.field_type === "checkbox") {
    return value_text === "true" ? "Yes" : value_text === "false" ? "No" : "—";
  }
  return value_text?.trim() || "—";
}

export function formatMxShippingSummary(value: MxShippingValue): string {
  return [
    value.street,
    value.ext ? `Ext ${value.ext}` : null,
    value.int ? `Int ${value.int}` : null,
    value.colonia,
    `CP ${value.postal_code}`,
    [value.city, value.state].filter(Boolean).join(", "),
    value.references,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function buildMxShippingTemplate(label = "Shipping address"): EventExtraFieldDefinition {
  return {
    field_key: MX_SHIPPING_FIELD_KEY,
    label,
    field_type: "textarea",
    field_kind: "mx_shipping_block",
    options_json: null,
    is_required: false,
    sort_order: 0,
  };
}

export function buildShirtSizeTemplate(label = "T-shirt size"): EventExtraFieldDefinition {
  return {
    field_key: "shirt_size",
    label,
    field_type: "select",
    field_kind: "standard",
    options_json: ["XS", "S", "M", "L", "XL", "XXL"],
    is_required: true,
    sort_order: 0,
  };
}

export function buildShirtFitSizeTemplates(): EventExtraFieldDefinition[] {
  return [
    {
      field_key: "shirt_fit",
      label: "Shirt fit",
      field_type: "select",
      field_kind: "standard",
      options_json: ["Men", "Women", "Unisex"],
      is_required: true,
      sort_order: 0,
    },
    {
      field_key: "shirt_size",
      label: "T-shirt size",
      field_type: "select",
      field_kind: "standard",
      options_json: ["XS", "S", "M", "L", "XL", "XXL"],
      is_required: true,
      sort_order: 1,
    },
  ];
}

export function emptyMxShippingValue(): MxShippingValue {
  return {
    street: "",
    ext: "",
    int: "",
    colonia: "",
    postal_code: "",
    state_id: null,
    geo_city_id: null,
    city: "",
    state: "",
    references: "",
  };
}

export function buildExtraFieldInitialValues(
  fields: EventExtraFieldDefinition[],
): Record<string, string | boolean | MxShippingValue> {
  const values: Record<string, string | boolean | MxShippingValue> = {};
  for (const field of fields) {
    if (field.field_kind === "mx_shipping_block") {
      values[field.field_key] = emptyMxShippingValue();
    } else if (field.field_type === "checkbox") {
      values[field.field_key] = false;
    } else {
      values[field.field_key] = "";
    }
  }
  return values;
}

export function prefillExtraFieldsFromProfile(
  fields: EventExtraFieldDefinition[],
  profile: {
    shirt_size?: string | null;
    city?: string | null;
    state?: string | null;
    geo_city_id?: number | null;
    state_id?: number | null;
  },
): Record<string, string | boolean | MxShippingValue> {
  const values = buildExtraFieldInitialValues(fields);
  for (const field of fields) {
    if (field.field_key === "shirt_size" && profile.shirt_size) {
      values[field.field_key] = profile.shirt_size;
    }
    if (field.field_kind === "mx_shipping_block") {
      const shipping = values[field.field_key] as MxShippingValue;
      if (profile.city) shipping.city = profile.city;
      if (profile.state) shipping.state = profile.state;
      if (profile.geo_city_id != null) shipping.geo_city_id = profile.geo_city_id;
      if (profile.state_id != null) shipping.state_id = profile.state_id;
    }
  }
  return values;
}
