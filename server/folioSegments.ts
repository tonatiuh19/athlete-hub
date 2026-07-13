import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { EventExtraScopeType } from "../shared/api.js";
import {
  findMatchingFolioSegment,
  folioCounterScopeKey,
  legacyRegistrationNumber,
  normalizeFolioPatternParts,
  renderFolioPattern,
  type FolioCounterScope,
  type FolioCouponScope,
  type FolioPatternPart,
  type FolioSegmentMatchInput,
  type FolioSegmentRule,
} from "../shared/folioSegments.js";

export type FolioSegmentRouteError = {
  status: number;
  error: string;
};

export type RegistrationFolioContext = FolioSegmentMatchInput & {
  eventId: number;
  discountCode?: string | null;
  eventYear?: string | null;
  eventCode?: string | null;
};

type DbConn = Pool | PoolConnection;

const SEGMENT_SELECT = `id, event_id, name, sort_order, is_active, category_scope, coupon_scope,
  discount_code_id, counter_scope, prefix_value, category_code, pattern_tokens,
  seq_padding, start_number, created_at, updated_at`;

async function fetchCategoryIdsBySegmentIds(
  executor: DbConn,
  segmentIds: number[],
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (segmentIds.length === 0) return map;
  const placeholders = segmentIds.map(() => "?").join(", ");
  const [rows] = await executor.query<RowDataPacket[]>(
    `SELECT folio_segment_id, event_category_id
     FROM event_folio_segment_categories
     WHERE folio_segment_id IN (${placeholders})`,
    segmentIds,
  );
  for (const row of rows) {
    const segmentId = Number(row.folio_segment_id);
    const list = map.get(segmentId) ?? [];
    list.push(Number(row.event_category_id));
    map.set(segmentId, list);
  }
  return map;
}

function mapSegmentRow(
  row: RowDataPacket,
  categoryIds: number[],
): RowDataPacket {
  let patternTokens: FolioPatternPart[] = [];
  try {
    const raw =
      typeof row.pattern_tokens === "string"
        ? JSON.parse(row.pattern_tokens)
        : row.pattern_tokens;
    patternTokens = normalizeFolioPatternParts(raw);
  } catch {
    patternTokens = normalizeFolioPatternParts(null);
  }

  return {
    ...row,
    is_active: Boolean(row.is_active),
    category_scope: String(row.category_scope ?? "all_categories") as EventExtraScopeType,
    coupon_scope: String(row.coupon_scope ?? "any") as FolioCouponScope,
    counter_scope: String(row.counter_scope ?? "segment") as FolioCounterScope,
    category_ids: categoryIds,
    pattern_tokens: patternTokens,
    prefix_value: String(row.prefix_value ?? ""),
    category_code: String(row.category_code ?? ""),
    seq_padding: Number(row.seq_padding) || 5,
    start_number: Number(row.start_number) || 1,
  };
}

export async function fetchStaffFolioSegments(
  pool: DbConn,
  eventId: number,
): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SEGMENT_SELECT}
     FROM event_folio_segments
     WHERE event_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [eventId],
  );
  const ids = rows.map((row) => Number(row.id));
  const categoriesBySegment = await fetchCategoryIdsBySegmentIds(pool, ids);
  return rows.map((row) =>
    mapSegmentRow(row, categoriesBySegment.get(Number(row.id)) ?? []),
  );
}

export async function fetchActiveFolioSegmentsForEvent(
  pool: DbConn,
  eventId: number,
): Promise<RowDataPacket[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${SEGMENT_SELECT}
     FROM event_folio_segments
     WHERE event_id = ? AND is_active = 1
     ORDER BY sort_order ASC, id ASC`,
    [eventId],
  );
  const ids = rows.map((row) => Number(row.id));
  const categoriesBySegment = await fetchCategoryIdsBySegmentIds(pool, ids);
  return rows.map((row) =>
    mapSegmentRow(row, categoriesBySegment.get(Number(row.id)) ?? []),
  );
}

type ParsedFolioSegmentInput = {
  id?: number;
  name: string;
  sort_order: number;
  is_active: number;
  category_scope: EventExtraScopeType;
  category_ids: number[];
  coupon_scope: FolioCouponScope;
  discount_code_id: number | null;
  counter_scope: FolioCounterScope;
  prefix_value: string;
  category_code: string;
  pattern_tokens: FolioPatternPart[];
  seq_padding: number;
  start_number: number;
};

function parseCouponScope(raw: unknown): FolioCouponScope {
  const value = String(raw ?? "any");
  if (["any", "none", "any_coupon", "specific_coupon"].includes(value)) {
    return value as FolioCouponScope;
  }
  return "any";
}

function parseCounterScope(raw: unknown): FolioCounterScope | null {
  const value = String(raw ?? "");
  if (["segment", "event", "category"].includes(value)) {
    return value as FolioCounterScope;
  }
  return null;
}

function parseFolioSegmentInput(
  raw: Record<string, unknown>,
  index: number,
): ParsedFolioSegmentInput | null {
  const name = String(raw.name ?? "").trim();
  if (!name) return null;

  const counter_scope = parseCounterScope(raw.counter_scope);
  if (!counter_scope) return null;

  const coupon_scope = parseCouponScope(raw.coupon_scope);
  const category_scope: EventExtraScopeType =
    raw.category_scope === "selected_categories" ? "selected_categories" : "all_categories";
  const category_ids = Array.isArray(raw.category_ids)
    ? [...new Set(raw.category_ids.map((id) => Number(id)).filter((id) => id > 0))]
    : [];

  const discount_code_id =
    raw.discount_code_id != null && Number(raw.discount_code_id) > 0
      ? Number(raw.discount_code_id)
      : null;

  if (coupon_scope === "specific_coupon" && !discount_code_id) {
    return null;
  }

  const prefix_value = String(raw.prefix_value ?? "")
    .trim()
    .slice(0, 24);
  const category_code = String(raw.category_code ?? "")
    .trim()
    .slice(0, 24);
  const pattern_tokens = normalizeFolioPatternParts(raw.pattern_tokens);
  const seq_padding = Math.min(10, Math.max(1, Number(raw.seq_padding) || 5));
  const start_number = Math.max(1, Number(raw.start_number) || 1);

  return {
    id: raw.id != null && Number(raw.id) > 0 ? Number(raw.id) : undefined,
    name: name.slice(0, 120),
    sort_order: Number(raw.sort_order) || index,
    is_active: raw.is_active === false ? 0 : 1,
    category_scope,
    category_ids,
    coupon_scope,
    discount_code_id,
    counter_scope,
    prefix_value,
    category_code,
    pattern_tokens,
    seq_padding,
    start_number,
  };
}

async function syncFolioSegmentCategories(
  executor: DbConn,
  segmentId: number,
  eventId: number,
  scopeType: EventExtraScopeType,
  categoryIds: number[],
): Promise<FolioSegmentRouteError | null> {
  await executor.query<ResultSetHeader>(
    "DELETE FROM event_folio_segment_categories WHERE folio_segment_id = ?",
    [segmentId],
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
      `INSERT INTO event_folio_segment_categories (folio_segment_id, event_category_id)
       VALUES (?,?)`,
      [segmentId, categoryId],
    );
  }
  return null;
}

async function validateDiscountCodeForEvent(
  executor: DbConn,
  eventId: number,
  discountCodeId: number | null,
): Promise<FolioSegmentRouteError | null> {
  if (!discountCodeId) return null;
  const [rows] = await executor.query<RowDataPacket[]>(
    "SELECT id FROM discount_codes WHERE id = ? AND event_id = ? LIMIT 1",
    [discountCodeId, eventId],
  );
  if (rows.length === 0) {
    return { status: 400, error: "Invalid discount code" };
  }
  return null;
}

export async function replaceEventFolioSegments(
  pool: Pool,
  eventId: number,
  rawSegments: unknown[],
): Promise<
  | { ok: true; segments: RowDataPacket[] }
  | { ok: false; error: FolioSegmentRouteError }
> {
  if (!Array.isArray(rawSegments)) {
    return { ok: false, error: { status: 400, error: "segments array required" } };
  }

  const segments = rawSegments
    .map((item, index) =>
      item && typeof item === "object"
        ? parseFolioSegmentInput(item as Record<string, unknown>, index)
        : null,
    )
    .filter(Boolean) as ParsedFolioSegmentInput[];

  if (segments.length !== rawSegments.length) {
    return {
      ok: false,
      error: { status: 400, error: "Invalid segment configuration" },
    };
  }

  for (const segment of segments) {
    if (
      segment.category_scope === "selected_categories" &&
      segment.category_ids.length === 0
    ) {
      return { ok: false, error: { status: 400, error: "Select at least one category" } };
    }
    const discountErr = await validateDiscountCodeForEvent(
      pool,
      eventId,
      segment.coupon_scope === "specific_coupon" ? segment.discount_code_id : null,
    );
    if (discountErr) {
      return { ok: false, error: discountErr };
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existingRows] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM event_folio_segments WHERE event_id = ?",
      [eventId],
    );
    const existingIds = new Set(existingRows.map((row) => Number(row.id)));
    const incomingIds = new Set(
      segments.map((s) => s.id).filter((id): id is number => id != null),
    );

    for (const existingId of existingIds) {
      if (incomingIds.has(existingId)) continue;
      const [usage] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM registrations WHERE folio_segment_id = ? LIMIT 1",
        [existingId],
      );
      if (usage.length > 0) {
        await conn.rollback();
        return {
          ok: false,
          error: {
            status: 409,
            error: "Cannot remove a segment that already issued folios",
          },
        };
      }
      await conn.query("DELETE FROM event_folio_segments WHERE id = ?", [existingId]);
    }

    for (const segment of segments) {
      const patternJson = JSON.stringify(segment.pattern_tokens);
      let segmentId = segment.id;

      if (segmentId && existingIds.has(segmentId)) {
        await conn.query<ResultSetHeader>(
          `UPDATE event_folio_segments SET
             name = ?, sort_order = ?, is_active = ?, category_scope = ?, coupon_scope = ?,
             discount_code_id = ?, counter_scope = ?, prefix_value = ?, category_code = ?,
             pattern_tokens = ?, seq_padding = ?, start_number = ?
           WHERE id = ? AND event_id = ?`,
          [
            segment.name,
            segment.sort_order,
            segment.is_active,
            segment.category_scope,
            segment.coupon_scope,
            segment.discount_code_id,
            segment.counter_scope,
            segment.prefix_value,
            segment.category_code,
            patternJson,
            segment.seq_padding,
            segment.start_number,
            segmentId,
            eventId,
          ],
        );
      } else {
        const [ins] = await conn.query<ResultSetHeader>(
          `INSERT INTO event_folio_segments (
             event_id, name, sort_order, is_active, category_scope, coupon_scope,
             discount_code_id, counter_scope, prefix_value, category_code, pattern_tokens,
             seq_padding, start_number
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            eventId,
            segment.name,
            segment.sort_order,
            segment.is_active,
            segment.category_scope,
            segment.coupon_scope,
            segment.discount_code_id,
            segment.counter_scope,
            segment.prefix_value,
            segment.category_code,
            patternJson,
            segment.seq_padding,
            segment.start_number,
          ],
        );
        segmentId = ins.insertId;
      }

      const catErr = await syncFolioSegmentCategories(
        conn,
        segmentId,
        eventId,
        segment.category_scope,
        segment.category_ids,
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

  return { ok: true, segments: await fetchStaffFolioSegments(pool, eventId) };
}

async function nextCounterValue(
  conn: PoolConnection,
  eventId: number,
  counterScope: FolioCounterScope,
  scopeKey: string,
  startNumber: number,
): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id, last_issued_number FROM event_folio_counters
     WHERE event_id = ? AND counter_scope = ? AND scope_key = ?
     LIMIT 1 FOR UPDATE`,
    [eventId, counterScope, scopeKey],
  );

  if (rows.length === 0) {
    const first = startNumber;
    await conn.query<ResultSetHeader>(
      `INSERT INTO event_folio_counters (event_id, counter_scope, scope_key, last_issued_number)
       VALUES (?,?,?,?)`,
      [eventId, counterScope, scopeKey, first],
    );
    return first;
  }

  const last = Number(rows[0].last_issued_number) || 0;
  const next = last < startNumber ? startNumber : last + 1;
  await conn.query<ResultSetHeader>(
    "UPDATE event_folio_counters SET last_issued_number = ? WHERE id = ?",
    [next, rows[0].id],
  );
  return next;
}

async function nextLegacySequence(
  conn: PoolConnection,
  eventId: number,
): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM registrations
     WHERE event_id = ? AND folio_segment_id IS NULL`,
    [eventId],
  );
  return Number(rows[0]?.c ?? 0) + 1;
}

export async function allocateRegistrationNumber(
  conn: PoolConnection,
  ctx: RegistrationFolioContext,
): Promise<{ registrationNumber: string; folioSegmentId: number | null }> {
  const segments = await fetchActiveFolioSegmentsForEvent(conn, ctx.eventId);
  const match = findMatchingFolioSegment(
    segments as Array<FolioSegmentRule & { id: number }>,
    ctx,
  );

  if (!match) {
    const sequence = await nextLegacySequence(conn, ctx.eventId);
    return {
      registrationNumber: legacyRegistrationNumber(ctx.eventId, sequence),
      folioSegmentId: null,
    };
  }

  const segmentId = Number(match.id);
  const counterScope = String(match.counter_scope) as FolioCounterScope;
  const scopeKey = folioCounterScopeKey(counterScope, segmentId, ctx.categoryId);
  const startNumber = Number(match.start_number) || 1;
  const sequence = await nextCounterValue(
    conn,
    ctx.eventId,
    counterScope,
    scopeKey,
    startNumber,
  );

  const patternTokens = normalizeFolioPatternParts(match.pattern_tokens);
  const registrationNumber = renderFolioPattern(patternTokens, {
    prefix_value: String(match.prefix_value ?? ""),
    category_code: String(match.category_code ?? ""),
    event_year: ctx.eventYear ?? null,
    coupon_code: ctx.discountCode ?? null,
    event_code: ctx.eventCode ?? String(ctx.eventId).padStart(4, "0"),
    sequence,
    seq_padding: Number(match.seq_padding) || 5,
  });

  if (!registrationNumber.trim()) {
    const fallbackSequence = await nextLegacySequence(conn, ctx.eventId);
    return {
      registrationNumber: legacyRegistrationNumber(ctx.eventId, fallbackSequence),
      folioSegmentId: null,
    };
  }

  return { registrationNumber, folioSegmentId: segmentId };
}

export function mapStaffFolioSegment(row: RowDataPacket) {
  return {
    id: Number(row.id),
    event_id: Number(row.event_id),
    name: String(row.name),
    sort_order: Number(row.sort_order),
    is_active: Boolean(row.is_active),
    category_scope: String(row.category_scope ?? "all_categories"),
    category_ids: (row.category_ids as number[]) ?? [],
    coupon_scope: String(row.coupon_scope ?? "any"),
    discount_code_id: row.discount_code_id != null ? Number(row.discount_code_id) : null,
    counter_scope: String(row.counter_scope ?? "segment"),
    prefix_value: String(row.prefix_value ?? ""),
    category_code: String(row.category_code ?? ""),
    pattern_tokens: normalizeFolioPatternParts(row.pattern_tokens),
    seq_padding: Number(row.seq_padding) || 5,
    start_number: Number(row.start_number) || 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
