import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { EventExtraScopeType } from "../shared/api.js";
import { parseRegistrationFieldOptions } from "../shared/registrationFields.js";

export type RegistrationFieldRouteError = {
  status: number;
  error: string;
  code?: string;
};

const VALID_FIELD_TYPES = new Set([
  "text",
  "textarea",
  "select",
  "checkbox",
  "number",
  "date",
  "file",
]);

const FIELD_SELECT = `id, field_key, label, field_type, options_json, is_required, sort_order, is_active, scope_type`;

export function fieldKeyFromLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return slug || "field";
}

type DbConn = Pool | PoolConnection;

async function fetchCategoryIdsByFieldIds(
  executor: DbConn,
  fieldIds: number[],
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (fieldIds.length === 0) return map;
  const placeholders = fieldIds.map(() => "?").join(", ");
  const [rows] = await executor.query<RowDataPacket[]>(
    `SELECT event_registration_field_id, event_category_id
     FROM event_registration_field_categories
     WHERE event_registration_field_id IN (${placeholders})`,
    fieldIds,
  );
  for (const row of rows) {
    const fieldId = Number(row.event_registration_field_id);
    const list = map.get(fieldId) ?? [];
    list.push(Number(row.event_category_id));
    map.set(fieldId, list);
  }
  return map;
}

function enrichFieldRows(
  rows: RowDataPacket[],
  categoriesByField: Map<number, number[]>,
): RowDataPacket[] {
  return rows.map((row) => {
    const id = Number(row.id);
    const fromJoin = categoriesByField.get(id) ?? [];
    const existing = Array.isArray(row.category_ids)
      ? (row.category_ids as unknown[]).map((value) => Number(value)).filter((value) => value > 0)
      : [];
    return {
      ...row,
      scope_type: String(row.scope_type ?? "all_categories"),
      category_ids: fromJoin.length > 0 ? fromJoin : existing,
      options_json: parseRegistrationFieldOptions(row.options_json),
    };
  });
}

export async function fetchStaffRegistrationFields(
  pool: DbConn,
  eventId: number,
): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${FIELD_SELECT}
     FROM event_registration_fields
     WHERE event_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [eventId],
  );
  const ids = rows.map((row) => Number(row.id));
  const categoriesByField = await fetchCategoryIdsByFieldIds(pool, ids);
  return enrichFieldRows(rows, categoriesByField);
}

export async function fetchActiveRegistrationFieldsForEvent(
  pool: DbConn,
  eventId: number,
): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${FIELD_SELECT}
     FROM event_registration_fields
     WHERE event_id = ? AND is_active = 1
     ORDER BY sort_order ASC, id ASC`,
    [eventId],
  );
  const ids = rows.map((row) => Number(row.id));
  const categoriesByField = await fetchCategoryIdsByFieldIds(pool, ids);
  return enrichFieldRows(rows, categoriesByField);
}

export async function fetchRegistrationFieldsForCategory(
  pool: DbConn,
  eventId: number,
  categoryId: number,
): Promise<RowDataPacket[]> {
  const fields = await fetchActiveRegistrationFieldsForEvent(pool, eventId);
  return fields.filter((row) => {
    const scope = String(row.scope_type ?? "all_categories");
    if (scope === "all_categories") return true;
    const categoryIds = (row.category_ids as number[]) ?? [];
    return categoryIds.includes(categoryId);
  });
}

type ParsedRegistrationFieldInput = {
  field_key: string;
  label: string;
  field_type: string;
  options_json: string | null;
  is_required: number;
  sort_order: number;
  is_active: number;
  scope_type: EventExtraScopeType;
  category_ids: number[];
};

function parseScopeType(raw: unknown): EventExtraScopeType {
  return raw === "selected_categories" ? "selected_categories" : "all_categories";
}

function parseRegistrationFieldInput(
  raw: Record<string, unknown>,
  index: number,
): ParsedRegistrationFieldInput | null {
  const label = String(raw.label ?? "").trim();
  if (!label) return null;
  const field_type = String(raw.field_type ?? "text");
  if (!VALID_FIELD_TYPES.has(field_type)) return null;
  const field_key = String(raw.field_key ?? "").trim() || fieldKeyFromLabel(label);
  const options = Array.isArray(raw.options)
    ? raw.options.map((o) => String(o).trim()).filter(Boolean)
    : null;
  const scope_type = parseScopeType(raw.scope_type);
  const category_ids = Array.isArray(raw.category_ids)
    ? [...new Set(raw.category_ids.map((id) => Number(id)).filter((id) => id > 0))]
    : [];
  return {
    field_key: field_key.slice(0, 80),
    label: label.slice(0, 200),
    field_type,
    options_json: options?.length ? JSON.stringify(options) : null,
    is_required: raw.is_required ? 1 : 0,
    sort_order: Number(raw.sort_order) || index,
    is_active: raw.is_active === false ? 0 : 1,
    scope_type,
    category_ids,
  };
}

async function syncRegistrationFieldCategories(
  executor: DbConn,
  fieldId: number,
  eventId: number,
  scopeType: EventExtraScopeType,
  categoryIds: number[],
): Promise<RegistrationFieldRouteError | null> {
  await executor.query<ResultSetHeader>(
    "DELETE FROM event_registration_field_categories WHERE event_registration_field_id = ?",
    [fieldId],
  );
  if (scopeType !== "selected_categories") return null;
  if (categoryIds.length === 0) {
    return { status: 400, error: "Select at least one category" };
  }
  const placeholders = categoryIds.map(() => "?").join(", ");
  const [valid] = await executor.query<RowDataPacket[]>(
    `SELECT id FROM event_categories
     WHERE event_id = ? AND is_active = 1 AND id IN (${placeholders})`,
    [eventId, ...categoryIds],
  );
  if (valid.length !== categoryIds.length) {
    return { status: 400, error: "Invalid category selection" };
  }
  for (const categoryId of categoryIds) {
    await executor.query<ResultSetHeader>(
      `INSERT INTO event_registration_field_categories
       (event_registration_field_id, event_category_id) VALUES (?,?)`,
      [fieldId, categoryId],
    );
  }
  return null;
}

export async function replaceEventRegistrationFields(
  pool: Pool,
  eventId: number,
  rawFields: unknown[],
): Promise<
  | { ok: true; fields: RowDataPacket[] }
  | { ok: false; error: RegistrationFieldRouteError }
> {
  if (!Array.isArray(rawFields)) {
    return { ok: false, error: { status: 400, error: "fields array required" } };
  }

  const fields = rawFields
    .map((item, index) =>
      item && typeof item === "object"
        ? parseRegistrationFieldInput(item as Record<string, unknown>, index)
        : null,
    )
    .filter(Boolean) as ParsedRegistrationFieldInput[];

  for (const field of fields) {
    if (field.scope_type === "selected_categories" && field.category_ids.length === 0) {
      return { ok: false, error: { status: 400, error: "Select at least one category" } };
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM event_registration_fields WHERE event_id = ?", [eventId]);
    for (const field of fields) {
      const [ins] = await conn.query<ResultSetHeader>(
        `INSERT INTO event_registration_fields (
           event_id, field_key, label, field_type, options_json, is_required, sort_order, is_active, scope_type
         ) VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          eventId,
          field.field_key,
          field.label,
          field.field_type,
          field.options_json,
          field.is_required,
          field.sort_order,
          field.is_active,
          field.scope_type,
        ],
      );
      const fieldId = ins.insertId;
      const catErr = await syncRegistrationFieldCategories(
        conn,
        fieldId,
        eventId,
        field.scope_type,
        field.category_ids,
      );
      if (catErr) {
        await conn.rollback();
        return { ok: false, error: catErr };
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return { ok: true, fields: await fetchStaffRegistrationFields(pool, eventId) };
}

export function mapPublicRegistrationField(row: RowDataPacket) {
  return {
    id: row.id,
    field_key: row.field_key,
    label: row.label,
    field_type: row.field_type,
    options_json: parseRegistrationFieldOptions(row.options_json),
    is_required: Boolean(row.is_required),
    sort_order: row.sort_order,
    scope_type: String(row.scope_type ?? "all_categories"),
    category_ids: (row.category_ids as number[]) ?? [],
  };
}
