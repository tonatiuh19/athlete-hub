import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { slugify } from "../shared/slugify.js";
import type {
  OrganizerOnboardingIntake,
  PublicOrganizerRegisterRequest,
} from "../shared/api.js";

export const ORGANIZER_ONBOARDING_SETTING_KEY = "onboarding";

const DEFAULT_SERVICE_FEE_PERCENT = 11;

async function uniqueOrganizerSlug(
  pool: Pool | PoolConnection,
  base: string,
): Promise<string> {
  const candidate = base || "organizer";
  let n = 0;
  while (n < 100) {
    const slug = n === 0 ? candidate : `${candidate}-${n}`;
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM organizers WHERE slug = ? AND deleted_at IS NULL LIMIT 1",
      [slug],
    );
    if (rows.length === 0) return slug;
    n += 1;
  }
  return `${candidate}-${Date.now()}`;
}

export async function normalizeOrganizerCity(
  pool: Pool | PoolConnection,
  city: string,
  country: string,
): Promise<string | null> {
  const trimmed = city.trim();
  if (!trimmed) return null;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT gc.name
     FROM geo_cities gc
     JOIN geo_states gs ON gs.id = gc.state_id
     WHERE gc.is_active = 1
       AND gs.is_active = 1
       AND gs.country = ?
       AND LOWER(TRIM(gc.name)) = LOWER(?)
     LIMIT 1`,
    [country, trimmed],
  );
  return rows.length > 0 ? String(rows[0].name) : null;
}

export type OrganizerOperationGate =
  | { ok: true }
  | { ok: false; status: number; error: string; code: string };

export async function assertOrganizerCanOperateEvents(
  pool: Pool | PoolConnection,
  organizerId: number,
): Promise<OrganizerOperationGate> {
  const [[row]] = await pool.query<RowDataPacket[]>(
    "SELECT status FROM organizers WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [organizerId],
  );
  if (!row) {
    return {
      ok: false,
      status: 404,
      error: "Organizer not found",
      code: "organizer_not_found",
    };
  }
  const status = String(row.status);
  if (status === "active") return { ok: true };
  if (status === "suspended") {
    return {
      ok: false,
      status: 403,
      error: "Your organization account is suspended. Contact support to continue.",
      code: "organizer_suspended",
    };
  }
  if (status === "inactive") {
    return {
      ok: false,
      status: 403,
      error: "Your organization account is inactive. Contact support to continue.",
      code: "organizer_inactive",
    };
  }
  return {
    ok: false,
    status: 403,
    error: "Your organization account is not active yet.",
    code: "organizer_not_active",
  };
}

export async function fetchOrganizerOnboardingIntake(
  pool: Pool | PoolConnection,
  organizerId: number,
): Promise<OrganizerOnboardingIntake | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT setting_value FROM organizer_settings
     WHERE organizer_id = ? AND setting_key = ?
     LIMIT 1`,
    [organizerId, ORGANIZER_ONBOARDING_SETTING_KEY],
  );
  if (rows.length === 0) return null;
  const raw = rows[0].setting_value;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as OrganizerOnboardingIntake;
  } catch {
    return null;
  }
}

export type RegisterSelfServiceOrganizerInput = PublicOrganizerRegisterRequest;

export type RegisterSelfServiceOrganizerResult =
  | {
      ok: true;
      organizerId: number;
      memberId: number;
      organizer: { id: number; name: string; slug: string; email: string };
    }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
    };

export async function registerSelfServiceOrganizer(
  pool: Pool,
  input: RegisterSelfServiceOrganizerInput,
  deps: {
    newPublicUuid: () => string;
    normalizeLocale: (value: unknown) => string;
  },
): Promise<RegisterSelfServiceOrganizerResult> {
  const ownerFirst = String(input.owner_first_name ?? "").trim();
  const ownerLast = String(input.owner_last_name ?? "").trim();
  const ownerEmail = String(input.owner_email ?? "")
    .trim()
    .toLowerCase();
  const ownerPhone = input.owner_phone
    ? String(input.owner_phone).trim().slice(0, 20)
    : null;
  const name = String(input.name ?? "").trim();
  const orgEmail = String(input.email ?? ownerEmail)
    .trim()
    .toLowerCase();
  const country = String(input.country ?? "MX")
    .trim()
    .slice(0, 2)
    .toUpperCase();
  const cityRaw = String(input.city ?? "").trim().slice(0, 100);
  const phone = input.phone ? String(input.phone).trim().slice(0, 20) : null;
  const locale = deps.normalizeLocale(input.locale);

  if (!ownerFirst || !ownerLast || !ownerEmail || !name || !cityRaw) {
    return {
      ok: false,
      status: 400,
      error: "owner_first_name, owner_last_name, owner_email, name, and city are required",
      code: "missing_fields",
    };
  }
  if (!/.+@.+\..+/.test(ownerEmail) || !/.+@.+\..+/.test(orgEmail)) {
    return {
      ok: false,
      status: 400,
      error: "Valid email required",
      code: "invalid_email",
    };
  }

  const canonicalCity = await normalizeOrganizerCity(pool, cityRaw, country);
  if (!canonicalCity) {
    return {
      ok: false,
      status: 400,
      error: "City must be selected from the location catalog",
      code: "invalid_organizer_city",
    };
  }

  const intakeRaw = input.intake ?? {};
  const intake: OrganizerOnboardingIntake = {
    sport_type_id:
      intakeRaw.sport_type_id != null ? Number(intakeRaw.sport_type_id) : null,
    rough_date: intakeRaw.rough_date ? String(intakeRaw.rough_date).slice(0, 10) : null,
    expected_size: intakeRaw.expected_size
      ? (String(intakeRaw.expected_size) as OrganizerOnboardingIntake["expected_size"])
      : null,
    self_service_registered_at: new Date().toISOString(),
    locale,
  };

  if (intake.sport_type_id != null && Number.isFinite(intake.sport_type_id)) {
    const [sportRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM sport_types WHERE id = ? AND is_active = 1 LIMIT 1",
      [intake.sport_type_id],
    );
    if (sportRows.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "Invalid sport_type_id",
        code: "invalid_sport_type",
      };
    }
  } else {
    intake.sport_type_id = null;
  }

  const [existingOrg] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM organizers WHERE email = ? AND deleted_at IS NULL LIMIT 1",
    [orgEmail],
  );
  if (existingOrg.length > 0) {
    return {
      ok: false,
      status: 409,
      error: "An organization with this email already exists. Sign in or use a different email.",
      code: "organizer_email_exists",
    };
  }

  const [existingMember] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM organizer_members
     WHERE LOWER(TRIM(email)) = ? AND status = 'active' AND deleted_at IS NULL
     LIMIT 1`,
    [ownerEmail],
  );
  if (existingMember.length > 0) {
    return {
      ok: false,
      status: 409,
      error: "This email already has an organizer account. Sign in to continue.",
      code: "organizer_member_email_exists",
    };
  }

  const baseSlug = slugify(name);
  const slug = await uniqueOrganizerSlug(pool, baseSlug);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orgResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO organizers (
         public_uuid, slug, name, email, phone, city, country, status,
         service_fee_percent
       ) VALUES (?,?,?,?,?,?,?,'active',?)`,
      [
        deps.newPublicUuid(),
        slug,
        name.slice(0, 200),
        orgEmail,
        phone,
        canonicalCity,
        country,
        DEFAULT_SERVICE_FEE_PERCENT,
      ],
    );
    const organizerId = orgResult.insertId;

    const [memberResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO organizer_members (
         public_uuid, organizer_id, email, first_name, last_name, phone,
         role, status, preferred_language, invited_at
       ) VALUES (?,?,?,?,?,?,'owner','active',?,NOW())`,
      [
        deps.newPublicUuid(),
        organizerId,
        ownerEmail,
        ownerFirst.slice(0, 100),
        ownerLast.slice(0, 100),
        ownerPhone,
        locale,
      ],
    );
    const memberId = memberResult.insertId;

    await conn.query<ResultSetHeader>(
      `INSERT INTO organizer_settings (organizer_id, setting_key, setting_value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [organizerId, ORGANIZER_ONBOARDING_SETTING_KEY, JSON.stringify(intake)],
    );

    await conn.commit();

    return {
      ok: true,
      organizerId,
      memberId,
      organizer: {
        id: organizerId,
        name: name.slice(0, 200),
        slug,
        email: orgEmail,
      },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export function buildSelfServiceOrganizerAdminEmail(opts: {
  locale: string;
  adminFirstName: string;
  organizerName: string;
  ownerEmail: string;
  city: string;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const isEs = opts.locale.startsWith("es");
  const subject = isEs
    ? `Nuevo organizador: ${opts.organizerName}`
    : `New self-service organizer: ${opts.organizerName}`;
  const body = isEs
    ? `${opts.adminFirstName}, ${opts.organizerName} se registró desde el sitio (${opts.city}). Contacto: ${opts.ownerEmail}.`
    : `${opts.adminFirstName}, ${opts.organizerName} signed up on the website (${opts.city}). Contact: ${opts.ownerEmail}.`;
  const cta = isEs ? "Ver organizadores" : "View organizers";
  const html = `<p>${body}</p><p><a href="${opts.appUrl}/staff/people?tab=organizers">${cta}</a></p>`;
  return { subject, html, text: `${body}\n${opts.appUrl}/staff/people?tab=organizers` };
}
