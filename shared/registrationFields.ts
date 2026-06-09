import type { EventRegistrationField } from "@shared/api";

/** Parse organizer-defined select options from DB JSON, string, or legacy shapes. */
export function parseRegistrationFieldOptions(raw: unknown): string[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      return [];
    }
  } else {
    return [];
  }

  return list
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const v = o.value ?? o.label ?? o.text;
        return v != null ? String(v).trim() : "";
      }
      return item != null ? String(item).trim() : "";
    })
    .filter(Boolean);
}

export function isRegistrationFieldRequired(
  field: Pick<EventRegistrationField, "is_required">,
): boolean {
  return Boolean(field.is_required);
}

export function sortRegistrationFields<T extends { sort_order: number }>(
  fields: T[],
): T[] {
  return [...fields].sort((a, b) => a.sort_order - b.sort_order);
}

export type NormalizedRegistrationField = EventRegistrationField & {
  is_required: boolean;
  options_json: string[];
};

export function normalizeRegistrationField(
  field: EventRegistrationField,
): NormalizedRegistrationField {
  return {
    ...field,
    is_required: isRegistrationFieldRequired(field),
    options_json: parseRegistrationFieldOptions(field.options_json),
  };
}

export function buildRegistrationFieldInitialValues(
  fields: Pick<EventRegistrationField, "field_key" | "field_type">[],
): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const f of fields) {
    values[f.field_key] = f.field_type === "checkbox" ? false : "";
  }
  return values;
}

/** Coerce form state into the payload expected by checkout API. */
export function normalizeCheckoutFieldValues(
  values: Record<string, string | boolean>,
  fields: Pick<EventRegistrationField, "field_key" | "field_type">[],
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const field of fields) {
    const raw = values[field.field_key];
    if (field.field_type === "checkbox") {
      out[field.field_key] = raw === true || raw === "true";
    } else if (raw != null) {
      out[field.field_key] = String(raw).trim();
    }
  }
  return out;
}

export function registrationFieldValueEmpty(
  field: Pick<EventRegistrationField, "field_type">,
  raw: string | boolean | undefined | null,
): boolean {
  if (field.field_type === "checkbox") {
    return raw !== true && raw !== "true";
  }
  return raw == null || !String(raw).trim();
}

export function validateRegistrationFieldInput(
  field: {
    field_key: string;
    label: string;
    field_type: string;
    is_required: boolean | number;
    options_json?: string[];
  },
  raw: string | boolean | undefined | null,
): string | null {
  const fieldType = field.field_type;
  if (fieldType === "file") {
    if (field.is_required) {
      return `${field.label} requires file upload (not available online)`;
    }
    return null;
  }

  if (fieldType === "checkbox") {
    if (field.is_required && registrationFieldValueEmpty({ field_type: fieldType }, raw)) {
      return `${field.label} is required`;
    }
    return null;
  }

  const strVal = raw == null ? "" : String(raw).trim();
  if (field.is_required && !strVal) {
    return `${field.label} is required`;
  }

  if (!strVal) return null;

  if (fieldType === "select") {
    const opts = field.options_json ?? [];
    if (opts.length > 0 && !opts.includes(strVal)) {
      return `Invalid option for ${field.label}`;
    }
  }

  if (fieldType === "number" && strVal && !/^-?\d+(\.\d+)?$/.test(strVal)) {
    return `${field.label} must be a valid number`;
  }

  if (fieldType === "date" && strVal && !/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
    return `${field.label} must be a valid date`;
  }

  return null;
}

export function serializeRegistrationFieldValue(
  field: { field_type: string },
  raw: string | boolean | undefined | null,
): string | null {
  if (field.field_type === "checkbox") {
    return raw === true || raw === "true" ? "true" : "false";
  }
  if (raw == null) return null;
  const strVal = String(raw).trim();
  return strVal || null;
}
