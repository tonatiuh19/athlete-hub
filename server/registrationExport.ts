import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  REGISTRATION_EXPORT_CORE_COLUMNS,
  REGISTRATION_EXPORT_MAX_COLUMNS,
  REGISTRATION_EXPORT_MAX_ROWS,
  REGISTRATION_EXPORT_STATUSES,
  coreColumnIdsForPreset,
  extraFieldColumnId,
  extraQtyColumnId,
  extraTotalColumnId,
  fieldExportColumnId,
  formatCentsAsMxn,
  formatExportYesNo,
  formatExtraAnswerValue,
  parseExportColumnId,
  rowsToCsv,
  type RegistrationExportCatalogResponse,
  type RegistrationExportColumnMeta,
  type RegistrationExportJsonResponse,
  type RegistrationExportPresetId,
  type RegistrationExportStatus,
} from "../shared/registrationExport.js";

const CORE_LABELS: Record<string, string> = {
  folio: "Folio",
  bib: "Bib",
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  date_of_birth: "Date of birth",
  gender: "Gender",
  shirt_size: "Shirt size",
  category: "Category",
  status: "Status",
  total_mxn: "Total (MXN)",
  price_mxn: "Registration (MXN)",
  fee_mxn: "Service fee (MXN)",
  source: "Source",
  waiver: "Waiver signed",
  checked_in: "Checked in",
  purchaser_name: "Purchaser name",
  purchaser_email: "Purchaser email",
  managed: "Managed participant",
  claim_pending: "Claim pending",
  created_at: "Registered at",
};

function yesNoFromTruthy(value: unknown): string {
  return formatExportYesNo(Boolean(value));
}

function partyFlags(row: RowDataPacket): { managed: boolean; claimPending: boolean } {
  const claimPending = Boolean(row.guest_claim_token);
  const purchaserId = row.purchaser_athlete_id != null ? Number(row.purchaser_athlete_id) : null;
  const athleteId = row.athlete_id != null ? Number(row.athlete_id) : null;
  const managed =
    purchaserId != null && athleteId != null && purchaserId !== athleteId && !claimPending;
  return { managed, claimPending };
}

function coreCell(key: string, row: RowDataPacket): string {
  const flags = partyFlags(row);
  switch (key) {
    case "folio":
      return String(row.registration_number ?? "");
    case "bib":
      return row.bib_number != null ? String(row.bib_number) : "";
    case "first_name":
      return String(row.athlete_first_name ?? "");
    case "last_name":
      return String(row.athlete_last_name ?? "");
    case "email":
      return row.athlete_email != null ? String(row.athlete_email) : "";
    case "phone":
      return row.athlete_phone != null ? String(row.athlete_phone) : "";
    case "date_of_birth":
      return row.athlete_dob != null ? String(row.athlete_dob).slice(0, 10) : "";
    case "gender":
      return row.athlete_gender != null ? String(row.athlete_gender) : "";
    case "shirt_size":
      return row.athlete_shirt_size != null ? String(row.athlete_shirt_size) : "";
    case "category":
      return String(row.category_name ?? "");
    case "status":
      return String(row.status ?? "");
    case "total_mxn":
      return formatCentsAsMxn(Number(row.total_cents));
    case "price_mxn":
      return formatCentsAsMxn(Number(row.price_cents));
    case "fee_mxn":
      return formatCentsAsMxn(Number(row.service_fee_cents));
    case "source":
      return row.source != null ? String(row.source) : "";
    case "waiver":
      return yesNoFromTruthy(row.waiver_signed_at);
    case "checked_in":
      return yesNoFromTruthy(row.checked_in_at);
    case "purchaser_name": {
      const first = row.purchaser_first_name != null ? String(row.purchaser_first_name) : "";
      const last = row.purchaser_last_name != null ? String(row.purchaser_last_name) : "";
      return `${first} ${last}`.trim();
    }
    case "purchaser_email":
      return row.purchaser_email != null ? String(row.purchaser_email) : "";
    case "managed":
      return formatExportYesNo(flags.managed);
    case "claim_pending":
      return formatExportYesNo(flags.claimPending);
    case "created_at":
      return row.created_at != null ? String(row.created_at) : "";
    default:
      return "";
  }
}

export async function buildRegistrationExportCatalog(
  pool: Pool,
  eventId: number,
): Promise<RegistrationExportCatalogResponse | null> {
  const [eventRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, title, slug FROM events WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [eventId],
  );
  if (eventRows.length === 0) return null;
  const event = eventRows[0];

  const columns: RegistrationExportColumnMeta[] = REGISTRATION_EXPORT_CORE_COLUMNS.map((c) => {
    const key = c.id.slice("core.".length);
    return {
      id: c.id,
      kind: "core" as const,
      label: CORE_LABELS[key] ?? key,
      group_id: "core",
      group_label: "Core",
    };
  });

  const [fieldRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, field_key, label, field_type, is_active
     FROM event_registration_fields
     WHERE event_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [eventId],
  );
  for (const f of fieldRows) {
    columns.push({
      id: fieldExportColumnId(Number(f.id)),
      kind: "field",
      label: String(f.label),
      group_id: "fields",
      group_label: "Registration fields",
      description: `${f.field_key} · ${f.field_type}${f.is_active ? "" : " (inactive)"}`,
    });
  }

  const [extraRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, extra_type, is_active
     FROM event_extras
     WHERE event_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [eventId],
  );
  const extraIds = extraRows.map((e) => Number(e.id));
  const fieldsByExtra = new Map<number, RowDataPacket[]>();
  if (extraIds.length > 0) {
    const placeholders = extraIds.map(() => "?").join(", ");
    const [extraFields] = await pool.query<RowDataPacket[]>(
      `SELECT id, event_extra_id, field_key, label, field_type
       FROM event_extra_fields
       WHERE event_extra_id IN (${placeholders})
       ORDER BY sort_order ASC, id ASC`,
      extraIds,
    );
    for (const ef of extraFields) {
      const eid = Number(ef.event_extra_id);
      const list = fieldsByExtra.get(eid) ?? [];
      list.push(ef);
      fieldsByExtra.set(eid, list);
    }
  }

  for (const extra of extraRows) {
    const extraId = Number(extra.id);
    const name = String(extra.name);
    const type = String(extra.extra_type ?? "custom");
    const inactive = extra.is_active ? "" : " (inactive)";
    const groupId = `extra.${extraId}`;
    const groupLabel = `Extra · ${name}`;

    columns.push({
      id: extraQtyColumnId(extraId),
      kind: "extra_qty",
      label: `${name} — qty`,
      group_id: groupId,
      group_label: groupLabel,
      extra_type: type,
      description: `Quantity purchased${inactive}`,
    });
    columns.push({
      id: extraTotalColumnId(extraId),
      kind: "extra_total",
      label: `${name} — total (MXN)`,
      group_id: groupId,
      group_label: groupLabel,
      extra_type: type,
      description: `Line total${inactive}`,
    });

    for (const ef of fieldsByExtra.get(extraId) ?? []) {
      const fieldKey = String(ef.field_key);
      columns.push({
        id: extraFieldColumnId(extraId, fieldKey),
        kind: "extra_field",
        label: `${name} · ${String(ef.label)}`,
        group_id: groupId,
        group_label: groupLabel,
        extra_type: type,
        description: `${fieldKey} · ${ef.field_type}`,
      });
    }
  }

  const allIds = columns.map((c) => c.id);
  const presets: RegistrationExportCatalogResponse["presets"] = (
    ["essentials", "race_day", "logistics", "full"] as RegistrationExportPresetId[]
  ).map((id) => {
    if (id === "full") {
      return { id, column_ids: allIds };
    }
    const coreIds = new Set(coreColumnIdsForPreset(id));
    const selected = allIds.filter((cid) => {
      if (coreIds.has(cid)) return true;
      if (id === "logistics" && (cid.startsWith("extra.") || cid.startsWith("field."))) {
        return true;
      }
      return false;
    });
    return { id, column_ids: selected };
  });

  return {
    event_id: Number(event.id),
    event_title: String(event.title),
    event_slug: String(event.slug),
    columns,
    presets,
    default_statuses: ["confirmed", "pending_payment"],
  };
}

function normalizeStatuses(input: unknown): RegistrationExportStatus[] {
  const allowed = new Set<string>(REGISTRATION_EXPORT_STATUSES);
  const raw = Array.isArray(input) ? input : [];
  const out = raw
    .map((s) => String(s).trim())
    .filter((s): s is RegistrationExportStatus => allowed.has(s));
  if (out.length === 0) return ["confirmed", "pending_payment"];
  return out;
}

function normalizeColumnIds(
  input: unknown,
  catalogIds: Set<string>,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "columns array required" };
  }
  if (input.length > REGISTRATION_EXPORT_MAX_COLUMNS) {
    return {
      ok: false,
      error: `Maximum ${REGISTRATION_EXPORT_MAX_COLUMNS} columns`,
    };
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    if (!catalogIds.has(id) || !parseExportColumnId(id)) {
      return { ok: false, error: `Unknown column: ${id}` };
    }
    seen.add(id);
    ids.push(id);
  }
  if (ids.length === 0) {
    return { ok: false, error: "columns array required" };
  }
  return { ok: true, ids };
}

export async function buildRegistrationExport(
  pool: Pool,
  eventId: number,
  body: {
    columns?: unknown;
    statuses?: unknown;
    q?: unknown;
  },
): Promise<
  | { ok: true; payload: RegistrationExportJsonResponse; csv: string; filename: string }
  | { ok: false; status: number; error: string }
> {
  const catalog = await buildRegistrationExportCatalog(pool, eventId);
  if (!catalog) {
    return { ok: false, status: 404, error: "Event not found" };
  }

  const catalogById = new Map(catalog.columns.map((c) => [c.id, c]));
  const normalized = normalizeColumnIds(
    body.columns,
    new Set(catalog.columns.map((c) => c.id)),
  );
  if (normalized.ok === false) {
    return { ok: false, status: 400, error: normalized.error };
  }
  const columnIds = normalized.ids;
  const statuses = normalizeStatuses(body.statuses);
  const q = String(body.q ?? "").trim();

  const statusPlaceholders = statuses.map(() => "?").join(", ");
  const params: (string | number)[] = [eventId, ...statuses];
  let qSql = "";
  if (q) {
    const like = `%${q}%`;
    qSql = ` AND (
      r.registration_number LIKE ? OR r.bib_number LIKE ?
      OR a.email LIKE ? OR a.first_name LIKE ? OR a.last_name LIKE ?
      OR CONCAT(a.first_name, ' ', a.last_name) LIKE ?
    )`;
    params.push(like, like, like, like, like, like);
  }

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt
     FROM registrations r
     JOIN athletes a ON a.id = r.athlete_id AND a.deleted_at IS NULL
     WHERE r.event_id = ? AND r.deleted_at IS NULL
       AND r.status IN (${statusPlaceholders})${qSql}`,
    params,
  );
  const rowCount = Number(countRows[0]?.cnt ?? 0);
  if (rowCount > REGISTRATION_EXPORT_MAX_ROWS) {
    return {
      ok: false,
      status: 400,
      error: `Too many rows (${rowCount}). Narrow filters (max ${REGISTRATION_EXPORT_MAX_ROWS}).`,
    };
  }

  const [regRows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.registration_number, r.bib_number, r.status, r.source,
            r.price_cents, r.service_fee_cents, r.total_cents,
            r.waiver_signed_at, r.checked_in_at, r.created_at,
            r.athlete_id, r.purchaser_athlete_id, r.guest_claim_token,
            ec.name AS category_name,
            a.first_name AS athlete_first_name, a.last_name AS athlete_last_name,
            a.email AS athlete_email, a.phone AS athlete_phone,
            a.date_of_birth AS athlete_dob, a.gender AS athlete_gender,
            a.shirt_size AS athlete_shirt_size,
            p.first_name AS purchaser_first_name, p.last_name AS purchaser_last_name,
            p.email AS purchaser_email
     FROM registrations r
     JOIN event_categories ec ON ec.id = r.event_category_id
     JOIN athletes a ON a.id = r.athlete_id AND a.deleted_at IS NULL
     LEFT JOIN athletes p ON p.id = r.purchaser_athlete_id AND p.deleted_at IS NULL
     WHERE r.event_id = ? AND r.deleted_at IS NULL
       AND r.status IN (${statusPlaceholders})${qSql}
     ORDER BY r.registration_number ASC, r.id ASC`,
    params,
  );

  const regIds = regRows.map((r) => Number(r.id));
  const needsFields = columnIds.some((id) => id.startsWith("field."));
  const needsExtras = columnIds.some((id) => id.startsWith("extra."));

  const fieldValuesByReg = new Map<number, Map<number, string>>();
  if (needsFields && regIds.length > 0) {
    const placeholders = regIds.map(() => "?").join(", ");
    const [fvRows] = await pool.query<RowDataPacket[]>(
      `SELECT fv.registration_id, fv.field_id, fv.value_text, fv.value_file_url
       FROM registration_field_values fv
       WHERE fv.registration_id IN (${placeholders})`,
      regIds,
    );
    for (const fv of fvRows) {
      const rid = Number(fv.registration_id);
      const fid = Number(fv.field_id);
      const map = fieldValuesByReg.get(rid) ?? new Map<number, string>();
      const text = fv.value_text != null ? String(fv.value_text).trim() : "";
      const file = fv.value_file_url != null ? String(fv.value_file_url).trim() : "";
      map.set(fid, text || file);
      fieldValuesByReg.set(rid, map);
    }
  }

  type ExtraAgg = {
    qty: number;
    totalCents: number;
    fields: Map<string, string[]>;
  };
  const extrasByReg = new Map<number, Map<number, ExtraAgg>>();
  if (needsExtras && regIds.length > 0) {
    const placeholders = regIds.map(() => "?").join(", ");
    const [extraLines] = await pool.query<RowDataPacket[]>(
      `SELECT re.id, re.registration_id, re.event_extra_id, re.quantity, re.total_cents
       FROM registration_extras re
       WHERE re.registration_id IN (${placeholders})`,
      regIds,
    );
    const lineToRegExtra = new Map<number, { regId: number; extraId: number }>();
    for (const line of extraLines) {
      const regId = Number(line.registration_id);
      const extraId = Number(line.event_extra_id);
      const lineId = Number(line.id);
      lineToRegExtra.set(lineId, { regId, extraId });
      const byExtra = extrasByReg.get(regId) ?? new Map<number, ExtraAgg>();
      const agg = byExtra.get(extraId) ?? { qty: 0, totalCents: 0, fields: new Map() };
      agg.qty += Number(line.quantity) || 0;
      agg.totalCents += Number(line.total_cents) || 0;
      byExtra.set(extraId, agg);
      extrasByReg.set(regId, byExtra);
    }

    const lineIds = [...lineToRegExtra.keys()];
    if (lineIds.length > 0) {
      const linePh = lineIds.map(() => "?").join(", ");
      const [answers] = await pool.query<RowDataPacket[]>(
        `SELECT registration_extra_id, field_key, value_text, value_json
         FROM registration_extra_field_values
         WHERE registration_extra_id IN (${linePh})`,
        lineIds,
      );
      for (const ans of answers) {
        const meta = lineToRegExtra.get(Number(ans.registration_extra_id));
        if (!meta) continue;
        const byExtra = extrasByReg.get(meta.regId);
        const agg = byExtra?.get(meta.extraId);
        if (!agg) continue;
        const key = String(ans.field_key);
        const formatted = formatExtraAnswerValue(
          ans.value_text != null ? String(ans.value_text) : null,
          ans.value_json,
        );
        if (!formatted) continue;
        const list = agg.fields.get(key) ?? [];
        list.push(formatted);
        agg.fields.set(key, list);
      }
    }
  }

  const headers = columnIds.map((id) => catalogById.get(id)?.label ?? id);
  const rows: string[][] = regRows.map((row) => {
    const regId = Number(row.id);
    const fieldMap = fieldValuesByReg.get(regId);
    const extraMap = extrasByReg.get(regId);
    return columnIds.map((colId) => {
      const parsed = parseExportColumnId(colId);
      if (!parsed) return "";
      if (parsed.kind === "core") return coreCell(parsed.key, row);
      if (parsed.kind === "field") return fieldMap?.get(parsed.fieldId) ?? "";
      const agg = extraMap?.get(parsed.extraId);
      if (parsed.kind === "extra_qty") {
        return agg && agg.qty > 0 ? String(agg.qty) : "";
      }
      if (parsed.kind === "extra_total") {
        return agg && agg.totalCents > 0 ? formatCentsAsMxn(agg.totalCents) : "";
      }
      if (parsed.kind === "extra_field") {
        const vals = agg?.fields.get(parsed.fieldKey) ?? [];
        return [...new Set(vals)].join(" | ");
      }
      return "";
    });
  });

  const slug = catalog.event_slug.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60) || "event";
  const filename = `${slug}-registrations-export.csv`;
  const payload: RegistrationExportJsonResponse = {
    event_id: catalog.event_id,
    event_title: catalog.event_title,
    headers,
    column_ids: columnIds,
    row_count: rows.length,
    rows,
  };

  return {
    ok: true,
    payload,
    csv: rowsToCsv(headers, rows),
    filename,
  };
}
