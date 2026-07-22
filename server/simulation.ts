import crypto from "crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  SIMULATION_MAX_ACTIVE_PER_ORG,
  SIMULATION_MAX_REGS_PER_EVENT,
  SIMULATION_TTL_DAYS,
  simulationExpiresAtFrom,
} from "../shared/simulation.js";

export function newSimulationAccessToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function toMysqlDatetime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export async function bumpSimulationActivity(
  pool: Pool | PoolConnection,
  eventId: number,
): Promise<void> {
  const now = new Date();
  const expires = simulationExpiresAtFrom(now, SIMULATION_TTL_DAYS);
  await pool.query(
    `UPDATE events
     SET simulation_last_activity_at = ?,
         simulation_expires_at = ?
     WHERE id = ? AND is_simulation = 1 AND deleted_at IS NULL`,
    [toMysqlDatetime(now), toMysqlDatetime(expires), eventId],
  );
}

export async function countActiveSimulations(
  pool: Pool | PoolConnection,
  organizerId: number,
): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM events
     WHERE organizer_id = ? AND is_simulation = 1 AND deleted_at IS NULL
       AND (simulation_expires_at IS NULL OR simulation_expires_at > NOW())`,
    [organizerId],
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function countSimulationRegistrations(
  pool: Pool | PoolConnection,
  eventId: number,
): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM registrations
     WHERE event_id = ? AND is_simulation = 1 AND deleted_at IS NULL
       AND status IN ('confirmed','pending_payment')`,
    [eventId],
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function assertSimulationRegQuota(
  pool: Pool | PoolConnection,
  eventId: number,
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const n = await countSimulationRegistrations(pool, eventId);
  if (n >= SIMULATION_MAX_REGS_PER_EVENT) {
    return {
      ok: false,
      error: `Simulation registration limit reached (${SIMULATION_MAX_REGS_PER_EVENT}). Reset data or wait for cleanup.`,
      code: "simulation_reg_limit",
    };
  }
  return { ok: true };
}

export async function resolveSimulationByToken(
  pool: Pool | PoolConnection,
  token: string,
): Promise<RowDataPacket | null> {
  const t = String(token ?? "").trim();
  if (!t || t.length < 32) return null;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.*, o.name AS organizer_name, o.slug AS organizer_slug,
            o.service_fee_percent AS org_service_fee_percent,
            o.fee_presentation AS org_fee_presentation,
            st.slug AS sport_slug, st.name AS sport_name
     FROM events e
     JOIN organizers o ON o.id = e.organizer_id AND o.deleted_at IS NULL
     JOIN sport_types st ON st.id = e.sport_type_id
     WHERE e.simulation_access_token = ?
       AND e.is_simulation = 1
       AND e.deleted_at IS NULL
     LIMIT 1`,
    [t],
  );
  return rows[0] ?? null;
}

export async function loadSimulationEventForOrganizer(
  pool: Pool | PoolConnection,
  eventId: number,
  organizerId: number,
): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM events
     WHERE id = ? AND organizer_id = ? AND is_simulation = 1 AND deleted_at IS NULL
     LIMIT 1`,
    [eventId, organizerId],
  );
  return rows[0] ?? null;
}

/**
 * Wipe generated simulation data; keep event shell (categories/fields/config).
 */
export async function wipeSimulationGeneratedData(
  pool: Pool,
  eventId: number,
  opts?: { stripeCancel?: (piId: string) => Promise<void> },
): Promise<{
  registrations: number;
  payments: number;
  orders: number;
  athletesRemoved: number;
}> {
  const conn = await pool.getConnection();
  let registrations = 0;
  let payments = 0;
  let orders = 0;
  let athletesRemoved = 0;
  try {
    await conn.beginTransaction();

    const [regRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, athlete_id, payment_id, order_id, event_category_id, status
       FROM registrations
       WHERE event_id = ? AND deleted_at IS NULL`,
      [eventId],
    );
    const regIds = regRows.map((r) => Number(r.id));
    const athleteIds = [...new Set(regRows.map((r) => Number(r.athlete_id)))];
    const paymentIds = [
      ...new Set(
        regRows
          .map((r) => (r.payment_id != null ? Number(r.payment_id) : null))
          .filter((id): id is number => id != null),
      ),
    ];
    const orderIds = [
      ...new Set(
        regRows
          .map((r) => (r.order_id != null ? Number(r.order_id) : null))
          .filter((id): id is number => id != null),
      ),
    ];

    const [payExtra] = await conn.query<RowDataPacket[]>(
      `SELECT id, stripe_payment_intent_id FROM payments
       WHERE event_id = ? AND is_simulation = 1`,
      [eventId],
    );
    for (const p of payExtra) {
      const id = Number(p.id);
      if (!paymentIds.includes(id)) paymentIds.push(id);
    }

    if (opts?.stripeCancel) {
      for (const p of payExtra) {
        const pi = p.stripe_payment_intent_id ? String(p.stripe_payment_intent_id) : "";
        if (pi) {
          try {
            await opts.stripeCancel(pi);
          } catch {
            /* best-effort */
          }
        }
      }
    }

    if (regIds.length > 0) {
      const ph = regIds.map(() => "?").join(",");
      await conn.query(
        `DELETE FROM registration_field_values WHERE registration_id IN (${ph})`,
        regIds,
      );
      await conn.query(
        `DELETE refv FROM registration_extra_field_values refv
         INNER JOIN registration_extras re ON re.id = refv.registration_extra_id
         WHERE re.registration_id IN (${ph})`,
        regIds,
      );
      await conn.query(
        `DELETE FROM registration_extras WHERE registration_id IN (${ph})`,
        regIds,
      );
      await conn.query(
        `DELETE FROM registration_waiver_signatures WHERE registration_id IN (${ph})`,
        regIds,
      );
      await conn.query(
        `DELETE FROM registration_status_history WHERE registration_id IN (${ph})`,
        regIds,
      );
      await conn.query(
        `DELETE FROM check_in_logs WHERE registration_id IN (${ph})`,
        regIds,
      ).catch(() => undefined);
      await conn.query(
        `UPDATE registrations SET payment_id = NULL, order_id = NULL WHERE id IN (${ph})`,
        regIds,
      );
      const [delReg] = await conn.query<ResultSetHeader>(
        `DELETE FROM registrations WHERE id IN (${ph})`,
        regIds,
      );
      registrations = delReg.affectedRows;
    }

    if (orderIds.length > 0) {
      const ph = orderIds.map(() => "?").join(",");
      const [delOrd] = await conn.query<ResultSetHeader>(
        `DELETE FROM registration_orders WHERE id IN (${ph})`,
        orderIds,
      );
      orders = delOrd.affectedRows;
    }

    if (paymentIds.length > 0) {
      const ph = paymentIds.map(() => "?").join(",");
      await conn.query(
        `DELETE FROM payment_refunds WHERE payment_id IN (${ph})`,
        paymentIds,
      ).catch(() => undefined);
      const [delPay] = await conn.query<ResultSetHeader>(
        `DELETE FROM payments WHERE id IN (${ph})`,
        paymentIds,
      );
      payments = delPay.affectedRows;
    }

    await conn.query(
      `DELETE FROM waitlist_entries WHERE event_id = ?`,
      [eventId],
    ).catch(() => undefined);

    await conn.query(
      `UPDATE event_categories SET sold_count = 0 WHERE event_id = ?`,
      [eventId],
    ).catch(() => undefined);
    await conn.query(
      `UPDATE event_extras SET sold_count = 0 WHERE event_id = ?`,
      [eventId],
    ).catch(() => undefined);
    await conn.query(
      `UPDATE events SET registration_count = 0 WHERE id = ?`,
      [eventId],
    );

    for (const athleteId of athleteIds) {
      const [live] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM registrations
         WHERE athlete_id = ? AND is_simulation = 0 AND deleted_at IS NULL
         LIMIT 1`,
        [athleteId],
      );
      if (live.length > 0) continue;
      const [ath] = await conn.query<RowDataPacket[]>(
        `SELECT id, is_simulation FROM athletes WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [athleteId],
      );
      if (ath.length === 0) continue;
      if (Number(ath[0].is_simulation) !== 1) continue;
      await conn.query(`DELETE FROM athlete_sessions WHERE athlete_id = ?`, [athleteId]).catch(
        () => undefined,
      );
      await conn.query(`DELETE FROM athletes WHERE id = ?`, [athleteId]);
      athletesRemoved += 1;
    }

    await bumpSimulationActivity(conn, eventId);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return { registrations, payments, orders, athletesRemoved };
}

export async function cleanupExpiredSimulations(
  pool: Pool,
  opts?: { stripeCancel?: (piId: string) => Promise<void> },
): Promise<{ events: number; details: Array<ReturnType<typeof wipeSimulationGeneratedData> extends Promise<infer R> ? R & { eventId: number } : never> }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM events
     WHERE is_simulation = 1 AND deleted_at IS NULL
       AND simulation_expires_at IS NOT NULL
       AND simulation_expires_at < NOW()`,
  );
  const details: Array<{
    eventId: number;
    registrations: number;
    payments: number;
    orders: number;
    athletesRemoved: number;
  }> = [];
  for (const row of rows) {
    const eventId = Number(row.id);
    const result = await wipeSimulationGeneratedData(pool, eventId, opts);
    details.push({ eventId, ...result });
  }
  return { events: rows.length, details };
}

async function uniqueSimSlug(
  pool: Pool | PoolConnection,
  base: string,
): Promise<string> {
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const root = `${cleaned || "sim"}-sim`;
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? root : `${root}-${n}`;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM events WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
      [slug],
    );
    if (rows.length === 0) return slug;
  }
  return `${root}-${Date.now()}`;
}

export type CreateSimulationInput = {
  organizerId: number;
  title: string;
  sportTypeId: number;
  startDate: string;
  cloneFromEventId?: number | null;
  newPublicUuid: () => string;
};

export async function createSimulationEvent(
  pool: Pool,
  input: CreateSimulationInput,
): Promise<
  | { ok: true; eventId: number; token: string; slug: string }
  | { ok: false; status: number; error: string; code?: string }
> {
  const active = await countActiveSimulations(pool, input.organizerId);
  if (active >= SIMULATION_MAX_ACTIVE_PER_ORG) {
    return {
      ok: false,
      status: 400,
      error: `Maximum ${SIMULATION_MAX_ACTIVE_PER_ORG} active simulations per organizer`,
      code: "simulation_quota",
    };
  }

  if (input.cloneFromEventId) {
    const [src] = await pool.query<RowDataPacket[]>(
      `SELECT id, organizer_id, is_simulation FROM events
       WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [input.cloneFromEventId],
    );
    if (src.length === 0 || Number(src[0].organizer_id) !== input.organizerId) {
      return { ok: false, status: 404, error: "Source event not found" };
    }
  }

  const token = newSimulationAccessToken();
  const now = new Date();
  const expires = simulationExpiresAtFrom(now, SIMULATION_TTL_DAYS);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let sportTypeId = input.sportTypeId;
    let title = input.title.slice(0, 255);
    let startDate = input.startDate;
    let shortDescription: string | null = null;
    let description: string | null = null;
    let requiresWaiver = 1;
    let bibMode = "folio";
    let maxPerOrder = 10;
    let feePresentation: string | null = null;
    let serviceFeePercent: number | null = null;
    let locationCity: string | null = null;
    let locationState: string | null = null;
    let locationCountry = "MX";
    let locationName: string | null = null;
    let locationLat: number | null = null;
    let locationLng: number | null = null;
    let hero: string | null = null;
    let banner: string | null = null;

    if (input.cloneFromEventId) {
      const [srcRows] = await conn.query<RowDataPacket[]>(
        `SELECT * FROM events WHERE id = ? LIMIT 1`,
        [input.cloneFromEventId],
      );
      const src = srcRows[0];
      sportTypeId = Number(src.sport_type_id);
      title = String(input.title || `${src.title} (SIM)`).slice(0, 255);
      startDate = String(src.start_date);
      shortDescription = src.short_description != null ? String(src.short_description) : null;
      description = src.description != null ? String(src.description) : null;
      requiresWaiver = Number(src.requires_waiver) ? 1 : 0;
      bibMode = String(src.bib_mode ?? "folio");
      maxPerOrder = Number(src.max_registrations_per_order) || 10;
      feePresentation = src.fee_presentation != null ? String(src.fee_presentation) : null;
      serviceFeePercent =
        src.service_fee_percent != null ? Number(src.service_fee_percent) : null;
      locationCity = src.location_city != null ? String(src.location_city) : null;
      locationState = src.location_state != null ? String(src.location_state) : null;
      locationCountry = String(src.location_country ?? "MX");
      locationName = src.location_name != null ? String(src.location_name) : null;
      locationLat = src.location_lat != null ? Number(src.location_lat) : null;
      locationLng = src.location_lng != null ? Number(src.location_lng) : null;
      hero = src.hero_image_url != null ? String(src.hero_image_url) : null;
      banner = src.banner_image_url != null ? String(src.banner_image_url) : null;
    }

    const slug = await uniqueSimSlug(
      conn,
      title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-"),
    );

    const [ins] = await conn.query<ResultSetHeader>(
      `INSERT INTO events (
         public_uuid, organizer_id, sport_type_id, slug, title, short_description, description,
         status, visibility, featured, start_date, end_date,
         location_name, location_city, location_state, location_country, location_lat, location_lng,
         hero_image_url, banner_image_url, service_fee_percent, fee_presentation,
         requires_waiver, max_registrations_per_order, bib_mode,
         is_simulation, simulation_access_token, simulation_expires_at, simulation_last_activity_at,
         cloned_from_event_id
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        input.newPublicUuid(),
        input.organizerId,
        sportTypeId,
        slug,
        title,
        shortDescription,
        description,
        "draft",
        "unlisted",
        0,
        startDate,
        null,
        locationName,
        locationCity,
        locationState,
        locationCountry,
        locationLat,
        locationLng,
        hero,
        banner,
        serviceFeePercent,
        feePresentation,
        requiresWaiver,
        maxPerOrder,
        bibMode,
        1,
        token,
        toMysqlDatetime(expires),
        toMysqlDatetime(now),
        input.cloneFromEventId ?? null,
      ],
    );
    const eventId = ins.insertId;

    if (input.cloneFromEventId) {
      await cloneEventChildren(conn, input.cloneFromEventId, eventId, input.newPublicUuid);
    }

    await conn.commit();
    return { ok: true, eventId, token, slug };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function cloneEventChildren(
  conn: PoolConnection,
  fromId: number,
  toId: number,
  newPublicUuid: () => string,
): Promise<void> {
  const categoryIdMap = new Map<number, number>();

  const [cats] = await conn.query<RowDataPacket[]>(
    `SELECT * FROM event_categories WHERE event_id = ? ORDER BY id ASC`,
    [fromId],
  );
  for (const c of cats) {
    const [ins] = await conn.query<ResultSetHeader>(
      `INSERT INTO event_categories (
         public_uuid, event_id, name, description, distance_km, difficulty, capacity,
         price_cents, currency, gender_restriction, min_age, max_age, waitlist_enabled,
         registration_opens_at, registration_closes_at, sort_order, is_active, sold_count
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
      [
        newPublicUuid(),
        toId,
        c.name,
        c.description,
        c.distance_km,
        c.difficulty,
        c.capacity,
        c.price_cents,
        c.currency ?? "MXN",
        c.gender_restriction,
        c.min_age,
        c.max_age,
        c.waitlist_enabled ?? 0,
        c.registration_opens_at,
        c.registration_closes_at,
        c.sort_order ?? 0,
        c.is_active ?? 1,
      ],
    );
    categoryIdMap.set(Number(c.id), ins.insertId);
  }

  const [fields] = await conn.query<RowDataPacket[]>(
    `SELECT * FROM event_registration_fields WHERE event_id = ? ORDER BY id ASC`,
    [fromId],
  );
  const fieldIdMap = new Map<number, number>();
  for (const f of fields) {
    const [ins] = await conn.query<ResultSetHeader>(
      `INSERT INTO event_registration_fields (
         event_id, field_key, label, field_type, options_json, is_required,
         validation_rules_json, sort_order, is_active, scope_type
       ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        toId,
        f.field_key,
        f.label,
        f.field_type,
        f.options_json != null
          ? typeof f.options_json === "string"
            ? f.options_json
            : JSON.stringify(f.options_json)
          : null,
        f.is_required ?? 0,
        f.validation_rules_json != null
          ? typeof f.validation_rules_json === "string"
            ? f.validation_rules_json
            : JSON.stringify(f.validation_rules_json)
          : null,
        f.sort_order ?? 0,
        f.is_active ?? 1,
        f.scope_type ?? "all_categories",
      ],
    );
    fieldIdMap.set(Number(f.id), ins.insertId);
  }
  for (const [oldFieldId, newFieldId] of fieldIdMap) {
    const [links] = await conn.query<RowDataPacket[]>(
      `SELECT event_category_id FROM event_registration_field_categories
       WHERE event_registration_field_id = ?`,
      [oldFieldId],
    );
    for (const link of links) {
      const newCat = categoryIdMap.get(Number(link.event_category_id));
      if (newCat == null) continue;
      await conn.query(
        `INSERT INTO event_registration_field_categories (event_registration_field_id, event_category_id)
         VALUES (?,?)`,
        [newFieldId, newCat],
      );
    }
  }

  const [extras] = await conn.query<RowDataPacket[]>(
    `SELECT * FROM event_extras WHERE event_id = ? ORDER BY id ASC`,
    [fromId],
  );
  const extraIdMap = new Map<number, number>();
  for (const e of extras) {
    const [ins] = await conn.query<ResultSetHeader>(
      `INSERT INTO event_extras (
         public_uuid, event_id, name, description, price_cents, currency, image_url,
         extra_type, max_per_athlete, capacity, sold_count, is_required, sort_order, is_active,
         scope_type, sales_opens_at, sales_closes_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)`,
      [
        newPublicUuid(),
        toId,
        e.name,
        e.description,
        e.price_cents,
        e.currency ?? "MXN",
        e.image_url,
        e.extra_type ?? "custom",
        e.max_per_athlete ?? 1,
        e.capacity,
        e.is_required ?? 0,
        e.sort_order ?? 0,
        e.is_active ?? 1,
        e.scope_type ?? "all_categories",
        e.sales_opens_at,
        e.sales_closes_at,
      ],
    );
    extraIdMap.set(Number(e.id), ins.insertId);
  }
  for (const [oldExtraId, newExtraId] of extraIdMap) {
    const [ef] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM event_extra_fields WHERE event_extra_id = ? ORDER BY id ASC`,
      [oldExtraId],
    );
    for (const f of ef) {
      await conn.query(
        `INSERT INTO event_extra_fields (
           event_extra_id, field_key, label, field_type, field_kind, options_json, is_required, sort_order
         ) VALUES (?,?,?,?,?,?,?,?)`,
        [
          newExtraId,
          f.field_key,
          f.label,
          f.field_type,
          f.field_kind ?? "standard",
          f.options_json != null
            ? typeof f.options_json === "string"
              ? f.options_json
              : JSON.stringify(f.options_json)
            : null,
          f.is_required ?? 0,
          f.sort_order ?? 0,
        ],
      );
    }
    const [ec] = await conn.query<RowDataPacket[]>(
      `SELECT event_category_id FROM event_extra_categories WHERE event_extra_id = ?`,
      [oldExtraId],
    );
    for (const link of ec) {
      const newCat = categoryIdMap.get(Number(link.event_category_id));
      if (newCat == null) continue;
      await conn.query(
        `INSERT INTO event_extra_categories (event_extra_id, event_category_id) VALUES (?,?)`,
        [newExtraId, newCat],
      );
    }
  }

  const [waivers] = await conn.query<RowDataPacket[]>(
    `SELECT * FROM event_waivers WHERE event_id = ? ORDER BY id ASC`,
    [fromId],
  );
  for (const w of waivers) {
    await conn.query(
      `INSERT INTO event_waivers (
         event_id, title, content_html, pdf_url, content_type, version, is_active, sort_order
       ) VALUES (?,?,?,?,?,?,?,?)`,
      [
        toId,
        w.title,
        w.content_html,
        w.pdf_url,
        w.content_type ?? "html",
        w.version ?? 1,
        w.is_active ?? 1,
        w.sort_order ?? 0,
      ],
    ).catch(() => undefined);
  }
}

export async function regenerateSimulationToken(
  pool: Pool | PoolConnection,
  eventId: number,
): Promise<string> {
  const token = newSimulationAccessToken();
  await pool.query(
    `UPDATE events SET simulation_access_token = ? WHERE id = ? AND is_simulation = 1`,
    [token, eventId],
  );
  await bumpSimulationActivity(pool, eventId);
  return token;
}

/** SQL fragment: exclude simulations from marketplace / public listings. */
export const SQL_NOT_SIMULATION = `AND COALESCE(e.is_simulation, 0) = 0`;
