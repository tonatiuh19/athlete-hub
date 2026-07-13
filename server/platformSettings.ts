import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  DEFAULT_SITE_PUBLIC_PROFILE,
  mergeSitePublicProfile,
  type SitePublicProfile,
} from "../shared/siteLegal.js";

export const SITE_PUBLIC_PROFILE_KEY = "site_public_profile";

function isMissingPlatformSettingsTable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  const message = String((err as { message?: string }).message ?? "");
  return (
    code === "ER_NO_SUCH_TABLE" ||
    /platform_settings.*doesn't exist/i.test(message)
  );
}

export async function fetchSitePublicProfile(pool: Pool): Promise<SitePublicProfile> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT setting_value FROM platform_settings WHERE setting_key = ? LIMIT 1`,
      [SITE_PUBLIC_PROFILE_KEY],
    );
    if (rows.length === 0) {
      return { ...DEFAULT_SITE_PUBLIC_PROFILE };
    }
    const raw = rows[0].setting_value;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return mergeSitePublicProfile(parsed as Partial<SitePublicProfile>);
    } catch {
      return { ...DEFAULT_SITE_PUBLIC_PROFILE };
    }
  } catch (err) {
    if (isMissingPlatformSettingsTable(err)) {
      console.warn(
        "[platformSettings] platform_settings table missing — returning defaults. Apply migration 20260615_120000_platform_settings.sql",
      );
      return { ...DEFAULT_SITE_PUBLIC_PROFILE };
    }
    throw err;
  }
}

export async function saveSitePublicProfile(
  pool: Pool,
  profile: SitePublicProfile,
): Promise<void> {
  const payload = JSON.stringify(profile);
  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO platform_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [SITE_PUBLIC_PROFILE_KEY, payload],
    );
  } catch (err) {
    if (isMissingPlatformSettingsTable(err)) {
      throw new Error(
        "platform_settings table missing. Apply migration 20260615_120000_platform_settings.sql",
      );
    }
    throw err;
  }
}

export function normalizeSitePublicProfile(body: unknown): SitePublicProfile | null {
  if (!body || typeof body !== "object") return null;
  return mergeSitePublicProfile(body as Partial<SitePublicProfile>);
}
