import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  normalizeEventBibMode,
  type EventBibMode,
} from "../shared/bibMode.js";

type DbConn = Pool | PoolConnection;

export async function fetchEventBibMode(
  executor: DbConn,
  eventId: number,
): Promise<EventBibMode> {
  const [rows] = await executor.query<RowDataPacket[]>(
    "SELECT bib_mode FROM events WHERE id = ? LIMIT 1",
    [eventId],
  );
  return normalizeEventBibMode(rows[0]?.bib_mode);
}

export {
  DEFAULT_EVENT_BIB_MODE,
  isEventBibMode,
  normalizeEventBibMode,
  resolveRegistrationBibNumber,
  type EventBibMode,
} from "../shared/bibMode.js";
