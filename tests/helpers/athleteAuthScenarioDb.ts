import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import crypto from "crypto";

export const AUTH_SCENARIO = {
  athleteId: 1001,
  email: "athlete@test.local",
  firstName: "Test",
  lastName: "Athlete",
} as const;

type AthleteRow = RowDataPacket & {
  id: number;
  public_uuid: string;
  email: string;
  first_name: string;
  last_name: string;
  preferred_language: string;
  password_hash: string | null;
  password_set_at: string | null;
  google_id: string | null;
  apple_id: string | null;
  clerk_user_id: string | null;
  status: string;
  deleted_at: string | null;
  avatar_url: string | null;
  last_login_at: string | null;
  date_of_birth: string | null;
  gender: string | null;
  created_at: string;
  phone: string | null;
  shirt_size: string | null;
  country: string;
  city: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

type ResetRow = RowDataPacket & {
  id: number;
  athlete_id: number;
  token_hash: string;
  expires_at: Date;
  consumed_at: string | null;
  ip_address: string | null;
};

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function header(insertId = 0, affectedRows = 1): ResultSetHeader {
  return { insertId, affectedRows } as ResultSetHeader;
}

export interface AthleteAuthSeed {
  email?: string;
  passwordHash?: string | null;
  hasSocial?: boolean;
  /** Non-active athletes are hidden from check-email and blocked from login. */
  status?: "active" | "suspended" | "inactive";
  /** Soft-deleted athletes behave as unknown for auth flows. */
  deleted?: boolean;
}

type SessionRow = RowDataPacket & {
  id: number;
  athlete_id: number;
  token_hash: string;
  is_active: number;
  expires_at: Date;
};

export class AthleteAuthScenarioDb {
  readonly athletes: AthleteRow[] = [];
  readonly passwordResets: ResetRow[] = [];
  readonly sessions: SessionRow[] = [];

  private nextAthleteId = AUTH_SCENARIO.athleteId;
  private nextResetId = 1;
  private nextSessionId = 1;
  private nextPublicUuid = 1;

  private makeAthlete(
    partial: {
      email: string;
      id?: number;
      public_uuid?: string;
      first_name?: string;
      last_name?: string;
      preferred_language?: string;
      password_hash?: string | null;
      google_id?: string | null;
      apple_id?: string | null;
      clerk_user_id?: string | null;
      status?: string;
      deleted_at?: string | null;
      avatar_url?: string | null;
      last_login_at?: string | null;
      date_of_birth?: string | null;
      gender?: string | null;
    },
  ): AthleteRow {
    return {
      id: AUTH_SCENARIO.athleteId,
      public_uuid: `auth-uuid-${this.nextPublicUuid++}`,
      email: partial.email,
      first_name: partial.first_name ?? AUTH_SCENARIO.firstName,
      last_name: partial.last_name ?? AUTH_SCENARIO.lastName,
      preferred_language: partial.preferred_language ?? "en",
      password_hash: partial.password_hash ?? null,
      password_set_at: partial.password_hash ? new Date().toISOString() : null,
      google_id: partial.google_id ?? null,
      apple_id: partial.apple_id ?? null,
      clerk_user_id: partial.clerk_user_id ?? null,
      status: partial.status ?? "active",
      deleted_at: partial.deleted_at ?? null,
      avatar_url: partial.avatar_url ?? null,
      last_login_at: partial.last_login_at ?? null,
      date_of_birth: partial.date_of_birth ?? "1990-05-01",
      gender: partial.gender ?? "male",
      created_at: new Date().toISOString(),
      phone: null,
      shirt_size: null,
      country: "MX",
      city: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
    } as AthleteRow;
  }

  constructor(seed: AthleteAuthSeed = {}) {
    if (seed.passwordHash !== undefined || seed.hasSocial || seed.status || seed.deleted) {
      this.athletes.push(
        this.makeAthlete({
          email: seed.email ?? AUTH_SCENARIO.email,
          password_hash: seed.passwordHash ?? null,
          google_id: seed.hasSocial ? "google-123" : null,
          clerk_user_id: seed.hasSocial ? "clerk-abc" : null,
          status: seed.status ?? "active",
          deleted_at: seed.deleted ? new Date().toISOString() : null,
        }),
      );
    }
  }

  query = async (
    sql: string,
    params: unknown[] = [],
  ): Promise<[unknown, unknown]> => {
    const q = normalizeSql(sql);

    if (
      q.includes(
        "select id, password_hash, google_id, apple_id, clerk_user_id, status, deleted_at",
      ) &&
      q.includes("from athletes where email = ? limit 1")
    ) {
      const email = String(params[0]).toLowerCase();
      const row = this.athletes.find((a) => a.email === email);
      if (!row) return [[], []];
      return [
        [
          {
            id: row.id,
            password_hash: row.password_hash,
            google_id: row.google_id,
            apple_id: row.apple_id,
            clerk_user_id: row.clerk_user_id,
            status: row.status,
            deleted_at: row.deleted_at,
          },
        ],
        [],
      ];
    }

    if (
      q.includes("from athletes") &&
      q.includes("where email = ?") &&
      q.includes("status = 'active'") &&
      q.includes("deleted_at is null") &&
      q.includes("password_hash")
    ) {
      const email = String(params[0]).toLowerCase();
      const row = this.athletes.find(
        (a) => a.email === email && a.status === "active" && !a.deleted_at,
      );
      if (!row) {
        return [[], []];
      }
      return [
        [
          {
            id: row.id,
            password_hash: row.password_hash,
            google_id: row.google_id,
            apple_id: row.apple_id,
            clerk_user_id: row.clerk_user_id,
          },
        ],
        [],
      ];
    }

    if (q.includes("select id from athletes where email") && q.includes("deleted_at is null")) {
      const email = String(params[0]).toLowerCase();
      const row = this.athletes.find((a) => a.email === email && !a.deleted_at);
      if (!row) return [[], []];
      return [
        [
          {
            id: row.id,
            password_hash: row.password_hash,
            google_id: row.google_id,
            apple_id: row.apple_id,
            clerk_user_id: row.clerk_user_id,
          },
        ],
        [],
      ];
    }

    if (q.includes("select date_of_birth, gender from athletes")) {
      const athleteId = Number(params[0]);
      const row = this.athletes.find(
        (a) => a.id === athleteId && a.status === "active" && !a.deleted_at,
      );
      if (!row) return [[], []];
      return [[{ date_of_birth: row.date_of_birth, gender: row.gender }], []];
    }

    if (q.startsWith("insert into athletes") && q.includes("clerk_user_id")) {
      const athlete = this.makeAthlete({
        email: String(params[1]).toLowerCase(),
        first_name: String(params[3]),
        last_name: String(params[4]),
        avatar_url: params[5] ? String(params[5]) : null,
        google_id: params[6] ? String(params[6]) : null,
        apple_id: params[7] ? String(params[7]) : null,
        clerk_user_id: String(params[8]),
        preferred_language: String(params[9]),
        date_of_birth: null,
        gender: null,
      });
      athlete.id = this.nextAthleteId++;
      athlete.public_uuid = String(params[0]);
      this.athletes.push(athlete);
      return [header(athlete.id, 1), []];
    }

    if (q.startsWith("insert into athletes")) {
      const athlete = this.makeAthlete({
        email: String(params[1]).toLowerCase(),
        first_name: String(params[3]),
        last_name: String(params[4]),
        date_of_birth: String(params[5]),
        gender: params[6] ? String(params[6]) : null,
        preferred_language: String(params[7]),
        password_hash: String(params[2]),
      });
      athlete.id = this.nextAthleteId++;
      athlete.public_uuid = String(params[0]);
      this.athletes.push(athlete);
      return [header(athlete.id, 1), []];
    }

    if (
      q.includes("from athletes") &&
      q.includes("clerk_user_id = ?") &&
      q.includes(" or email = ?")
    ) {
      const clerkId = String(params[0]);
      const email = String(params[1]).toLowerCase();
      const googleId = params[2] != null ? String(params[2]) : null;
      const appleId = params[3] != null ? String(params[3]) : null;
      const row = this.athletes.find(
        (a) =>
          a.status === "active" &&
          !a.deleted_at &&
          (a.clerk_user_id === clerkId ||
            a.email === email ||
            (googleId && a.google_id === googleId) ||
            (appleId && a.apple_id === appleId)),
      );
      return [row ? [{ ...row }] : [], []];
    }

    if (q.startsWith("update athletes set") && q.includes("clerk_user_id = coalesce")) {
      const athleteId = Number(params[params.length - 1]);
      const row = this.athletes.find((a) => a.id === athleteId);
      if (row) {
        if (params[0]) row.email = String(params[0]).toLowerCase();
        if (params[5]) row.google_id = row.google_id || String(params[5]);
        if (params[6]) row.apple_id = row.apple_id || String(params[6]);
        if (params[7]) row.clerk_user_id = row.clerk_user_id || String(params[7]);
        if (params[3]) row.avatar_url = row.avatar_url || String(params[3]);
        row.last_login_at = new Date().toISOString();
      }
      return [header(0, row ? 1 : 0), []];
    }

    if (
      q.includes("select id, email, first_name, last_name, date_of_birth, gender, avatar_url") &&
      q.includes("from athletes where id")
    ) {
      const id = Number(params[0]);
      const row = this.athletes.find((a) => a.id === id);
      return [row ? [{ ...row }] : [], []];
    }

    if (
      q.includes("select id, public_uuid, email, phone, first_name, last_name, date_of_birth") &&
      q.includes("from athletes where id")
    ) {
      const id = Number(params[0]);
      const row = this.athletes.find((a) => a.id === id && !a.deleted_at);
      return [row ? [{ ...row }] : [], []];
    }

    if (
      q.includes("select id, email, first_name, last_name, avatar_url, last_login_at") &&
      q.includes("from athletes where id") &&
      !q.includes("preferred_language")
    ) {
      const id = Number(params[0]);
      const row = this.athletes.find((a) => a.id === id);
      return [row ? [{ ...row }] : [], []];
    }

    if (
      q.includes("select id, email, first_name, last_name, avatar_url, preferred_language") &&
      q.includes("last_login_at") &&
      q.includes("from athletes where id")
    ) {
      const id = Number(params[0]);
      const row = this.athletes.find((a) => a.id === id);
      return [row ? [{ ...row }] : [], []];
    }

    if (
      q.includes("select id, email, first_name, last_name") &&
      q.includes("password_hash") &&
      q.includes("from athletes where email")
    ) {
      const email = String(params[0]).toLowerCase();
      const row = this.athletes.find((a) => a.email === email && !a.deleted_at);
      return [row ? [{ ...row }] : [], []];
    }

    if (q.includes("select id, email, first_name, preferred_language from athletes")) {
      const email = String(params[0]).toLowerCase();
      const row = this.athletes.find(
        (a) => a.email === email && a.status === "active" && !a.deleted_at,
      );
      return [row ? [{ id: row.id, email: row.email, first_name: row.first_name, preferred_language: row.preferred_language }] : [], []];
    }

    if (q.startsWith("update athletes set last_login_at")) {
      const id = Number(params[0]);
      const row = this.athletes.find((a) => a.id === id);
      if (row) row.last_login_at = new Date().toISOString();
      return [header(0, row ? 1 : 0), []];
    }

    if (q.startsWith("update athletes set password_hash")) {
      const hash = String(params[0]);
      const id = Number(params[1]);
      const row = this.athletes.find((a) => a.id === id);
      if (row) {
        row.password_hash = hash;
        row.password_set_at = new Date().toISOString();
      }
      return [header(0, row ? 1 : 0), []];
    }

    if (
      q.startsWith("update athletes set") &&
      q.includes("status = 'active'") &&
      q.includes("deleted_at = null")
    ) {
      const athleteId = Number(params[params.length - 1]);
      const row = this.athletes.find((a) => a.id === athleteId);
      if (row) {
        row.status = "active";
        row.deleted_at = null;
        row.first_name = String(params[0]);
        row.last_name = String(params[1]);
        row.password_hash = String(params[2]);
        row.password_set_at = new Date().toISOString();
        row.date_of_birth = String(params[3]);
        row.gender = params[4] ? String(params[4]) : null;
        row.preferred_language = String(params[5]);
      }
      return [header(0, row ? 1 : 0), []];
    }

    if (q.includes("update athlete_password_resets set consumed_at = now()") && q.includes("athlete_id")) {
      const athleteId = Number(params[0]);
      for (const r of this.passwordResets) {
        if (r.athlete_id === athleteId && !r.consumed_at) {
          r.consumed_at = new Date().toISOString();
        }
      }
      return [header(0, 1), []];
    }

    if (q.startsWith("insert into athlete_password_resets")) {
      const athleteId = Number(params[0]);
      const tokenHash = String(params[1]);
      const minutes = Number(params[2]);
      const reset: ResetRow = {
        id: this.nextResetId++,
        athlete_id: athleteId,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + minutes * 60 * 1000),
        consumed_at: null,
        ip_address: params[3] as string | null,
      } as ResetRow;
      this.passwordResets.push(reset);
      return [header(reset.id, 1), []];
    }

    if (q.includes("from athlete_password_resets r") && q.includes("inner join athletes a")) {
      const email = String(params[0]).toLowerCase();
      const tokenHash = String(params[1]);
      const athlete = this.athletes.find((a) => a.email === email);
      if (!athlete) return [[], []];
      const row = this.passwordResets.find(
        (r) =>
          r.athlete_id === athlete.id &&
          r.token_hash === tokenHash &&
          !r.consumed_at &&
          r.expires_at > new Date(),
      );
      return [row ? [{ id: row.id, athlete_id: row.athlete_id }] : [], []];
    }

    if (q.startsWith("update athlete_password_resets set consumed_at = now() where id")) {
      const id = Number(params[0]);
      const row = this.passwordResets.find((r) => r.id === id);
      if (row) row.consumed_at = new Date().toISOString();
      return [header(0, row ? 1 : 0), []];
    }

    if (q.startsWith("insert into athlete_sessions")) {
      const expiresAt =
        params[4] instanceof Date ? params[4] : new Date(String(params[4]));
      this.sessions.push({
        id: this.nextSessionId++,
        athlete_id: Number(params[0]),
        token_hash: String(params[1]),
        is_active: 1,
        expires_at: expiresAt,
      } as SessionRow);
      return [header(this.nextSessionId - 1, 1), []];
    }

    if (q.includes("select id from athlete_sessions") && q.includes("token_hash")) {
      const hash = String(params[0]);
      const row = this.sessions.find(
        (s) => s.token_hash === hash && s.is_active === 1 && s.expires_at > new Date(),
      );
      return [row ? [{ id: row.id }] : [], []];
    }

    if (q.includes("update athlete_sessions set is_active = 0")) {
      const hash = String(params[0]);
      const row = this.sessions.find((s) => s.token_hash === hash);
      if (row) row.is_active = 0;
      return [header(0, row ? 1 : 0), []];
    }

    throw new Error(`[AthleteAuthScenarioDb] Unhandled SQL: ${sql.slice(0, 160)}…`);
  };

  getConnection = async (): Promise<PoolConnection> => {
    const self = this;
    return {
      query: self.query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: async () => {},
    } as unknown as PoolConnection;
  };

  asPool(): Pool {
    return {
      query: this.query,
      getConnection: this.getConnection,
    } as unknown as Pool;
  }

  /** Pre-seed a valid reset code for an existing athlete (for tests). */
  seedResetCode(email: string, code: string, minutes = 10): void {
    const athlete = this.athletes.find((a) => a.email === email.toLowerCase());
    if (!athlete) return;
    this.passwordResets.push({
      id: this.nextResetId++,
      athlete_id: athlete.id,
      token_hash: crypto.createHash("sha256").update(code).digest("hex"),
      expires_at: new Date(Date.now() + minutes * 60 * 1000),
      consumed_at: null,
      ip_address: null,
    } as ResetRow);
  }

  seedExpiredResetCode(email: string, code: string): void {
    const athlete = this.athletes.find((a) => a.email === email.toLowerCase());
    if (!athlete) return;
    this.passwordResets.push({
      id: this.nextResetId++,
      athlete_id: athlete.id,
      token_hash: crypto.createHash("sha256").update(code).digest("hex"),
      expires_at: new Date(Date.now() - 60_000),
      consumed_at: null,
      ip_address: null,
    } as ResetRow);
  }
}

export const authSeeds = {
  empty: (): AthleteAuthSeed => ({}),
  withPassword: (passwordHash: string): AthleteAuthSeed => ({ passwordHash }),
  legacyNoPassword: (): AthleteAuthSeed => ({ passwordHash: null }),
  withSocial: (): AthleteAuthSeed => ({ passwordHash: null, hasSocial: true }),
  socialOnly: (): AthleteAuthSeed => ({ passwordHash: null, hasSocial: true }),
  inactive: (passwordHash: string): AthleteAuthSeed => ({
    passwordHash,
    status: "suspended",
  }),
  deleted: (passwordHash: string): AthleteAuthSeed => ({
    passwordHash,
    deleted: true,
  }),
};
