import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { EventExtraScopeType } from "@shared/api";
import type { FolioCounterScope, FolioCouponScope } from "@shared/folioSegments";

export type FolioSegmentRow = RowDataPacket & {
  id: number;
  event_id: number;
  name: string;
  sort_order: number;
  is_active: number;
  category_scope: EventExtraScopeType;
  coupon_scope: FolioCouponScope;
  discount_code_id: number | null;
  counter_scope: FolioCounterScope;
  prefix_value: string;
  category_code: string;
  pattern_tokens: string;
  seq_padding: number;
  start_number: number;
  created_at: string;
  updated_at: string;
};

export type FolioSegmentCategoryRow = RowDataPacket & {
  folio_segment_id: number;
  event_category_id: number;
};

export type FolioCounterRow = RowDataPacket & {
  id: number;
  event_id: number;
  counter_scope: FolioCounterScope;
  scope_key: string;
  last_issued_number: number;
};

export type FolioSegmentsSqlContext = {
  segments: FolioSegmentRow[];
  segmentCategories: FolioSegmentCategoryRow[];
  counters: FolioCounterRow[];
  nextSegmentId: { current: number };
  nextCounterId: { current: number };
  resolveCategoryIds: (eventId: number, categoryIds: number[]) => number[];
};

function header(insertId = 0, affectedRows = 1): ResultSetHeader {
  return { insertId, affectedRows } as ResultSetHeader;
}

function replaceInPlace<T>(target: T[], next: T[]) {
  target.length = 0;
  target.push(...next);
}

function categoryIdsForSegment(ctx: FolioSegmentsSqlContext, segmentId: number): number[] {
  return ctx.segmentCategories
    .filter((row) => Number(row.folio_segment_id) === segmentId)
    .map((row) => Number(row.event_category_id));
}

function enrichSegments(ctx: FolioSegmentsSqlContext, rows: FolioSegmentRow[]) {
  return rows.map((row) => ({
    ...row,
    category_ids: categoryIdsForSegment(ctx, Number(row.id)),
    pattern_tokens:
      typeof row.pattern_tokens === "string"
        ? row.pattern_tokens
        : JSON.stringify(row.pattern_tokens),
  }));
}

type SqlHit =
  | { type: "rows"; rows: RowDataPacket[] }
  | { type: "header"; header: ResultSetHeader }
  | null;

export function handleFolioSegmentsScenarioSql(
  q: string,
  params: unknown[],
  ctx: FolioSegmentsSqlContext,
): SqlHit {
  if (q.includes("from event_folio_segment_categories")) {
    const ids = params.map((p) => Number(p));
    const rows = ctx.segmentCategories
      .filter((row) => ids.includes(Number(row.folio_segment_id)))
      .map((row) => ({ ...row }));
    return { type: "rows", rows };
  }

  if (q.includes("delete from event_folio_segment_categories")) {
    const segmentId = Number(params[0]);
    const before = ctx.segmentCategories.length;
    replaceInPlace(
      ctx.segmentCategories,
      ctx.segmentCategories.filter((row) => Number(row.folio_segment_id) !== segmentId),
    );
    return {
      type: "header",
      header: header(0, before - ctx.segmentCategories.length),
    };
  }

  if (q.includes("insert into event_folio_segment_categories")) {
    ctx.segmentCategories.push({
      folio_segment_id: Number(params[0]),
      event_category_id: Number(params[1]),
    } as FolioSegmentCategoryRow);
    return { type: "header", header: header(0, 1) };
  }

  if (q.includes("select id from event_folio_segments where event_id")) {
    const eventId = Number(params[0]);
    return {
      type: "rows",
      rows: ctx.segments
        .filter((row) => Number(row.event_id) === eventId)
        .map((row) => ({ id: row.id })) as RowDataPacket[],
    };
  }

  if (q.includes("select id from registrations where folio_segment_id")) {
    return { type: "rows", rows: [] };
  }

  if (q.includes("delete from event_folio_segments where id")) {
    const segmentId = Number(params[0]);
    const before = ctx.segments.length;
    replaceInPlace(
      ctx.segments,
      ctx.segments.filter((row) => Number(row.id) !== segmentId),
    );
    replaceInPlace(
      ctx.segmentCategories,
      ctx.segmentCategories.filter((row) => Number(row.folio_segment_id) !== segmentId),
    );
    return { type: "header", header: header(0, before - ctx.segments.length) };
  }

  if (q.startsWith("update event_folio_segments set")) {
    const segmentId = Number(params[params.length - 2]);
    const eventId = Number(params[params.length - 1]);
    const row = ctx.segments.find(
      (item) => Number(item.id) === segmentId && Number(item.event_id) === eventId,
    );
    if (row) {
      row.name = String(params[0]);
      row.sort_order = Number(params[1]);
      row.is_active = Number(params[2]);
      row.category_scope = String(params[3]) as EventExtraScopeType;
      row.coupon_scope = String(params[4]) as FolioCouponScope;
      row.discount_code_id = params[5] != null ? Number(params[5]) : null;
      row.counter_scope = String(params[6]) as FolioCounterScope;
      row.prefix_value = String(params[7]);
      row.category_code = String(params[8]);
      row.pattern_tokens = String(params[9]);
      row.seq_padding = Number(params[10]);
      row.start_number = Number(params[11]);
      row.updated_at = new Date().toISOString();
    }
    return { type: "header", header: header(0, row ? 1 : 0) };
  }

  if (q.startsWith("insert into event_folio_segments")) {
    const id = ctx.nextSegmentId.current++;
    const now = new Date().toISOString();
    const row = {
      id,
      event_id: Number(params[0]),
      name: String(params[1]),
      sort_order: Number(params[2]),
      is_active: Number(params[3]),
      category_scope: String(params[4]) as EventExtraScopeType,
      coupon_scope: String(params[5]) as FolioCouponScope,
      discount_code_id: params[6] != null ? Number(params[6]) : null,
      counter_scope: String(params[7]) as FolioCounterScope,
      prefix_value: String(params[8]),
      category_code: String(params[9]),
      pattern_tokens: String(params[10]),
      seq_padding: Number(params[11]),
      start_number: Number(params[12]),
      created_at: now,
      updated_at: now,
    } as FolioSegmentRow;
    ctx.segments.push(row);
    return { type: "header", header: header(id, 1) };
  }

  if (q.includes("from event_folio_segments")) {
    const eventId = Number(params[0]);
    let rows = ctx.segments.filter((row) => Number(row.event_id) === eventId);
    if (q.includes("is_active = 1")) {
      rows = rows.filter((row) => Number(row.is_active) === 1);
    }
    rows = [...rows].sort(
      (a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id),
    );
    return { type: "rows", rows: enrichSegments(ctx, rows) };
  }

  if (q.includes("from event_folio_counters") && q.includes("for update")) {
    const eventId = Number(params[0]);
    const counterScope = String(params[1]);
    const scopeKey = String(params[2]);
    const row = ctx.counters.find(
      (item) =>
        Number(item.event_id) === eventId &&
        item.counter_scope === counterScope &&
        item.scope_key === scopeKey,
    );
    return { type: "rows", rows: row ? [{ ...row }] : [] };
  }

  if (q.startsWith("insert into event_folio_counters")) {
    const id = ctx.nextCounterId.current++;
    ctx.counters.push({
      id,
      event_id: Number(params[0]),
      counter_scope: String(params[1]) as FolioCounterScope,
      scope_key: String(params[2]),
      last_issued_number: Number(params[3]),
    } as FolioCounterRow);
    return { type: "header", header: header(id, 1) };
  }

  if (q.startsWith("update event_folio_counters set")) {
    const counterId = Number(params[1]);
    const row = ctx.counters.find((item) => Number(item.id) === counterId);
    if (row) row.last_issued_number = Number(params[0]);
    return { type: "header", header: header(0, row ? 1 : 0) };
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

  if (q.includes("select id from discount_codes where id = ? and event_id = ?")) {
    return { type: "rows", rows: [] };
  }

  return null;
}
