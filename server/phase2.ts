import crypto from "crypto";
import type {
  Express,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  AchievementRow,
  BulkMessageRequest,
  GamificationProfile,
  TeamMemberRow,
  TeamRow,
  TransferRequest,
} from "../shared/api.js";

type ActorType = "athlete" | "organizer" | "admin";

interface Phase2Auth {
  actor: ActorType;
  id: number;
  email: string;
  organizerId?: number;
  jti: string;
}

interface AuthedRequest extends Request {
  auth?: Phase2Auth;
}

export interface Phase2Deps {
  pool: Pool;
  requireAthlete: RequestHandler;
  requireOrganizer: RequestHandler;
  requireAdmin: RequestHandler;
  newPublicUuid: () => string;
  sendEmail: (opts: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) => Promise<{ id: string }>;
  appUrl: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 12; i += 1) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

async function uniqueTeamSlug(pool: Pool, base: string): Promise<string> {
  const candidate = base || "team";
  for (let n = 0; n < 100; n += 1) {
    const slug = n === 0 ? candidate : `${candidate}-${n}`;
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM athlete_teams WHERE slug = ? LIMIT 1",
      [slug],
    );
    if (rows.length === 0) return slug;
  }
  return `${candidate}-${Date.now()}`;
}

async function uniqueInviteCode(pool: Pool): Promise<string> {
  for (let n = 0; n < 20; n += 1) {
    const code = generateInviteCode();
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM athlete_teams WHERE invite_code = ? LIMIT 1",
      [code],
    );
    if (rows.length === 0) return code;
  }
  return generateInviteCode();
}

async function resolveTeamId(
  pool: Pool,
  teamIdParam: string,
): Promise<number | null> {
  const raw = String(teamIdParam ?? "").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM athlete_teams WHERE public_uuid = ? LIMIT 1",
    [raw],
  );
  return rows[0]?.id != null ? Number(rows[0].id) : null;
}

async function assertTeamMember(
  pool: Pool,
  teamId: number,
  athleteId: number,
): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, team_id, athlete_id, role, joined_at
     FROM athlete_team_members
     WHERE team_id = ? AND athlete_id = ? LIMIT 1`,
    [teamId, athleteId],
  );
  return rows[0] ?? null;
}

async function ensureGamificationProfile(
  pool: Pool,
  athleteId: number,
): Promise<GamificationProfile> {
  await pool.query<ResultSetHeader>(
    `INSERT IGNORE INTO athlete_gamification
       (athlete_id, xp_total, level, streak_days, last_activity_date)
     VALUES (?, 0, 1, 0, NULL)`,
    [athleteId],
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT athlete_id, xp_total, level, streak_days, last_activity_date, updated_at
     FROM athlete_gamification WHERE athlete_id = ? LIMIT 1`,
    [athleteId],
  );
  const row = rows[0];
  return {
    athlete_id: Number(row.athlete_id),
    xp_total: Number(row.xp_total),
    level: Number(row.level),
    streak_days: Number(row.streak_days),
    last_activity_date: row.last_activity_date
      ? String(row.last_activity_date).slice(0, 10)
      : null,
    updated_at: String(row.updated_at),
  };
}

function mapTeamRow(row: RowDataPacket, myRole?: string): TeamRow {
  return {
    id: Number(row.id),
    public_uuid: String(row.public_uuid),
    name: String(row.name),
    slug: String(row.slug),
    owner_athlete_id: Number(row.owner_athlete_id),
    description: row.description != null ? String(row.description) : null,
    avatar_url: row.avatar_url != null ? String(row.avatar_url) : null,
    invite_code: String(row.invite_code),
    is_public: Boolean(row.is_public),
    member_count: Number(row.member_count),
    created_at: String(row.created_at),
    my_role: myRole,
  };
}

function mapTeamMemberRow(row: RowDataPacket): TeamMemberRow {
  return {
    id: Number(row.id),
    team_id: Number(row.team_id),
    athlete_id: Number(row.athlete_id),
    role: row.role as "owner" | "member",
    joined_at: String(row.joined_at),
    first_name: String(row.first_name ?? ""),
    last_name: String(row.last_name ?? ""),
    avatar_url: row.avatar_url != null ? String(row.avatar_url) : null,
    public_uuid: String(row.public_uuid ?? ""),
  };
}

function mapAchievementRow(row: RowDataPacket): AchievementRow {
  return {
    id: Number(row.id),
    athlete_id: Number(row.athlete_id),
    achievement_id: Number(row.achievement_id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description != null ? String(row.description) : null,
    icon: row.icon != null ? String(row.icon) : null,
    xp_reward: Number(row.xp_reward),
    criteria_type: row.criteria_type as AchievementRow["criteria_type"],
    earned_at: String(row.earned_at),
    event_id: row.event_id != null ? Number(row.event_id) : null,
  };
}

async function assertOrganizerOwnsEvent(
  pool: Pool,
  organizerId: number,
  eventId: number,
): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM events WHERE id = ? AND organizer_id = ? AND deleted_at IS NULL LIMIT 1",
    [eventId, organizerId],
  );
  return rows.length > 0;
}

async function awardTeamJoinAchievement(
  pool: Pool,
  athleteId: number,
): Promise<void> {
  const [defs] = await pool.query<RowDataPacket[]>(
    `SELECT id, xp_reward FROM achievement_definitions
     WHERE slug = 'team-join' LIMIT 1`,
  );
  if (defs.length === 0) return;

  const achievementId = Number(defs[0].id);
  const xpReward = Number(defs[0].xp_reward);

  const [insertResult] = await pool.query<ResultSetHeader>(
    `INSERT IGNORE INTO athlete_achievements (athlete_id, achievement_id)
     VALUES (?, ?)`,
    [athleteId, achievementId],
  );
  if (insertResult.affectedRows === 0) return;

  await pool.query<ResultSetHeader>(
    `INSERT INTO athlete_gamification (athlete_id, xp_total, level, streak_days)
     VALUES (?, ?, 1, 0)
     ON DUPLICATE KEY UPDATE
       xp_total = xp_total + VALUES(xp_total),
       level = FLOOR((xp_total + VALUES(xp_total)) / 100) + 1`,
    [athleteId, xpReward],
  );
}

export function registerPhase2Routes(app: Express, deps: Phase2Deps): void {
  const {
    pool,
    requireAthlete,
    requireOrganizer,
    sendEmail,
    appUrl,
    newPublicUuid,
  } = deps;

  // ── Athlete teams: list & create ─────────────────────────────────────────
  app.get(
    "/api/athlete/teams",
    requireAthlete,
    async (req: AuthedRequest, res: Response) => {
      const athleteId = req.auth!.id;
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT t.id, t.public_uuid, t.name, t.slug, t.owner_athlete_id, t.description,
                t.avatar_url, t.invite_code, t.is_public, t.member_count, t.created_at,
                m.role AS my_role
         FROM athlete_team_members m
         JOIN athlete_teams t ON t.id = m.team_id
         WHERE m.athlete_id = ?
         ORDER BY m.joined_at DESC`,
        [athleteId],
      );
      res.json({ teams: rows.map((r) => mapTeamRow(r, String(r.my_role))) });
    },
  );

  app.post(
    "/api/athlete/teams",
    requireAthlete,
    async (req: AuthedRequest, res: Response) => {
      const athleteId = req.auth!.id;
      const name = String(req.body?.name ?? "").trim();
      if (name.length < 2 || name.length > 120) {
        return res
          .status(400)
          .json({ error: "Team name must be 2–120 characters" });
      }

      const description =
        req.body?.description != null
          ? String(req.body.description).trim().slice(0, 2000) || null
          : null;
      const avatarUrl =
        req.body?.avatar_url != null
          ? String(req.body.avatar_url).trim().slice(0, 500) || null
          : null;
      const isPublic = req.body?.is_public !== false;

      const slug = await uniqueTeamSlug(pool, slugify(name));
      const inviteCode = await uniqueInviteCode(pool);
      const publicUuid = newPublicUuid();

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [teamResult] = await conn.query<ResultSetHeader>(
          `INSERT INTO athlete_teams
             (public_uuid, name, slug, owner_athlete_id, description, avatar_url,
              invite_code, is_public, member_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            publicUuid,
            name,
            slug,
            athleteId,
            description,
            avatarUrl,
            inviteCode,
            isPublic ? 1 : 0,
          ],
        );
        const teamId = teamResult.insertId;
        await conn.query<ResultSetHeader>(
          `INSERT INTO athlete_team_members (team_id, athlete_id, role)
           VALUES (?, ?, 'owner')`,
          [teamId, athleteId],
        );
        await conn.commit();

        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT id, public_uuid, name, slug, owner_athlete_id, description, avatar_url,
                  invite_code, is_public, member_count, created_at
           FROM athlete_teams WHERE id = ? LIMIT 1`,
          [teamId],
        );
        res.status(201).json({ team: mapTeamRow(rows[0], "owner") });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    },
  );

  // ── Join by invite code (before :teamId route) ───────────────────────────
  app.post(
    "/api/athlete/teams/join",
    requireAthlete,
    async (req: AuthedRequest, res: Response) => {
      const athleteId = req.auth!.id;
      const inviteCode = String(req.body?.invite_code ?? "")
        .trim()
        .toUpperCase();
      if (!inviteCode || inviteCode.length > 12) {
        return res.status(400).json({ error: "invite_code required" });
      }

      const [teamRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, public_uuid, name, slug, owner_athlete_id, description, avatar_url,
                invite_code, is_public, member_count, created_at
         FROM athlete_teams WHERE invite_code = ? LIMIT 1`,
        [inviteCode],
      );
      if (teamRows.length === 0) {
        return res.status(404).json({ error: "Invalid invite code" });
      }
      const team = teamRows[0];
      const teamId = Number(team.id);

      const existing = await assertTeamMember(pool, teamId, athleteId);
      if (existing) {
        return res.status(409).json({ error: "Already a team member" });
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query<ResultSetHeader>(
          `INSERT INTO athlete_team_members (team_id, athlete_id, role)
           VALUES (?, ?, 'member')`,
          [teamId, athleteId],
        );
        await conn.query<ResultSetHeader>(
          "UPDATE athlete_teams SET member_count = member_count + 1 WHERE id = ?",
          [teamId],
        );
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      await awardTeamJoinAchievement(pool, athleteId);

      const [updated] = await pool.query<RowDataPacket[]>(
        `SELECT id, public_uuid, name, slug, owner_athlete_id, description, avatar_url,
                invite_code, is_public, member_count, created_at
         FROM athlete_teams WHERE id = ? LIMIT 1`,
        [teamId],
      );
      res.json({ team: mapTeamRow(updated[0], "member") });
    },
  );

  // ── Team detail ───────────────────────────────────────────────────────────
  app.get(
    "/api/athlete/teams/:teamId",
    requireAthlete,
    async (req: AuthedRequest, res: Response) => {
      const athleteId = req.auth!.id;
      const teamId = await resolveTeamId(pool, String(req.params.teamId));
      if (teamId == null) {
        return res.status(400).json({ error: "Invalid team id" });
      }

      const membership = await assertTeamMember(pool, teamId, athleteId);
      const [teamRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, public_uuid, name, slug, owner_athlete_id, description, avatar_url,
                invite_code, is_public, member_count, created_at
         FROM athlete_teams WHERE id = ? LIMIT 1`,
        [teamId],
      );
      if (teamRows.length === 0) {
        return res.status(404).json({ error: "Team not found" });
      }

      const team = teamRows[0];
      if (!team.is_public && !membership) {
        return res.status(403).json({ error: "Team is private" });
      }

      const [memberRows] = await pool.query<RowDataPacket[]>(
        `SELECT m.id, m.team_id, m.athlete_id, m.role, m.joined_at,
                a.first_name, a.last_name, a.avatar_url, a.public_uuid
         FROM athlete_team_members m
         JOIN athletes a ON a.id = m.athlete_id AND a.deleted_at IS NULL
         WHERE m.team_id = ?
         ORDER BY m.role ASC, m.joined_at ASC`,
        [teamId],
      );

      res.json({
        team: mapTeamRow(team, membership?.role as string | undefined),
        members: memberRows.map(mapTeamMemberRow),
      });
    },
  );

  // ── Leave team ────────────────────────────────────────────────────────────
  app.post(
    "/api/athlete/teams/:teamId/leave",
    requireAthlete,
    async (req: AuthedRequest, res: Response) => {
      const athleteId = req.auth!.id;
      const teamId = await resolveTeamId(pool, String(req.params.teamId));
      if (teamId == null) {
        return res.status(400).json({ error: "Invalid team id" });
      }

      const membership = await assertTeamMember(pool, teamId, athleteId);
      if (!membership) {
        return res.status(404).json({ error: "Not a team member" });
      }
      if (membership.role === "owner") {
        return res.status(400).json({
          error: "Team owners cannot leave; transfer ownership or delete the team",
        });
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query<ResultSetHeader>(
          "DELETE FROM athlete_team_members WHERE team_id = ? AND athlete_id = ?",
          [teamId, athleteId],
        );
        await conn.query<ResultSetHeader>(
          "UPDATE athlete_teams SET member_count = GREATEST(0, member_count - 1) WHERE id = ?",
          [teamId],
        );
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      res.json({ ok: true });
    },
  );

  // ── Gamification profile ──────────────────────────────────────────────────
  app.get(
    "/api/athlete/gamification",
    requireAthlete,
    async (req: AuthedRequest, res: Response) => {
      const athleteId = req.auth!.id;
      const profile = await ensureGamificationProfile(pool, athleteId);

      const [recentRows] = await pool.query<RowDataPacket[]>(
        `SELECT aa.id, aa.athlete_id, aa.achievement_id, aa.earned_at, aa.event_id,
                ad.slug, ad.name, ad.description, ad.icon, ad.xp_reward, ad.criteria_type
         FROM athlete_achievements aa
         JOIN achievement_definitions ad ON ad.id = aa.achievement_id
         WHERE aa.athlete_id = ?
         ORDER BY aa.earned_at DESC
         LIMIT 5`,
        [athleteId],
      );

      res.json({
        profile,
        recentAchievements: recentRows.map(mapAchievementRow),
        nextLevelXp: profile.level * 100,
      });
    },
  );

  // ── All earned achievements ─────────────────────────────────────────────────
  app.get(
    "/api/athlete/achievements",
    requireAthlete,
    async (req: AuthedRequest, res: Response) => {
      const athleteId = req.auth!.id;
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT aa.id, aa.athlete_id, aa.achievement_id, aa.earned_at, aa.event_id,
                ad.slug, ad.name, ad.description, ad.icon, ad.xp_reward, ad.criteria_type
         FROM athlete_achievements aa
         JOIN achievement_definitions ad ON ad.id = aa.achievement_id
         WHERE aa.athlete_id = ?
         ORDER BY aa.earned_at DESC`,
        [athleteId],
      );
      res.json({ achievements: rows.map(mapAchievementRow) });
    },
  );

  // ── Organizer bulk messaging ──────────────────────────────────────────────
  app.post(
    "/api/organizer/events/:eventId/messages/bulk",
    requireOrganizer,
    async (req: AuthedRequest, res: Response) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }

      const eventId = Number(req.params.eventId);
      if (!Number.isFinite(eventId)) {
        return res.status(400).json({ error: "Invalid event id" });
      }
      if (!(await assertOrganizerOwnsEvent(pool, organizerId, eventId))) {
        return res.status(404).json({ error: "Event not found" });
      }

      const body = (req.body ?? {}) as BulkMessageRequest;
      const subject = String(body.subject ?? "").trim();
      const messageBody = String(body.body ?? "").trim();
      if (!subject || subject.length > 500) {
        return res.status(400).json({ error: "subject required (max 500 chars)" });
      }
      if (!messageBody) {
        return res.status(400).json({ error: "body required" });
      }

      const [registrants] = await pool.query<RowDataPacket[]>(
        `SELECT r.athlete_id, a.email, a.first_name, a.last_name
         FROM registrations r
         JOIN athletes a ON a.id = r.athlete_id AND a.deleted_at IS NULL
         WHERE r.event_id = ? AND r.status = 'confirmed' AND r.deleted_at IS NULL
           AND a.email IS NOT NULL AND a.email <> ''`,
        [eventId],
      );

      let queued = 0;
      let skipped = 0;

      for (const reg of registrants) {
        const email = String(reg.email).trim();
        if (!email) {
          skipped += 1;
          continue;
        }
        const html = messageBody.includes("<")
          ? messageBody
          : `<p>${messageBody.replace(/\n/g, "<br/>")}</p>`;
        await pool.query<ResultSetHeader>(
          `INSERT INTO notification_queue
             (recipient_type, recipient_id, channel, to_address, subject, body, payload_json)
           VALUES ('athlete', ?, 'email', ?, ?, ?, ?)`,
          [
            reg.athlete_id,
            email,
            subject,
            html,
            JSON.stringify({ event_id: eventId, type: "bulk_message" }),
          ],
        );
        queued += 1;
      }

      res.json({ queued, skipped, total: registrants.length });
    },
  );

  // ── Registration transfer ─────────────────────────────────────────────────
  app.post(
    "/api/athlete/registrations/:registrationId/transfer",
    requireAthlete,
    async (req: AuthedRequest, res: Response) => {
      const athleteId = req.auth!.id;
      const registrationId = Number(req.params.registrationId);
      if (!Number.isFinite(registrationId)) {
        return res.status(400).json({ error: "Invalid registration id" });
      }

      const transferBody = (req.body ?? {}) as TransferRequest;
      const recipientEmail = String(transferBody.recipientEmail ?? "")
        .trim()
        .toLowerCase();
      if (!recipientEmail || !recipientEmail.includes("@")) {
        return res.status(400).json({ error: "recipientEmail required" });
      }

      const [regRows] = await pool.query<RowDataPacket[]>(
        `SELECT r.id, r.public_uuid, r.status, r.athlete_id, r.event_id, r.registration_number,
                e.title AS event_title, e.allows_transfers, e.transfer_fee_cents
         FROM registrations r
         JOIN events e ON e.id = r.event_id AND e.deleted_at IS NULL
         WHERE r.id = ? AND r.athlete_id = ? AND r.deleted_at IS NULL LIMIT 1`,
        [registrationId, athleteId],
      );
      if (regRows.length === 0) {
        return res.status(404).json({ error: "Registration not found" });
      }

      const reg = regRows[0];
      if (reg.status !== "confirmed") {
        return res
          .status(400)
          .json({ error: "Only confirmed registrations can be transferred" });
      }
      if (!reg.allows_transfers) {
        return res
          .status(400)
          .json({ error: "This event does not allow registration transfers" });
      }

      const [pendingRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM registration_transfers
         WHERE registration_id = ? AND status = 'pending' LIMIT 1`,
        [registrationId],
      );
      if (pendingRows.length > 0) {
        return res
          .status(409)
          .json({ error: "A transfer is already pending for this registration" });
      }

      const [recipientRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, email, first_name, last_name
         FROM athletes
         WHERE email = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
        [recipientEmail],
      );
      if (recipientRows.length === 0) {
        return res
          .status(404)
          .json({ error: "Recipient athlete not found for this email" });
      }

      const recipient = recipientRows[0];
      const toAthleteId = Number(recipient.id);
      if (toAthleteId === athleteId) {
        return res
          .status(400)
          .json({ error: "Cannot transfer registration to yourself" });
      }

      const transferFeeCents = Number(reg.transfer_fee_cents ?? 0);

      const [transferResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO registration_transfers
           (registration_id, from_athlete_id, to_athlete_id, transfer_fee_cents, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [registrationId, athleteId, toAthleteId, transferFeeCents],
      );

      const transferId = transferResult.insertId;
      const eventTitle = String(reg.event_title);
      const regNumber = String(reg.registration_number);
      const portalUrl = `${appUrl.replace(/\/$/, "")}/portal/registrations`;
      const senderName = req.auth!.email;

      const emailSubject = `Registration transfer request: ${eventTitle}`;
      const emailHtml = `
        <p>Hello ${String(recipient.first_name)},</p>
        <p>${senderName} wants to transfer their registration <strong>${regNumber}</strong> for <strong>${eventTitle}</strong> to you.</p>
        <p><a href="${portalUrl}">Review and accept the transfer in your athlete portal</a>.</p>
      `;
      const emailText = `Registration transfer request for ${eventTitle}. Registration ${regNumber}. Review at ${portalUrl}`;

      void sendEmail({
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });

      await pool.query<ResultSetHeader>(
        `INSERT INTO notification_queue
           (recipient_type, recipient_id, channel, to_address, subject, body, payload_json)
         VALUES ('athlete', ?, 'email', ?, ?, ?, ?)`,
        [
          toAthleteId,
          recipientEmail,
          emailSubject,
          emailHtml,
          JSON.stringify({
            type: "registration_transfer",
            transfer_id: transferId,
            registration_id: registrationId,
          }),
        ],
      );

      const [transferRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, registration_id, from_athlete_id, to_athlete_id,
                transfer_fee_cents, status, payment_id, completed_at, created_at
         FROM registration_transfers WHERE id = ? LIMIT 1`,
        [transferId],
      );

      res.status(201).json({ transfer: transferRows[0] });
    },
  );
}
