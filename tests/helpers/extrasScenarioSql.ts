import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

function header(insertId = 0, affectedRows = 1): ResultSetHeader {
  return { insertId, affectedRows } as ResultSetHeader;
}

export type ExtraFieldSeed = {
  field_key: string;
  label: string;
  field_type?: string;
  field_kind?: string;
  options_json?: string[] | null;
  is_required?: boolean | number;
  sort_order?: number;
};

export type ExtraSeedEnhancements = {
  scope_type?: "all_categories" | "selected_categories";
  sales_opens_at?: string | null;
  sales_closes_at?: string | null;
  category_ids?: number[];
  fields?: ExtraFieldSeed[];
};

export interface ExtrasSqlContext {
  extras: RowDataPacket[];
  extraFields: RowDataPacket[];
  extraCategories: RowDataPacket[];
  registrationExtraFieldValues: RowDataPacket[];
  nextExtraFieldId: { current: number };
  nextRegExtraFieldValueId: { current: number };
  resolveCategoryIds: (eventId: number, categoryIds: number[]) => number[];
  eventRegistrationWindow: (eventId: number) => {
    registration_opens_at: string | null;
    registration_closes_at: string | null;
  };
  categoryRegistrationWindows: (eventId: number) => Array<{
    registration_opens_at: string | null;
    registration_closes_at: string | null;
  }>;
}

export function applyExtraSeedEnhancements(
  ctx: ExtrasSqlContext,
  extraId: number,
  seed: ExtraSeedEnhancements,
): void {
  const extra = ctx.extras.find((row) => Number(row.id) === extraId);
  if (extra) {
    if (seed.scope_type) extra.scope_type = seed.scope_type;
    if (seed.sales_opens_at !== undefined) extra.sales_opens_at = seed.sales_opens_at;
    if (seed.sales_closes_at !== undefined) extra.sales_closes_at = seed.sales_closes_at;
  }
  for (const categoryId of seed.category_ids ?? []) {
    ctx.extraCategories.push({
      event_extra_id: extraId,
      event_category_id: categoryId,
    } as RowDataPacket);
  }
  for (const [index, field] of (seed.fields ?? []).entries()) {
    ctx.extraFields.push({
      id: ctx.nextExtraFieldId.current++,
      event_extra_id: extraId,
      field_key: field.field_key,
      label: field.label,
      field_type: field.field_type ?? "text",
      field_kind: field.field_kind ?? "standard",
      options_json: field.options_json?.length ? JSON.stringify(field.options_json) : null,
      is_required: field.is_required ? 1 : 0,
      sort_order: field.sort_order ?? index,
    } as RowDataPacket);
  }
}

export function handleExtrasScenarioSql(
  q: string,
  params: unknown[],
  ctx: ExtrasSqlContext,
):
  | { type: "rows"; rows: RowDataPacket[] }
  | { type: "header"; header: ResultSetHeader }
  | null {
  if (q.includes("select registration_opens_at, registration_closes_at from events")) {
    const eventId = Number(params[0]);
    return {
      type: "rows",
      rows: [ctx.eventRegistrationWindow(eventId) as RowDataPacket],
    };
  }

  if (
    q.includes("select registration_opens_at, registration_closes_at") &&
    q.includes("from event_categories where event_id = ?") &&
    q.includes("is_active = 1")
  ) {
    return { type: "rows", rows: ctx.categoryRegistrationWindows(Number(params[0])) as RowDataPacket[] };
  }

  if (q.includes("from event_extra_fields")) {
    const ids = params.map((p) => Number(p));
    const rows = ctx.extraFields
      .filter((row) => ids.includes(Number(row.event_extra_id)))
      .sort(
        (a, b) =>
          Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id),
      )
      .map((row) => ({ ...row }));
    return { type: "rows", rows };
  }

  if (q.includes("delete from event_extra_fields")) {
    const extraId = Number(params[0]);
    const before = ctx.extraFields.length;
    for (let i = ctx.extraFields.length - 1; i >= 0; i--) {
      if (Number(ctx.extraFields[i]!.event_extra_id) === extraId) {
        ctx.extraFields.splice(i, 1);
      }
    }
    return { type: "header", header: header(0, before - ctx.extraFields.length) };
  }

  if (q.includes("insert into event_extra_fields")) {
    const id = ctx.nextExtraFieldId.current++;
    ctx.extraFields.push({
      id,
      event_extra_id: Number(params[0]),
      field_key: String(params[1]),
      label: String(params[2]),
      field_type: String(params[3]),
      field_kind: String(params[4]),
      options_json: params[5],
      is_required: Number(params[6]),
      sort_order: Number(params[7]),
    } as RowDataPacket);
    return { type: "header", header: header(id, 1) };
  }

  if (q.includes("delete from event_extra_categories")) {
    const extraId = Number(params[0]);
    const before = ctx.extraCategories.length;
    for (let i = ctx.extraCategories.length - 1; i >= 0; i--) {
      if (Number(ctx.extraCategories[i]!.event_extra_id) === extraId) {
        ctx.extraCategories.splice(i, 1);
      }
    }
    return { type: "header", header: header(0, before - ctx.extraCategories.length) };
  }

  if (q.includes("insert into event_extra_categories")) {
    ctx.extraCategories.push({
      event_extra_id: Number(params[0]),
      event_category_id: Number(params[1]),
    } as RowDataPacket);
    return { type: "header", header: header(0, 1) };
  }

  if (q.includes("from event_extra_categories")) {
    const ids = params.map((p) => Number(p));
    const rows = ctx.extraCategories
      .filter((row) => ids.includes(Number(row.event_extra_id)))
      .map((row) => ({ ...row }));
    return { type: "rows", rows };
  }

  if (
    q.includes("from event_categories") &&
    q.includes("is_active = 1") &&
    q.includes("id in (")
  ) {
    const eventId = Number(params[0]);
    const categoryIds = params.slice(1).map((p) => Number(p));
    const valid = ctx.resolveCategoryIds(eventId, categoryIds);
    return { type: "rows", rows: valid.map((id) => ({ id })) as RowDataPacket[] };
  }

  if (q.includes("select scope_type, sales_opens_at, sales_closes_at") && q.includes("from event_extras")) {
    const extraId = Number(params[0]);
    const eventId = Number(params[1]);
    const extra = ctx.extras.find(
      (row) => Number(row.id) === extraId && Number(row.event_id) === eventId,
    );
    return {
      type: "rows",
      rows: extra
        ? [
            {
              scope_type: extra.scope_type ?? "all_categories",
              sales_opens_at: extra.sales_opens_at ?? null,
              sales_closes_at: extra.sales_closes_at ?? null,
            },
          ]
        : [],
    } as { type: "rows"; rows: RowDataPacket[] };
  }

  if (q.includes("select id, price_cents, sold_count from event_extras")) {
    const extraId = Number(params[0]);
    const eventId = Number(params[1]);
    const extra = ctx.extras.find(
      (row) => Number(row.id) === extraId && Number(row.event_id) === eventId,
    );
    return {
      type: "rows",
      rows: extra
        ? [
            {
              id: extra.id,
              price_cents: extra.price_cents,
              sold_count: extra.sold_count,
            },
          ]
        : [],
    } as { type: "rows"; rows: RowDataPacket[] };
  }

  if (q.includes("update event_extras") && q.includes("scope_type = ?")) {
    const extraId = Number(params[params.length - 2]);
    const eventId = Number(params[params.length - 1]);
    const extra = ctx.extras.find(
      (row) => Number(row.id) === extraId && Number(row.event_id) === eventId,
    );
    if (!extra) return { type: "header", header: header(0, 0) };
    extra.scope_type = String(params[0]);
    extra.sales_opens_at = (params[1] as string | null) ?? null;
    extra.sales_closes_at = (params[2] as string | null) ?? null;
    return { type: "header", header: header(0, 1) };
  }

  if (q.includes("from registration_extra_field_values")) {
    const ids = params.map((p) => Number(p));
    const rows = ctx.registrationExtraFieldValues
      .filter((row) => ids.includes(Number(row.registration_extra_id)))
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((row) => ({ ...row }));
    return { type: "rows", rows };
  }

  if (q.includes("insert into registration_extra_field_values")) {
    const id = ctx.nextRegExtraFieldValueId.current++;
    ctx.registrationExtraFieldValues.push({
      id,
      registration_extra_id: Number(params[0]),
      field_key: String(params[1]),
      label: String(params[2]),
      value_text: params[3] != null ? String(params[3]) : null,
      value_json: params[4],
    } as RowDataPacket);
    return { type: "header", header: header(id, 1) };
  }

  if (
    q.includes("id, name, price_cents, max_per_athlete, capacity, sold_count, scope_type")
  ) {
    const eventId = Number(params[0]);
    const ids = params.slice(1).map((p) => Number(p));
    const rows = ctx.extras
      .filter(
        (e) =>
          Number(e.event_id) === eventId &&
          Number(e.is_active) === 1 &&
          ids.includes(Number(e.id)),
      )
      .map((e) => ({
        id: e.id,
        name: e.name,
        price_cents: e.price_cents,
        max_per_athlete: e.max_per_athlete,
        capacity: e.capacity,
        sold_count: e.sold_count,
        scope_type: e.scope_type ?? "all_categories",
        sales_opens_at: e.sales_opens_at ?? null,
        sales_closes_at: e.sales_closes_at ?? null,
      }));
    return { type: "rows", rows: rows as RowDataPacket[] };
  }

  if (q.includes("scope_type, sales_opens_at, sales_closes_at") && q.includes("from event_extras")) {
    let rows = [...ctx.extras];
    if (q.includes("where e.event_id = ?")) {
      const eventId = Number(params[0]);
      rows = rows.filter((e) => Number(e.event_id) === eventId);
    } else if (q.includes("where event_id = ?")) {
      const eventId = Number(params[0]);
      rows = rows.filter((e) => Number(e.event_id) === eventId);
    }
    if (q.includes("is_active = 1")) {
      rows = rows.filter((e) => Number(e.is_active) === 1);
    }
    const now = new Date();
    if (q.includes("sales_opens_at is null or e.sales_opens_at <=")) {
      rows = rows.filter((e) => {
        const opens = e.sales_opens_at ? new Date(String(e.sales_opens_at)) : null;
        return !opens || opens <= now;
      });
    }
    if (q.includes("sales_closes_at is null or e.sales_closes_at >=")) {
      rows = rows.filter((e) => {
        const closes = e.sales_closes_at ? new Date(String(e.sales_closes_at)) : null;
        return !closes || closes >= now;
      });
    }
    rows = [...rows].sort(
      (a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id),
    );
    return {
      type: "rows",
      rows: rows.map((e) => ({
        id: e.id,
        public_uuid: e.public_uuid,
        name: e.name,
        description: e.description,
        price_cents: e.price_cents,
        currency: e.currency,
        image_url: e.image_url,
        extra_type: e.extra_type,
        max_per_athlete: e.max_per_athlete,
        capacity: e.capacity,
        sold_count: e.sold_count,
        sort_order: e.sort_order,
        scope_type: e.scope_type ?? "all_categories",
        sales_opens_at: e.sales_opens_at ?? null,
        sales_closes_at: e.sales_closes_at ?? null,
      })),
    } as { type: "rows"; rows: RowDataPacket[] };
  }

  return null;
}
