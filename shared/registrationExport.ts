/** Dynamic registration export — stable column IDs for catalog + CSV. */

export const REGISTRATION_EXPORT_MAX_ROWS = 15_000;
export const REGISTRATION_EXPORT_MAX_COLUMNS = 200;

export const REGISTRATION_EXPORT_STATUSES = [
  "confirmed",
  "pending_payment",
  "cancelled",
  "transferred",
  "refunded",
] as const;

export type RegistrationExportStatus = (typeof REGISTRATION_EXPORT_STATUSES)[number];

export const REGISTRATION_EXPORT_CORE_COLUMNS = [
  { id: "core.folio", defaultIn: ["essentials", "race_day", "logistics"] },
  { id: "core.bib", defaultIn: ["essentials", "race_day", "logistics"] },
  { id: "core.first_name", defaultIn: ["essentials", "race_day", "logistics"] },
  { id: "core.last_name", defaultIn: ["essentials", "race_day", "logistics"] },
  { id: "core.email", defaultIn: ["essentials", "logistics"] },
  { id: "core.phone", defaultIn: ["logistics"] },
  { id: "core.date_of_birth", defaultIn: ["logistics"] },
  { id: "core.gender", defaultIn: ["logistics"] },
  { id: "core.shirt_size", defaultIn: ["logistics"] },
  { id: "core.category", defaultIn: ["essentials", "race_day", "logistics"] },
  { id: "core.status", defaultIn: ["essentials", "logistics"] },
  { id: "core.total_mxn", defaultIn: ["essentials"] },
  { id: "core.price_mxn", defaultIn: [] },
  { id: "core.fee_mxn", defaultIn: [] },
  { id: "core.source", defaultIn: [] },
  { id: "core.waiver", defaultIn: ["race_day"] },
  { id: "core.checked_in", defaultIn: ["race_day"] },
  { id: "core.purchaser_name", defaultIn: [] },
  { id: "core.purchaser_email", defaultIn: [] },
  { id: "core.managed", defaultIn: [] },
  { id: "core.claim_pending", defaultIn: [] },
  { id: "core.created_at", defaultIn: [] },
] as const;

export type RegistrationExportCoreColumnId =
  (typeof REGISTRATION_EXPORT_CORE_COLUMNS)[number]["id"];

export type RegistrationExportPresetId = "essentials" | "race_day" | "logistics" | "full";

export type RegistrationExportColumnKind =
  | "core"
  | "field"
  | "extra_qty"
  | "extra_total"
  | "extra_field";

export interface RegistrationExportColumnMeta {
  id: string;
  kind: RegistrationExportColumnKind;
  label: string;
  /** Parent group for UI */
  group_id: string;
  group_label: string;
  /** Extra type when kind is extra_* */
  extra_type?: string | null;
  description?: string | null;
}

export interface RegistrationExportCatalogResponse {
  event_id: number;
  event_title: string;
  event_slug: string;
  columns: RegistrationExportColumnMeta[];
  presets: Array<{
    id: RegistrationExportPresetId;
    column_ids: string[];
  }>;
  default_statuses: RegistrationExportStatus[];
}

export interface RegistrationExportRequest {
  columns: string[];
  statuses?: string[];
  q?: string;
  format?: "csv" | "json";
}

export interface RegistrationExportJsonResponse {
  event_id: number;
  event_title: string;
  headers: string[];
  column_ids: string[];
  row_count: number;
  rows: string[][];
}

export type ParsedExportColumnId =
  | { kind: "core"; key: string }
  | { kind: "field"; fieldId: number }
  | { kind: "extra_qty"; extraId: number }
  | { kind: "extra_total"; extraId: number }
  | { kind: "extra_field"; extraId: number; fieldKey: string };

export function parseExportColumnId(id: string): ParsedExportColumnId | null {
  const raw = String(id ?? "").trim();
  if (!raw) return null;

  if (raw.startsWith("core.")) {
    const key = raw.slice("core.".length);
    if (!key) return null;
    return { kind: "core", key };
  }

  if (raw.startsWith("field.")) {
    const fieldId = Number(raw.slice("field.".length));
    if (!Number.isFinite(fieldId) || fieldId <= 0) return null;
    return { kind: "field", fieldId };
  }

  const extraField = /^extra\.(\d+)\.field\.(.+)$/.exec(raw);
  if (extraField) {
    const extraId = Number(extraField[1]);
    const fieldKey = extraField[2];
    if (!Number.isFinite(extraId) || extraId <= 0 || !fieldKey) return null;
    return { kind: "extra_field", extraId, fieldKey };
  }

  const extraQty = /^extra\.(\d+)\.qty$/.exec(raw);
  if (extraQty) {
    const extraId = Number(extraQty[1]);
    if (!Number.isFinite(extraId) || extraId <= 0) return null;
    return { kind: "extra_qty", extraId };
  }

  const extraTotal = /^extra\.(\d+)\.total_mxn$/.exec(raw);
  if (extraTotal) {
    const extraId = Number(extraTotal[1]);
    if (!Number.isFinite(extraId) || extraId <= 0) return null;
    return { kind: "extra_total", extraId };
  }

  return null;
}

export function fieldExportColumnId(fieldId: number): string {
  return `field.${fieldId}`;
}

export function extraQtyColumnId(extraId: number): string {
  return `extra.${extraId}.qty`;
}

export function extraTotalColumnId(extraId: number): string {
  return `extra.${extraId}.total_mxn`;
}

export function extraFieldColumnId(extraId: number, fieldKey: string): string {
  return `extra.${extraId}.field.${fieldKey}`;
}

export function coreColumnIdsForPreset(preset: RegistrationExportPresetId): string[] {
  if (preset === "full") {
    return REGISTRATION_EXPORT_CORE_COLUMNS.map((c) => c.id);
  }
  return REGISTRATION_EXPORT_CORE_COLUMNS.filter((c) =>
    (c.defaultIn as readonly string[]).includes(preset),
  ).map((c) => c.id);
}

export function formatCentsAsMxn(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(Number(cents))) return "";
  return (Number(cents) / 100).toFixed(2);
}

export function formatExportYesNo(value: unknown): string {
  return value ? "yes" : "no";
}

export function formatExtraAnswerValue(
  valueText: string | null | undefined,
  valueJson: unknown,
): string {
  const text = valueText != null ? String(valueText).trim() : "";
  if (text) return text;
  if (valueJson == null) return "";
  let obj: Record<string, unknown> | null = null;
  if (typeof valueJson === "string") {
    try {
      obj = JSON.parse(valueJson) as Record<string, unknown>;
    } catch {
      return valueJson;
    }
  } else if (typeof valueJson === "object") {
    obj = valueJson as Record<string, unknown>;
  }
  if (!obj) return "";
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v == null ? "" : String(v)}`)
    .join("; ");
}

export function rowsToCsv(headers: string[], rows: string[][]): string {
  const escape = (cell: string) => {
    const v = cell ?? "";
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return `\uFEFF${lines.join("\n")}`;
}
