import type { Express, Request, Response } from "express";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type {
  PublicTeamDetailResponse,
  PublicTeamListItem,
  PublicTeamMemberPreview,
} from "../shared/api.js";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;

function mapPublicTeamRow(row: RowDataPacket): PublicTeamListItem {
  return {
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: row.description != null ? String(row.description) : null,
    avatar_url: row.avatar_url != null ? String(row.avatar_url) : null,
    member_count: Number(row.live_member_count ?? row.member_count ?? 0),
    created_at: String(row.created_at),
  };
}

function mapMemberPreview(row: RowDataPacket): PublicTeamMemberPreview {
  return {
    first_name: String(row.first_name ?? ""),
    last_name: String(row.last_name ?? ""),
    avatar_url: row.avatar_url != null ? String(row.avatar_url) : null,
    role: String(row.role ?? "member"),
  };
}

export function registerPublicTeamRoutes(
  app: Express,
  pool: Pool,
  teamMemberCountSql: string,
): void {
  app.get("/api/public/teams", async (req: Request, res: Response) => {
    const q = String(req.query.q ?? "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT),
    );
    const sort = String(req.query.sort ?? "members") === "newest" ? "newest" : "members";
    const offset = (page - 1) * limit;

    let where = "WHERE t.is_public = 1";
    const params: (string | number)[] = [];
    if (q) {
      where += " AND (t.name LIKE ? OR t.description LIKE ?)";
      const like = `%${q}%`;
      params.push(like, like);
    }

    const orderBy =
      sort === "newest"
        ? "t.created_at DESC"
        : "live_member_count DESC, t.created_at DESC";

    const [[countRow]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM athlete_teams t ${where}`,
      params,
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.id, t.name, t.slug, t.description, t.avatar_url, t.created_at,
              ${teamMemberCountSql} AS live_member_count
       FROM athlete_teams t
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    res.json({
      teams: rows.map(mapPublicTeamRow),
      total: Number(countRow?.total ?? 0),
      page,
      limit,
    });
  });

  app.get("/api/public/teams/:slug", async (req: Request, res: Response) => {
    const slug = String(req.params.slug ?? "").trim();
    if (!slug) {
      return res.status(400).json({ error: "slug required" });
    }

    const [teamRows] = await pool.query<RowDataPacket[]>(
      `SELECT t.id, t.name, t.slug, t.description, t.avatar_url, t.created_at,
              t.owner_athlete_id,
              ${teamMemberCountSql} AS live_member_count,
              o.first_name AS owner_first_name, o.last_name AS owner_last_name
       FROM athlete_teams t
       JOIN athletes o ON o.id = t.owner_athlete_id AND o.deleted_at IS NULL
       WHERE t.slug = ? AND t.is_public = 1
       LIMIT 1`,
      [slug],
    );
    if (teamRows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }

    const row = teamRows[0];
    const teamId = Number(row.id);

    const [memberRows] = await pool.query<RowDataPacket[]>(
      `SELECT m.role, a.first_name, a.last_name, a.avatar_url
       FROM athlete_team_members m
       JOIN athletes a ON a.id = m.athlete_id AND a.deleted_at IS NULL
       WHERE m.team_id = ?
       ORDER BY FIELD(m.role, 'owner', 'member'), m.joined_at ASC
       LIMIT 24`,
      [teamId],
    );

    const team: PublicTeamListItem & {
      owner_first_name: string;
      owner_last_name: string;
    } = {
      ...mapPublicTeamRow(row),
      owner_first_name: String(row.owner_first_name ?? ""),
      owner_last_name: String(row.owner_last_name ?? ""),
    };

    const payload: PublicTeamDetailResponse = {
      team,
      members_preview: memberRows.map(mapMemberPreview),
    };
    res.json(payload);
  });
}
