import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  EventExtraField,
  EventExtraScopeType,
  RegistrationPurchasedExtra,
} from "../shared/api.js";
import {
  normalizeExtraFieldInput,
  serializeExtraFieldAnswer,
  validateExtraFieldAnswers,
  validateExtraFieldDefinitions,
  type EventExtraFieldDefinition,
} from "../shared/extraFields.js";
import {
  isValidEventExtraType,
  type ResolvedExtraLine,
  type SelectedExtraInput,
  sumExtrasSubtotalCents,
} from "../shared/eventExtras.js";
import { assertPaidCategoryMutationAllowed } from "./stripeConnect.js";

export type ExtraRouteError = { status: number; error: string; code?: string };

export type ExtraFieldAnswersInput = Array<{
  extraId: number;
  values: Record<string, unknown>;
}>;

const EXTRA_SELECT = `
  id, public_uuid, event_id, name, description, price_cents, currency, image_url,
  extra_type, max_per_athlete, capacity, sold_count, is_required, sort_order, is_active,
  scope_type, sales_opens_at, sales_closes_at
`;

function parseIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function mapExtraFieldRow(row: RowDataPacket): EventExtraField {
  let options: string[] | null = null;
  if (row.options_json != null) {
    try {
      const raw =
        typeof row.options_json === "string"
          ? JSON.parse(row.options_json)
          : row.options_json;
      options = Array.isArray(raw) ? raw.map(String) : null;
    } catch {
      options = null;
    }
  }
  return {
    id: Number(row.id),
    field_key: String(row.field_key),
    label: String(row.label),
    field_type: row.field_type as EventExtraField["field_type"],
    field_kind: row.field_kind === "mx_shipping_block" ? "mx_shipping_block" : "standard",
    options_json: options,
    is_required: Boolean(row.is_required),
    sort_order: Number(row.sort_order) || 0,
  };
}

async function fetchFieldsByExtraIds(
  pool: Pool | PoolConnection,
  extraIds: number[],
): Promise<Map<number, EventExtraField[]>> {
  const map = new Map<number, EventExtraField[]>();
  if (extraIds.length === 0) return map;
  const placeholders = extraIds.map(() => "?").join(", ");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, event_extra_id, field_key, label, field_type, field_kind, options_json,
            is_required, sort_order
     FROM event_extra_fields
     WHERE event_extra_id IN (${placeholders})
     ORDER BY sort_order ASC, id ASC`,
    extraIds,
  );
  for (const row of rows) {
    const extraId = Number(row.event_extra_id);
    const list = map.get(extraId) ?? [];
    list.push(mapExtraFieldRow(row));
    map.set(extraId, list);
  }
  return map;
}

async function fetchCategoryIdsByExtraIds(
  pool: Pool | PoolConnection,
  extraIds: number[],
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (extraIds.length === 0) return map;
  const placeholders = extraIds.map(() => "?").join(", ");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT event_extra_id, event_category_id
     FROM event_extra_categories
     WHERE event_extra_id IN (${placeholders})`,
    extraIds,
  );
  for (const row of rows) {
    const extraId = Number(row.event_extra_id);
    const list = map.get(extraId) ?? [];
    list.push(Number(row.event_category_id));
    map.set(extraId, list);
  }
  return map;
}

type EnrichedExtraRow = RowDataPacket & {
  category_ids: number[];
  fields: EventExtraField[];
  fields_locked: boolean;
};

function enrichExtraRows(
  rows: RowDataPacket[],
  fieldsByExtra: Map<number, EventExtraField[]>,
  categoriesByExtra: Map<number, number[]>,
): EnrichedExtraRow[] {
  return rows.map((row) => ({
    ...row,
    category_ids: categoriesByExtra.get(Number(row.id)) ?? [],
    fields: fieldsByExtra.get(Number(row.id)) ?? [],
    fields_locked: Number(row.sold_count) > 0,
  }));
}

export async function fetchStaffEventExtras(pool: Pool, eventId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${EXTRA_SELECT}
     FROM event_extras
     WHERE event_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [eventId],
  );
  const ids = rows.map((r) => Number(r.id));
  const fieldsByExtra = await fetchFieldsByExtraIds(pool, ids);
  const categoriesByExtra = await fetchCategoryIdsByExtraIds(pool, ids);
  return enrichExtraRows(rows, fieldsByExtra, categoriesByExtra);
}

export async function fetchEventExtras(pool: Pool, eventId: number, categoryId?: number) {
  const now = new Date();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.public_uuid, e.name, e.description, e.price_cents, e.currency, e.image_url,
            e.extra_type, e.max_per_athlete, e.capacity, e.sold_count, e.sort_order,
            e.scope_type, e.sales_opens_at, e.sales_closes_at
     FROM event_extras e
     WHERE e.event_id = ? AND e.is_active = 1
       AND (e.sales_opens_at IS NULL OR e.sales_opens_at <= ?)
       AND (e.sales_closes_at IS NULL OR e.sales_closes_at >= ?)
     ORDER BY e.sort_order ASC, e.id ASC`,
    [eventId, now, now],
  );

  let filtered = rows;
  if (categoryId != null) {
    const ids = rows.map((r) => Number(r.id));
    const categoriesByExtra = await fetchCategoryIdsByExtraIds(pool, ids);
    filtered = rows.filter((row) => {
      const scope = String(row.scope_type ?? "all_categories");
      if (scope === "all_categories") return true;
      const cats = categoriesByExtra.get(Number(row.id)) ?? [];
      return cats.includes(categoryId);
    });
  }

  const ids = filtered.map((r) => Number(r.id));
  const fieldsByExtra = await fetchFieldsByExtraIds(pool, ids);
  const categoriesByExtra = await fetchCategoryIdsByExtraIds(pool, ids);

  return enrichExtraRows(filtered, fieldsByExtra, categoriesByExtra).map((row) => {
    const closes = row.sales_closes_at ? new Date(String(row.sales_closes_at)).getTime() : null;
    const opens = row.sales_opens_at ? new Date(String(row.sales_opens_at)).getTime() : null;
    let sales_status: "open" | "scheduled" | "ended" = "open";
    if (closes != null && closes < now.getTime()) sales_status = "ended";
    else if (opens != null && opens > now.getTime()) sales_status = "scheduled";
    return {
      id: row.id,
      public_uuid: row.public_uuid,
      name: row.name,
      description: row.description,
      price_cents: row.price_cents,
      currency: row.currency,
      image_url: row.image_url,
      extra_type: row.extra_type,
      max_per_athlete: row.max_per_athlete,
      capacity: row.capacity,
      sold_count: row.sold_count,
      sort_order: row.sort_order,
      scope_type: row.scope_type,
      sales_opens_at: row.sales_opens_at,
      sales_closes_at: row.sales_closes_at,
      category_ids: row.category_ids,
      fields: row.fields,
      sales_status,
    };
  });
}

export async function fetchAllEventExtras(pool: Pool, eventId: number) {
  return fetchStaffEventExtras(pool, eventId);
}

async function loadRegistrationWindowBounds(
  pool: Pool | PoolConnection,
  eventId: number,
): Promise<{ opens: number | null; closes: number | null }> {
  const [eventRows] = await pool.query<RowDataPacket[]>(
    `SELECT registration_opens_at, registration_closes_at FROM events WHERE id = ? LIMIT 1`,
    [eventId],
  );
  const [catRows] = await pool.query<RowDataPacket[]>(
    `SELECT registration_opens_at, registration_closes_at
     FROM event_categories WHERE event_id = ? AND is_active = 1`,
    [eventId],
  );
  const opens: number[] = [];
  const closes: number[] = [];
  const ev = eventRows[0];
  if (ev?.registration_opens_at) {
    opens.push(new Date(String(ev.registration_opens_at)).getTime());
  }
  if (ev?.registration_closes_at) {
    closes.push(new Date(String(ev.registration_closes_at)).getTime());
  }
  for (const cat of catRows) {
    if (cat.registration_opens_at) {
      opens.push(new Date(String(cat.registration_opens_at)).getTime());
    }
    if (cat.registration_closes_at) {
      closes.push(new Date(String(cat.registration_closes_at)).getTime());
    }
  }
  return {
    opens: opens.length ? Math.max(...opens) : null,
    closes: closes.length ? Math.min(...closes) : null,
  };
}

async function validateExtraSalesWindow(
  pool: Pool | PoolConnection,
  eventId: number,
  salesOpensAt: string | null,
  salesClosesAt: string | null,
): Promise<ExtraRouteError | null> {
  const { opens, closes } = await loadRegistrationWindowBounds(pool, eventId);
  const openMs = salesOpensAt ? new Date(salesOpensAt).getTime() : null;
  const closeMs = salesClosesAt ? new Date(salesClosesAt).getTime() : null;
  if (openMs != null && closeMs != null && openMs >= closeMs) {
    return { status: 400, error: "Sales close must be after sales open" };
  }
  if (opens != null) {
    if (openMs != null && openMs < opens) {
      return { status: 400, error: "Sales open must be within registration window" };
    }
    if (closeMs != null && closeMs < opens) {
      return { status: 400, error: "Sales close must be within registration window" };
    }
  }
  if (closes != null) {
    if (openMs != null && openMs > closes) {
      return { status: 400, error: "Sales open must be within registration window" };
    }
    if (closeMs != null && closeMs > closes) {
      return { status: 400, error: "Sales close must be within registration window" };
    }
  }
  return null;
}

function parseFieldsFromBody(body: Record<string, unknown>): EventExtraFieldDefinition[] | null {
  if (!Array.isArray(body.fields)) return null;
  const fields: EventExtraFieldDefinition[] = [];
  for (let i = 0; i < body.fields.length; i++) {
    const item = body.fields[i];
    if (!item || typeof item !== "object") continue;
    const normalized = normalizeExtraFieldInput(item as Record<string, unknown>, i);
    if (normalized) fields.push(normalized);
  }
  return fields;
}

async function syncExtraCategories(
  pool: Pool | PoolConnection,
  extraId: number,
  eventId: number,
  scopeType: EventExtraScopeType,
  categoryIds: number[],
): Promise<ExtraRouteError | null> {
  await pool.query<ResultSetHeader>(
    "DELETE FROM event_extra_categories WHERE event_extra_id = ?",
    [extraId],
  );
  if (scopeType !== "selected_categories") return null;
  if (categoryIds.length === 0) {
    return { status: 400, error: "Select at least one category" };
  }
  const placeholders = categoryIds.map(() => "?").join(", ");
  const [valid] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM event_categories
     WHERE event_id = ? AND is_active = 1 AND id IN (${placeholders})`,
    [eventId, ...categoryIds],
  );
  if (valid.length !== categoryIds.length) {
    return { status: 400, error: "Invalid category selection" };
  }
  for (const categoryId of categoryIds) {
    await pool.query<ResultSetHeader>(
      "INSERT INTO event_extra_categories (event_extra_id, event_category_id) VALUES (?,?)",
      [extraId, categoryId],
    );
  }
  return null;
}

async function replaceExtraFields(
  pool: Pool | PoolConnection,
  extraId: number,
  fields: EventExtraFieldDefinition[],
): Promise<ExtraRouteError | null> {
  const err = validateExtraFieldDefinitions(fields);
  if (err) return { status: 400, error: err };
  await pool.query<ResultSetHeader>(
    "DELETE FROM event_extra_fields WHERE event_extra_id = ?",
    [extraId],
  );
  for (const field of fields) {
    await pool.query<ResultSetHeader>(
      `INSERT INTO event_extra_fields (
         event_extra_id, field_key, label, field_type, field_kind, options_json, is_required, sort_order
       ) VALUES (?,?,?,?,?,?,?,?)`,
      [
        extraId,
        field.field_key,
        field.label,
        field.field_type,
        field.field_kind ?? "standard",
        field.options_json?.length ? JSON.stringify(field.options_json) : null,
        field.is_required ? 1 : 0,
        field.sort_order,
      ],
    );
  }
  return null;
}

async function applyExtraScopeAndDates(
  pool: Pool | PoolConnection,
  eventId: number,
  extraId: number,
  body: Record<string, unknown>,
  soldCount: number,
): Promise<ExtraRouteError | null> {
  const scope_type: EventExtraScopeType =
    body.scope_type === "selected_categories" ? "selected_categories" : "all_categories";
  const sales_opens_at = parseIsoDate(body.sales_opens_at);
  const sales_closes_at = parseIsoDate(body.sales_closes_at);
  const windowErr = await validateExtraSalesWindow(
    pool,
    eventId,
    sales_opens_at,
    sales_closes_at,
  );
  if (windowErr) return windowErr;

  await pool.query<ResultSetHeader>(
    `UPDATE event_extras
     SET scope_type = ?, sales_opens_at = ?, sales_closes_at = ?
     WHERE id = ? AND event_id = ?`,
    [scope_type, sales_opens_at, sales_closes_at, extraId, eventId],
  );

  const categoryIds = Array.isArray(body.category_ids)
    ? [...new Set(body.category_ids.map((id) => Number(id)).filter((id) => id > 0))]
    : [];
  const catErr = await syncExtraCategories(pool, extraId, eventId, scope_type, categoryIds);
  if (catErr) return catErr;

  if (body.fields !== undefined) {
    if (soldCount > 0) {
      return { status: 409, error: "Cannot change athlete questions after sales exist" };
    }
    const fields = parseFieldsFromBody(body) ?? [];
    const fieldErr = await replaceExtraFields(pool, extraId, fields);
    if (fieldErr) return fieldErr;
  }
  return null;
}

export async function createEventExtraRecord(
  pool: Pool,
  newUuid: () => string,
  eventId: number,
  body: Record<string, unknown>,
  stripe?: import("stripe").default | null,
): Promise<ExtraRouteError | null> {
  const name = String(body?.name ?? "").trim();
  const isFree = Boolean(body?.is_free);
  const price_cents = isFree ? 0 : Number(body?.price_cents);
  if (!name) return { status: 400, error: "name required" };
  if (!Number.isFinite(price_cents) || price_cents < 0) {
    return { status: 400, error: "price_cents required" };
  }

  if (price_cents > 0) {
    const payoutErr = await assertPaidCategoryMutationAllowed(
      pool,
      eventId,
      Math.round(price_cents),
      stripe,
    );
    if (payoutErr) return payoutErr;
  }

  const extra_type = isValidEventExtraType(body?.extra_type)
    ? body.extra_type
    : "custom";

  const max_per_athlete = Math.min(
    99,
    Math.max(1, Number(body?.max_per_athlete) || 1),
  );

  const capacityRaw = body?.capacity;
  const capacity =
    capacityRaw === null || capacityRaw === undefined || capacityRaw === ""
      ? null
      : Number(capacityRaw);

  const scope_type: EventExtraScopeType =
    body.scope_type === "selected_categories" ? "selected_categories" : "all_categories";
  const sales_opens_at = parseIsoDate(body.sales_opens_at);
  const sales_closes_at = parseIsoDate(body.sales_closes_at);
  const windowErr = await validateExtraSalesWindow(
    pool,
    eventId,
    sales_opens_at,
    sales_closes_at,
  );
  if (windowErr) return windowErr;

  const [ins] = await pool.query<ResultSetHeader>(
    `INSERT INTO event_extras (
       public_uuid, event_id, name, description, price_cents, currency, image_url,
       extra_type, max_per_athlete, capacity, is_required, sort_order, is_active,
       scope_type, sales_opens_at, sales_closes_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
    [
      newUuid(),
      eventId,
      name.slice(0, 150),
      body?.description ? String(body.description).slice(0, 500) : null,
      Math.round(price_cents),
      String(body?.currency ?? "MXN").slice(0, 3).toUpperCase() || "MXN",
      body?.image_url ? String(body.image_url).slice(0, 1000) : null,
      extra_type,
      max_per_athlete,
      capacity != null && Number.isFinite(capacity) && capacity > 0
        ? Math.round(capacity)
        : null,
      0,
      Number(body?.sort_order) || 0,
      scope_type,
      sales_opens_at,
      sales_closes_at,
    ],
  );

  const extraId = ins.insertId;
  const categoryIds = Array.isArray(body.category_ids)
    ? [...new Set(body.category_ids.map((id) => Number(id)).filter((id) => id > 0))]
    : [];
  const catErr = await syncExtraCategories(pool, extraId, eventId, scope_type, categoryIds);
  if (catErr) return catErr;

  const fields = parseFieldsFromBody(body) ?? [];
  const fieldErr = await replaceExtraFields(pool, extraId, fields);
  if (fieldErr) return fieldErr;

  return null;
}

export async function patchEventExtraRecord(
  pool: Pool,
  eventId: number,
  extraId: number,
  body: Record<string, unknown>,
  stripe?: import("stripe").default | null,
): Promise<ExtraRouteError | null> {
  const [existing] = await pool.query<RowDataPacket[]>(
    `SELECT id, price_cents, sold_count FROM event_extras
     WHERE id = ? AND event_id = ? AND is_active = 1 LIMIT 1`,
    [extraId, eventId],
  );
  if (existing.length === 0) {
    return { status: 404, error: "Extra not found" };
  }
  const soldCount = Number(existing[0].sold_count) || 0;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body?.name != null) {
    const name = String(body.name).trim();
    if (!name) return { status: 400, error: "name required" };
    updates.push("name = ?");
    params.push(name.slice(0, 150));
  }

  if (body?.description !== undefined) {
    updates.push("description = ?");
    params.push(
      body.description ? String(body.description).slice(0, 500) : null,
    );
  }

  const isFree = body?.is_free === true;
  if (isFree) {
    updates.push("price_cents = ?");
    params.push(0);
  } else if (body?.price_cents != null) {
    const price_cents = Number(body.price_cents);
    if (!Number.isFinite(price_cents) || price_cents < 0) {
      return { status: 400, error: "invalid price_cents" };
    }
    if (price_cents > 0) {
      const payoutErr = await assertPaidCategoryMutationAllowed(
        pool,
        eventId,
        Math.round(price_cents),
        stripe,
      );
      if (payoutErr) return payoutErr;
    }
    updates.push("price_cents = ?");
    params.push(Math.round(price_cents));
  }

  if (body?.extra_type != null) {
    if (!isValidEventExtraType(body.extra_type)) {
      return { status: 400, error: "invalid extra_type" };
    }
    updates.push("extra_type = ?");
    params.push(body.extra_type);
  }

  if (body?.max_per_athlete != null) {
    updates.push("max_per_athlete = ?");
    params.push(Math.min(99, Math.max(1, Number(body.max_per_athlete) || 1)));
  }

  if (body?.capacity !== undefined) {
    const capacity =
      body.capacity === null || body.capacity === ""
        ? null
        : Number(body.capacity);
    updates.push("capacity = ?");
    params.push(
      capacity != null && Number.isFinite(capacity) && capacity > 0
        ? Math.round(capacity)
        : null,
    );
  }

  if (body?.image_url !== undefined) {
    updates.push("image_url = ?");
    params.push(
      body.image_url ? String(body.image_url).slice(0, 1000) : null,
    );
  }

  if (body?.sort_order != null) {
    updates.push("sort_order = ?");
    params.push(Number(body.sort_order) || 0);
  }

  if (updates.length > 0) {
    params.push(extraId, eventId);
    await pool.query<ResultSetHeader>(
      `UPDATE event_extras SET ${updates.join(", ")} WHERE id = ? AND event_id = ?`,
      params,
    );
  }

  if (
    body.scope_type !== undefined ||
    body.category_ids !== undefined ||
    body.sales_opens_at !== undefined ||
    body.sales_closes_at !== undefined ||
    body.fields !== undefined
  ) {
    const [scopeRow] = await pool.query<RowDataPacket[]>(
      `SELECT scope_type, sales_opens_at, sales_closes_at
       FROM event_extras WHERE id = ? AND event_id = ? LIMIT 1`,
      [extraId, eventId],
    );
    const existing = scopeRow[0];
    const mergedBody = {
      ...body,
      scope_type:
        body.scope_type !== undefined
          ? body.scope_type
          : (existing?.scope_type ?? "all_categories"),
      sales_opens_at:
        body.sales_opens_at !== undefined
          ? body.sales_opens_at
          : existing?.sales_opens_at ?? null,
      sales_closes_at:
        body.sales_closes_at !== undefined
          ? body.sales_closes_at
          : existing?.sales_closes_at ?? null,
    };
    const scopeErr = await applyExtraScopeAndDates(
      pool,
      eventId,
      extraId,
      mergedBody,
      soldCount,
    );
    if (scopeErr) return scopeErr;
  }

  if (updates.length === 0 && body.fields === undefined && body.scope_type === undefined) {
    return { status: 400, error: "No fields to update" };
  }

  return null;
}

export async function deleteEventExtraRecord(
  pool: Pool,
  eventId: number,
  extraId: number,
): Promise<ExtraRouteError | null> {
  const [row] = await pool.query<RowDataPacket[]>(
    "SELECT sold_count FROM event_extras WHERE id = ? AND event_id = ? LIMIT 1",
    [extraId, eventId],
  );
  if (row.length === 0) {
    // Idempotent: already removed or deactivated — return current list without error.
    return null;
  }
  if (Number(row[0].sold_count) > 0) {
    await pool.query<ResultSetHeader>(
      "UPDATE event_extras SET is_active = 0 WHERE id = ? AND event_id = ?",
      [extraId, eventId],
    );
  } else {
    await pool.query<ResultSetHeader>(
      "DELETE FROM event_extras WHERE id = ? AND event_id = ?",
      [extraId, eventId],
    );
  }
  return null;
}

export async function resolveSelectedExtras(
  pool: Pool | PoolConnection,
  eventId: number,
  selected: SelectedExtraInput[],
  options?: { categoryId?: number },
): Promise<{ ok: true; lines: ResolvedExtraLine[] } | { ok: false; error: string }> {
  if (!Array.isArray(selected) || selected.length === 0) {
    return { ok: true, lines: [] };
  }

  const byId = new Map<number, number>();
  for (const item of selected) {
    const extraId = Number(item?.extraId);
    const quantity = Number(item?.quantity);
    if (!Number.isFinite(extraId) || extraId <= 0) {
      return { ok: false, error: "Invalid extra selection" };
    }
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
      return { ok: false, error: "Invalid extra quantity" };
    }
    byId.set(extraId, (byId.get(extraId) ?? 0) + Math.round(quantity));
  }

  const ids = [...byId.keys()];
  const placeholders = ids.map(() => "?").join(", ");
  const now = new Date();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, price_cents, max_per_athlete, capacity, sold_count, scope_type,
            sales_opens_at, sales_closes_at
     FROM event_extras
     WHERE event_id = ? AND is_active = 1 AND id IN (${placeholders})`,
    [eventId, ...ids],
  );

  if (rows.length !== ids.length) {
    return { ok: false, error: "One or more add-ons are no longer available" };
  }

  const categoriesByExtra = await fetchCategoryIdsByExtraIds(pool, ids);
  const categoryId = options?.categoryId;

  const lines: ResolvedExtraLine[] = [];
  for (const row of rows) {
    const extraId = Number(row.id);
    const quantity = byId.get(extraId) ?? 0;

    if (row.sales_opens_at && new Date(String(row.sales_opens_at)) > now) {
      return { ok: false, error: `${String(row.name)} is not available yet` };
    }
    if (row.sales_closes_at && new Date(String(row.sales_closes_at)) < now) {
      return { ok: false, error: `${String(row.name)} is no longer available` };
    }

    if (categoryId != null && String(row.scope_type) === "selected_categories") {
      const cats = categoriesByExtra.get(extraId) ?? [];
      if (!cats.includes(categoryId)) {
        return { ok: false, error: `${String(row.name)} is not available for this category` };
      }
    }

    const maxPer = Number(row.max_per_athlete) || 1;
    if (quantity > maxPer) {
      return {
        ok: false,
        error: `Maximum ${maxPer} per athlete for ${String(row.name)}`,
      };
    }
    const capacity = row.capacity != null ? Number(row.capacity) : null;
    const sold = Number(row.sold_count) || 0;
    if (capacity != null && sold + quantity > capacity) {
      return { ok: false, error: `${String(row.name)} is sold out` };
    }
    const unitPriceCents = Number(row.price_cents) || 0;
    lines.push({
      extraId,
      name: String(row.name),
      quantity,
      unitPriceCents,
      totalCents: unitPriceCents * quantity,
    });
  }

  return { ok: true, lines };
}

export async function validateExtraFieldAnswersForCheckout(
  pool: Pool | PoolConnection,
  eventId: number,
  selected: SelectedExtraInput[],
  answers: ExtraFieldAnswersInput | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  void eventId;
  if (!selected.length) return { ok: true };
  const ids = selected.map((s) => s.extraId);
  const fieldsByExtra = await fetchFieldsByExtraIds(pool, ids);
  const answersByExtra = new Map<number, Record<string, unknown>>();
  for (const row of answers ?? []) {
    if (row.extraId > 0 && row.values && typeof row.values === "object") {
      answersByExtra.set(row.extraId, row.values);
    }
  }

  for (const extraId of ids) {
    const fields = (fieldsByExtra.get(extraId) ?? []) as EventExtraFieldDefinition[];
    if (!fields.length) continue;
    const err = validateExtraFieldAnswers(fields, answersByExtra.get(extraId));
    if (err) return { ok: false, error: err };
  }
  return { ok: true };
}

export async function incrementExtrasSoldCount(
  conn: PoolConnection,
  lines: ResolvedExtraLine[],
): Promise<ExtraRouteError | null> {
  for (const line of lines) {
    const [up] = await conn.query<ResultSetHeader>(
      `UPDATE event_extras SET sold_count = sold_count + ?
       WHERE id = ? AND (capacity IS NULL OR sold_count + ? <= capacity)`,
      [line.quantity, line.extraId, line.quantity],
    );
    if (up.affectedRows === 0) {
      return { status: 409, error: `Add-on sold out: ${line.name}` };
    }
  }
  return null;
}

export async function fetchRegistrationPurchasedExtras(
  pool: Pool | PoolConnection,
  registrationId: number,
): Promise<RegistrationPurchasedExtra[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT re.id, re.event_extra_id, re.name, re.quantity, re.unit_price_cents, re.total_cents
     FROM registration_extras re
     WHERE re.registration_id = ?
     ORDER BY re.name ASC, re.id ASC`,
    [registrationId],
  );
  if (rows.length === 0) return [];

  const lineIds = rows.map((r) => Number(r.id));
  const placeholders = lineIds.map(() => "?").join(", ");
  const [answerRows] = await pool.query<RowDataPacket[]>(
    `SELECT registration_extra_id, field_key, label, value_text, value_json
     FROM registration_extra_field_values
     WHERE registration_extra_id IN (${placeholders})
     ORDER BY id ASC`,
    lineIds,
  );
  const answersByLine = new Map<number, RegistrationPurchasedExtra["field_answers"]>();
  for (const row of answerRows) {
    const lineId = Number(row.registration_extra_id);
    const list = answersByLine.get(lineId) ?? [];
    let value_json: Record<string, unknown> | null = null;
    if (row.value_json != null) {
      try {
        value_json =
          typeof row.value_json === "string"
            ? (JSON.parse(row.value_json) as Record<string, unknown>)
            : (row.value_json as Record<string, unknown>);
      } catch {
        value_json = null;
      }
    }
    list.push({
      field_key: String(row.field_key),
      label: String(row.label),
      value_text: row.value_text != null ? String(row.value_text) : null,
      value_json,
    });
    answersByLine.set(lineId, list);
  }

  return rows.map((row) => ({
    event_extra_id: Number(row.event_extra_id),
    name: String(row.name),
    quantity: Number(row.quantity),
    unit_price_cents: Number(row.unit_price_cents),
    total_cents: Number(row.total_cents),
    field_answers: answersByLine.get(Number(row.id)) ?? [],
  }));
}

export async function insertRegistrationExtras(
  conn: PoolConnection,
  registrationId: number,
  lines: ResolvedExtraLine[],
  answers: ExtraFieldAnswersInput | undefined,
): Promise<void> {
  const answersByExtra = new Map<number, Record<string, unknown>>();
  for (const row of answers ?? []) {
    if (row.extraId > 0 && row.values) {
      answersByExtra.set(row.extraId, row.values);
    }
  }
  const extraIds = lines.map((l) => l.extraId);
  const fieldsByExtra = await fetchFieldsByExtraIds(conn, extraIds);

  for (const line of lines) {
    const [ins] = await conn.query<ResultSetHeader>(
      `INSERT INTO registration_extras (
         registration_id, event_extra_id, name, quantity, unit_price_cents, total_cents
       ) VALUES (?,?,?,?,?,?)`,
      [
        registrationId,
        line.extraId,
        line.name.slice(0, 150),
        line.quantity,
        line.unitPriceCents,
        line.totalCents,
      ],
    );
    const registrationExtraId = ins.insertId;
    const fields = (fieldsByExtra.get(line.extraId) ?? []) as EventExtraFieldDefinition[];
    const values = answersByExtra.get(line.extraId) ?? {};
    for (const field of fields) {
      const raw = values[field.field_key];
      const serialized = serializeExtraFieldAnswer(field, raw);
      await conn.query<ResultSetHeader>(
        `INSERT INTO registration_extra_field_values (
           registration_extra_id, field_key, label, value_text, value_json
         ) VALUES (?,?,?,?,?)`,
        [
          registrationExtraId,
          field.field_key,
          field.label.slice(0, 200),
          serialized.value_text,
          serialized.value_json ? JSON.stringify(serialized.value_json) : null,
        ],
      );
    }
  }
}

export { sumExtrasSubtotalCents };
