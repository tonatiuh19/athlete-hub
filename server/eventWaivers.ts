import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { WAIVER_ACCEPTANCE_SIGNATURE } from "../shared/waiverConstants.js";

export type WaiverContentType = "html" | "pdf" | "both";

export { WAIVER_ACCEPTANCE_SIGNATURE };

export type WaiverSyncInput = {
  id?: number;
  title: string;
  content_html?: string;
  pdf_url?: string | null;
  content_type?: WaiverContentType;
  sort_order?: number;
  is_active?: boolean;
};

const WAIVER_SELECT = `id, event_id, title, content_html, pdf_url, content_type,
  version, is_active, sort_order, created_at`;

export async function fetchEventWaiversForStaff(pool: Pool, eventId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${WAIVER_SELECT}
     FROM event_waivers
     WHERE event_id = ?
     ORDER BY is_active DESC, sort_order ASC, id ASC`,
    [eventId],
  );
  return rows;
}

export async function fetchActiveEventWaiversPublic(pool: Pool, eventId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, title, content_html, pdf_url, content_type, version, sort_order
     FROM event_waivers
     WHERE event_id = ? AND is_active = 1
     ORDER BY sort_order ASC, id ASC`,
    [eventId],
  );
  return rows;
}

export async function validateEventPublishWaivers(
  pool: Pool,
  eventId: number,
): Promise<{ ok: true } | { error: string }> {
  const [[eventRow]] = await pool.query<RowDataPacket[]>(
    "SELECT requires_waiver FROM events WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [eventId],
  );
  if (!eventRow) {
    return { error: "Event not found" };
  }
  if (!Boolean(eventRow.requires_waiver)) {
    return { ok: true };
  }
  const active = await fetchActiveEventWaiversPublic(pool, eventId);
  if (active.length === 0) {
    return {
      error:
        "This event requires waivers — add at least one active waiver or disable waiver requirement",
    };
  }
  return { ok: true };
}

function parseWaiverInput(raw: unknown): WaiverSyncInput | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const title = String(b.title ?? "").trim();
  if (!title) return null;

  const contentType = String(b.content_type ?? "html") as WaiverContentType;
  if (!["html", "pdf", "both"].includes(contentType)) {
    return null;
  }

  const content_html = b.content_html != null ? String(b.content_html) : "";
  const pdf_url =
    b.pdf_url != null && String(b.pdf_url).trim()
      ? String(b.pdf_url).trim().slice(0, 500)
      : null;

  if (contentType === "html" && !content_html.trim()) return null;
  if (contentType === "pdf" && !pdf_url) return null;
  if (contentType === "both" && !content_html.trim() && !pdf_url) return null;

  const id = b.id != null && Number.isFinite(Number(b.id)) ? Number(b.id) : undefined;

  return {
    id,
    title: title.slice(0, 255),
    content_html,
    pdf_url,
    content_type: contentType,
    sort_order: Number(b.sort_order) || 0,
    is_active: b.is_active !== false && b.is_active !== 0,
  };
}

type DbConn = Pool | PoolConnection;

async function syncEventWaiversInTransaction(
  conn: DbConn,
  eventId: number,
  items: WaiverSyncInput[],
): Promise<{ error: string; status: number } | null> {
  const keepIds = items.filter((i) => i.id).map((i) => i.id as number);

  if (keepIds.length > 0) {
    const placeholders = keepIds.map(() => "?").join(", ");
    await conn.query<ResultSetHeader>(
      `UPDATE event_waivers SET is_active = 0
       WHERE event_id = ? AND id NOT IN (${placeholders})`,
      [eventId, ...keepIds],
    );
  } else {
    await conn.query<ResultSetHeader>(
      "UPDATE event_waivers SET is_active = 0 WHERE event_id = ?",
      [eventId],
    );
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const sortOrder = item.sort_order ?? i;

    if (item.id) {
      const [[existing]] = await conn.query<RowDataPacket[]>(
        "SELECT id, version FROM event_waivers WHERE id = ? AND event_id = ? LIMIT 1",
        [item.id, eventId],
      );
      if (!existing) {
        return { error: `Waiver ${item.id} not found`, status: 404 };
      }
      await conn.query<ResultSetHeader>(
        `UPDATE event_waivers SET
           title = ?, content_html = ?, pdf_url = ?, content_type = ?,
           version = ?, is_active = 1, sort_order = ?
         WHERE id = ? AND event_id = ?`,
        [
          item.title,
          item.content_html ?? "",
          item.pdf_url ?? null,
          item.content_type ?? "html",
          Number(existing.version ?? 1) + 1,
          sortOrder,
          item.id,
          eventId,
        ],
      );
    } else {
      await conn.query<ResultSetHeader>(
        `INSERT INTO event_waivers (
           event_id, title, content_html, pdf_url, content_type, version, is_active, sort_order
         ) VALUES (?,?,?,?,?,1,1,?)`,
        [
          eventId,
          item.title,
          item.content_html ?? "",
          item.pdf_url ?? null,
          item.content_type ?? "html",
          sortOrder,
        ],
      );
    }
  }

  return null;
}

export async function syncEventWaivers(
  pool: Pool,
  eventId: number,
  body: unknown,
): Promise<{ error: string; status: number } | { waivers: RowDataPacket[] }> {
  const list = (body as { waivers?: unknown })?.waivers;
  if (!Array.isArray(list)) {
    return { error: "waivers array required", status: 400 };
  }

  const items: WaiverSyncInput[] = [];
  for (const raw of list) {
    const parsed = parseWaiverInput(raw);
    if (!parsed) {
      return { error: "Invalid waiver item — title and content required", status: 400 };
    }
    if (parsed.is_active !== false) {
      items.push({ ...parsed, is_active: true });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const err = await syncEventWaiversInTransaction(conn, eventId, items);
    if (err) {
      await conn.rollback();
      return err;
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return { waivers: await fetchEventWaiversForStaff(pool, eventId) };
}

export type WaiverSignatureInput = {
  waiverId: number;
  signature: string;
  /** Client-observed waiver version at accept time */
  waiverVersion?: number;
};

function deriveDeviceInfo(userAgent?: string | null): string | null {
  if (!userAgent?.trim()) return null;
  return userAgent.trim().slice(0, 255);
}

export type RegistrationWaiverStatus = {
  signed: boolean;
  outdated: boolean;
  outdatedWaivers: Array<{
    waiverId: number;
    title: string;
    signedVersion: number | null;
    currentVersion: number;
  }>;
};

export async function getRegistrationWaiverStatus(
  executor: DbConn,
  registrationId: number,
): Promise<RegistrationWaiverStatus> {
  const [[regRow]] = await executor.query<RowDataPacket[]>(
    `SELECT r.event_id, r.waiver_signed_at, e.requires_waiver
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.id = ? AND r.deleted_at IS NULL LIMIT 1`,
    [registrationId],
  );
  if (!regRow || !Boolean(regRow.requires_waiver)) {
    return { signed: true, outdated: false, outdatedWaivers: [] };
  }

  const [activeWaivers] = await executor.query<RowDataPacket[]>(
    `SELECT id, title, version FROM event_waivers
     WHERE event_id = ? AND is_active = 1`,
    [regRow.event_id],
  );
  if (activeWaivers.length === 0) {
    return {
      signed: Boolean(regRow.waiver_signed_at),
      outdated: false,
      outdatedWaivers: [],
    };
  }

  const [sigRows] = await executor.query<RowDataPacket[]>(
    `SELECT waiver_id, waiver_version_at_sign FROM registration_waiver_signatures
     WHERE registration_id = ?`,
    [registrationId],
  );
  const sigByWaiver = new Map(
    sigRows.map((s) => [Number(s.waiver_id), s.waiver_version_at_sign as number | null]),
  );

  const outdatedWaivers: RegistrationWaiverStatus["outdatedWaivers"] = [];
  for (const w of activeWaivers) {
    const waiverId = Number(w.id);
    const currentVersion = Number(w.version ?? 1);
    const signedVersionRaw = sigByWaiver.get(waiverId);
    const signedVersion =
      signedVersionRaw != null ? Number(signedVersionRaw) : null;
    if (signedVersion == null || signedVersion < currentVersion) {
      outdatedWaivers.push({
        waiverId,
        title: String(w.title),
        signedVersion,
        currentVersion,
      });
    }
  }

  const signed = Boolean(regRow.waiver_signed_at) && outdatedWaivers.length === 0;
  return {
    signed,
    outdated: outdatedWaivers.length > 0,
    outdatedWaivers,
  };
}

export async function enrichRegistrationRowsWithWaiverOutdated(
  executor: DbConn,
  rows: RowDataPacket[],
  eventRequiresWaiver: boolean,
): Promise<RowDataPacket[]> {
  if (!eventRequiresWaiver || rows.length === 0) {
    return rows.map((row) => ({ ...row, waiver_outdated: false }));
  }
  return Promise.all(
    rows.map(async (row) => {
      const status = await getRegistrationWaiverStatus(executor, row.id as number);
      return { ...row, waiver_outdated: status.outdated };
    }),
  );
}

export async function resignRegistrationWaivers(
  executor: DbConn,
  registrationId: number,
  signatures: WaiverSignatureInput[],
  opts?: {
    clientIp?: string | null;
    userAgent?: string | null;
    deviceInfo?: string | null;
  },
): Promise<{ ok: true } | { error: string }> {
  const [[regRow]] = await executor.query<RowDataPacket[]>(
    `SELECT r.event_id, r.status, e.requires_waiver
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.id = ? AND r.deleted_at IS NULL LIMIT 1`,
    [registrationId],
  );
  if (!regRow) {
    return { error: "Registration not found" };
  }
  if (regRow.status !== "confirmed") {
    return { error: "Only confirmed registrations can re-sign waivers" };
  }
  if (!Boolean(regRow.requires_waiver)) {
    return { error: "This event does not require waivers" };
  }

  const validation = await validateWaiverSignaturesForEvent(
    executor as Pool,
    Number(regRow.event_id),
    signatures,
  );
  if ("error" in validation) {
    return validation;
  }

  await insertRegistrationWaiverSignatures(executor, registrationId, signatures, opts);
  return { ok: true };
}

function isValidWaiverSignature(signature: string): boolean {
  const trimmed = signature.trim();
  return trimmed === WAIVER_ACCEPTANCE_SIGNATURE || trimmed.length >= 3;
}

export function parseWaiverSignatures(body: unknown): WaiverSignatureInput[] | null {
  const arr = (body as { waiverSignatures?: unknown })?.waiverSignatures;
  if (Array.isArray(arr)) {
    const out: WaiverSignatureInput[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const w = raw as Record<string, unknown>;
      const waiverId = Number(w.waiverId ?? w.waiver_id);
      const signature = String(w.signature ?? w.waiverSignature ?? WAIVER_ACCEPTANCE_SIGNATURE).trim();
      const waiverVersionRaw = w.waiverVersion ?? w.waiver_version;
      const waiverVersion =
        waiverVersionRaw != null && Number.isFinite(Number(waiverVersionRaw))
          ? Number(waiverVersionRaw)
          : undefined;
      if (Number.isFinite(waiverId) && isValidWaiverSignature(signature)) {
        out.push({
          waiverId,
          signature:
            signature === WAIVER_ACCEPTANCE_SIGNATURE ? WAIVER_ACCEPTANCE_SIGNATURE : signature,
          ...(waiverVersion != null ? { waiverVersion } : {}),
        });
      }
    }
    if (out.length > 0) return out;
  }

  const waiverId = Number((body as Record<string, unknown>)?.waiverId);
  const signature = String(
    (body as Record<string, unknown>)?.waiverSignature ?? WAIVER_ACCEPTANCE_SIGNATURE,
  ).trim();
  if (Number.isFinite(waiverId) && isValidWaiverSignature(signature)) {
    return [{ waiverId, signature }];
  }
  return null;
}

export async function validateWaiverSignaturesForEvent(
  pool: Pool,
  eventId: number,
  signatures: WaiverSignatureInput[],
): Promise<{ ok: true } | { error: string }> {
  const active = await fetchActiveEventWaiversPublic(pool, eventId);
  if (active.length === 0) {
    return { error: "Event waiver is not configured" };
  }

  const signedIds = new Set(signatures.map((s) => s.waiverId));
  for (const w of active) {
    if (!signedIds.has(Number(w.id))) {
      return { error: "All waivers must be accepted" };
    }
  }

  for (const sig of signatures) {
    const waiverRow = active.find((w) => Number(w.id) === sig.waiverId);
    if (!waiverRow) {
      return { error: "Invalid waiver acceptance" };
    }
    if (
      sig.waiverVersion != null &&
      Number(sig.waiverVersion) !== Number(waiverRow.version ?? 1)
    ) {
      return {
        error: "Waiver was updated — please review and accept the latest version",
      };
    }
  }

  return { ok: true };
}

export async function insertRegistrationWaiverSignatures(
  executor: DbConn,
  registrationId: number,
  signatures: WaiverSignatureInput[],
  opts?: {
    clientIp?: string | null;
    userAgent?: string | null;
    deviceInfo?: string | null;
  },
): Promise<void> {
  const clientIp = opts?.clientIp;
  const userAgent = opts?.userAgent;
  const deviceInfo = opts?.deviceInfo ?? deriveDeviceInfo(userAgent);

  for (const sig of signatures) {
    const [[waiverRow]] = await executor.query<RowDataPacket[]>(
      "SELECT version FROM event_waivers WHERE id = ? LIMIT 1",
      [sig.waiverId],
    );
    const versionAtSign = Number(waiverRow?.version ?? 1);

    await executor.query<ResultSetHeader>(
      `INSERT INTO registration_waiver_signatures (
         registration_id, waiver_id, waiver_version_at_sign,
         ip_address, user_agent, device_info, signature_data
       ) VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         signed_at = NOW(),
         waiver_version_at_sign = VALUES(waiver_version_at_sign),
         ip_address = VALUES(ip_address),
         user_agent = VALUES(user_agent),
         device_info = VALUES(device_info),
         signature_data = VALUES(signature_data)`,
      [
        registrationId,
        sig.waiverId,
        versionAtSign,
        clientIp?.slice(0, 45) ?? null,
        userAgent?.slice(0, 500) ?? null,
        deviceInfo,
        sig.signature.slice(0, 5000),
      ],
    );
  }
  if (signatures.length > 0) {
    await executor.query<ResultSetHeader>(
      "UPDATE registrations SET waiver_signed_at = NOW() WHERE id = ?",
      [registrationId],
    );
  }
}

export async function markRegistrationWaiverWaivedByStaff(
  executor: DbConn,
  registrationId: number,
  staffUserId?: number,
): Promise<void> {
  await executor.query<ResultSetHeader>(
    "UPDATE registrations SET waiver_signed_at = NOW() WHERE id = ?",
    [registrationId],
  );
  const note = staffUserId ? `WAIVED_BY_STAFF:${staffUserId}` : "WAIVED_BY_STAFF";
  await executor.query<ResultSetHeader>(
    `INSERT INTO registration_waiver_signatures (
       registration_id, waiver_id, waiver_version_at_sign, signature_data
     ) SELECT ?, ew.id, ew.version, ?
       FROM event_waivers ew
       JOIN registrations r ON r.event_id = ew.event_id
       WHERE r.id = ? AND ew.is_active = 1
       ON DUPLICATE KEY UPDATE
         signature_data = VALUES(signature_data),
         waiver_version_at_sign = VALUES(waiver_version_at_sign),
         signed_at = NOW()`,
    [registrationId, note, registrationId],
  );
}
