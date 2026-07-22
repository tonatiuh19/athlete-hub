import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { hasEventDayPassed } from "../shared/eventLifecycle.js";

type Db = Pool | PoolConnection;

/**
 * Soft-delete an event and cancel its open registrations/waitlist.
 * Payments are kept for audit (not hard-deleted).
 */
export async function softDeleteStaffEvent(
  pool: Pool,
  eventId: number,
): Promise<{ ok: true; cancelledRegistrations: number } | { error: string }> {
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM events WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [eventId],
  );
  if (!row) return { error: "Event not found" };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query<ResultSetHeader>(
      `UPDATE events
       SET deleted_at = NOW(),
           status = 'cancelled',
           visibility = 'private',
           featured = 0,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [eventId],
    );

    const [regResult] = await conn.query<ResultSetHeader>(
      `UPDATE registrations
       SET status = 'cancelled',
           deleted_at = COALESCE(deleted_at, NOW()),
           updated_at = NOW()
       WHERE event_id = ? AND deleted_at IS NULL AND status NOT IN ('cancelled', 'refunded')`,
      [eventId],
    );

    await conn.query<ResultSetHeader>(
      `UPDATE waitlist_entries
       SET status = 'cancelled', offered_at = NULL, offer_expires_at = NULL
       WHERE event_id = ? AND status IN ('waiting', 'offered')`,
      [eventId],
    );

    await conn.commit();
    return {
      ok: true,
      cancelledRegistrations: Number(regResult.affectedRows ?? 0),
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Hide from marketplace while keeping staff access (slug / hub). */
export async function deactivateEventFromListing(
  pool: Pool,
  eventId: number,
): Promise<{ ok: true } | { error: string }> {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE events
     SET visibility = 'unlisted', featured = 0, updated_at = NOW()
     WHERE id = ? AND deleted_at IS NULL`,
    [eventId],
  );
  if (!result.affectedRows) return { error: "Event not found" };
  return { ok: true };
}

/**
 * Marketplace / home list predicate: hide events that would auto-deactivate
 * after their UTC calendar day ends (even before a visit writes visibility).
 * Events with auto_deactivate_after_event = 0 stay listed.
 */
export const MARKETPLACE_AUTO_DEACTIVATE_SQL = `
  AND (
    COALESCE(e.auto_deactivate_after_event, 1) = 0
    OR DATE(COALESCE(e.end_date, e.start_date)) >= UTC_DATE()
  )`;

/** Lazy single-event check (detail / checkout). First visit flags visibility=unlisted. */
export async function maybeAutoDeactivateEvent(db: Db, eventId: number): Promise<void> {
  const [[row]] = await db.query<RowDataPacket[]>(
    `SELECT id, start_date, end_date, visibility, status, auto_deactivate_after_event
     FROM events WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [eventId],
  );
  if (!row) return;
  if (Number(row.auto_deactivate_after_event ?? 1) !== 1) return;
  if (String(row.visibility) !== "public") return;
  if (!["published", "completed"].includes(String(row.status))) return;
  if (!hasEventDayPassed(row.start_date as string, row.end_date as string | null)) return;

  await db.query<ResultSetHeader>(
    `UPDATE events SET visibility = 'unlisted', featured = 0, updated_at = NOW()
     WHERE id = ? AND deleted_at IS NULL AND visibility = 'public'`,
    [eventId],
  );
}
