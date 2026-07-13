import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { EventExtraScopeType } from "@shared/api";

export type RegistrationFieldRow = RowDataPacket & {
  id: number;
  event_id: number;
  field_key: string;
  label: string;
  field_type: string;
  options_json?: string | string[] | null;
  is_required: number;
  sort_order: number;
  is_active: number;
  scope_type: EventExtraScopeType;
};

export type RegistrationFieldCategoryRow = RowDataPacket & {
  event_registration_field_id: number;
  event_category_id: number;
};

export type RegistrationFieldsSqlContext = {
  fields: RegistrationFieldRow[];
  fieldCategories: RegistrationFieldCategoryRow[];
  nextFieldId: { current: number };
  eventId: number;
  resolveCategoryIds: (eventId: number, categoryIds: number[]) => number[];
};

function header(insertId = 0, affectedRows = 1): ResultSetHeader {
  return { insertId, affectedRows } as ResultSetHeader;
}

function replaceInPlace<T>(target: T[], next: T[]) {
  target.length = 0;
  target.push(...next);
}

function categoryIdsForField(
  ctx: RegistrationFieldsSqlContext,
  fieldId: number,
): number[] {
  return ctx.fieldCategories
    .filter((row) => Number(row.event_registration_field_id) === fieldId)
    .map((row) => Number(row.event_category_id));
}

function enrichFields(ctx: RegistrationFieldsSqlContext, rows: RegistrationFieldRow[]) {
  return rows.map((row) => ({
    ...row,
    scope_type: row.scope_type ?? "all_categories",
    category_ids: categoryIdsForField(ctx, Number(row.id)),
    options_json: row.options_json,
  }));
}

export function applyRegistrationFieldSeedEnhancements(
  ctx: RegistrationFieldsSqlContext,
  fieldId: number,
  seed: { scope_type?: EventExtraScopeType; category_ids?: number[] },
) {
  const field = ctx.fields.find((row) => Number(row.id) === fieldId);
  if (!field) return;
  if (seed.scope_type) field.scope_type = seed.scope_type;
  replaceInPlace(
    ctx.fieldCategories,
    ctx.fieldCategories.filter(
      (row) => Number(row.event_registration_field_id) !== fieldId,
    ),
  );
  for (const categoryId of seed.category_ids ?? []) {
    ctx.fieldCategories.push({
      event_registration_field_id: fieldId,
      event_category_id: categoryId,
    } as RegistrationFieldCategoryRow);
  }
}

type SqlHit =
  | { type: "rows"; rows: RowDataPacket[] }
  | { type: "header"; header: ResultSetHeader }
  | null;

export function handleRegistrationFieldsScenarioSql(
  q: string,
  params: unknown[],
  ctx: RegistrationFieldsSqlContext,
): SqlHit {
  if (q.includes("from event_registration_field_categories")) {
    const ids = params.map((p) => Number(p));
    const rows = ctx.fieldCategories
      .filter((row) => ids.includes(Number(row.event_registration_field_id)))
      .map((row) => ({ ...row }));
    return { type: "rows", rows };
  }

  if (q.includes("delete from event_registration_field_categories")) {
    const fieldId = Number(params[0]);
    const before = ctx.fieldCategories.length;
    replaceInPlace(
      ctx.fieldCategories,
      ctx.fieldCategories.filter(
        (row) => Number(row.event_registration_field_id) !== fieldId,
      ),
    );
    return {
      type: "header",
      header: header(0, before - ctx.fieldCategories.length),
    };
  }

  if (q.includes("insert into event_registration_field_categories")) {
    ctx.fieldCategories.push({
      event_registration_field_id: Number(params[0]),
      event_category_id: Number(params[1]),
    } as RegistrationFieldCategoryRow);
    return { type: "header", header: header(0, 1) };
  }

  if (q.includes("delete from event_registration_fields where event_id")) {
    const eventId = Number(params[0]);
    const before = ctx.fields.length;
    const removedIds = ctx.fields
      .filter((row) => Number(row.event_id) === eventId)
      .map((row) => Number(row.id));
    replaceInPlace(
      ctx.fields,
      ctx.fields.filter((row) => Number(row.event_id) !== eventId),
    );
    replaceInPlace(
      ctx.fieldCategories,
      ctx.fieldCategories.filter(
        (row) => !removedIds.includes(Number(row.event_registration_field_id)),
      ),
    );
    return { type: "header", header: header(0, before - ctx.fields.length) };
  }

  if (q.startsWith("insert into event_registration_fields")) {
    const id = ctx.nextFieldId.current++;
    const row = {
      id,
      event_id: Number(params[0]),
      field_key: String(params[1]),
      label: String(params[2]),
      field_type: String(params[3]),
      options_json: params[4],
      is_required: Number(params[5]),
      sort_order: Number(params[6]),
      is_active: Number(params[7]),
      scope_type: String(params[8] ?? "all_categories"),
    } as RegistrationFieldRow;
    ctx.fields.push(row);
    return { type: "header", header: header(id, 1) };
  }

  if (q.includes("from event_registration_fields")) {
    const eventId = Number(params[0]);
    let rows = ctx.fields.filter((row) => Number(row.event_id) === eventId);
    if (q.includes("is_active = 1")) {
      rows = rows.filter((row) => Number(row.is_active) === 1);
    }
    rows = [...rows].sort(
      (a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id),
    );
    return { type: "rows", rows: enrichFields(ctx, rows) };
  }

  if (
    q.includes("select id from event_categories") &&
    q.includes("is_active = 1") &&
    q.includes("in (")
  ) {
    const eventId = Number(params[0]);
    const categoryIds = params.slice(1).map((p) => Number(p));
    const valid = ctx.resolveCategoryIds(eventId, categoryIds);
    return {
      type: "rows",
      rows: valid.map((id) => ({ id })) as RowDataPacket[],
    };
  }

  return null;
}
