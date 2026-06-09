import type { Express, Request, Response, RequestHandler } from "express";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  normalizeBlogSlug,
  resolveBlogSlug,
} from "../shared/slugify.js";
import { uploadImageBufferToCdn } from "./cdnUpload.js";

type AuthPayload = {
  actor: "admin" | "organizer";
  id: number;
  email: string;
  organizerId?: number;
};

type AuthedRequest = Request & { auth?: AuthPayload };

const BLOG_EDITOR_ROLES = new Set([
  "owner",
  "organizer",
  "operations",
  "marketing",
]);

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function computeReadMinutes(
  bodyHtml: string,
  title: string,
  excerpt: string,
): number {
  const words = `${title} ${excerpt} ${stripHtml(bodyHtml)}`
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function mapPublicRow(row: RowDataPacket) {
  return {
    id: row.id as number,
    publicUuid: row.public_uuid as string,
    slug: row.slug as string,
    title: row.title as string,
    excerpt: (row.excerpt as string | null) ?? null,
    bodyHtml: (row.body_html as string | null) ?? null,
    coverImageUrl: (row.cover_image_url as string | null) ?? null,
    featured: Boolean(row.featured),
    scope: row.scope as "platform" | "organizer",
    organizerId: (row.organizer_id as number | null) ?? null,
    organizerName: (row.organizer_name as string | null) ?? null,
    organizerSlug: (row.organizer_slug as string | null) ?? null,
    eventId: (row.event_id as number | null) ?? null,
    eventTitle: (row.event_title as string | null) ?? null,
    eventSlug: (row.event_slug as string | null) ?? null,
    authorName: (row.author_name as string | null) ?? null,
    seoTitle: (row.seo_title as string | null) ?? null,
    seoDescription: (row.seo_description as string | null) ?? null,
    ogImageUrl: (row.og_image_url as string | null) ?? null,
    readTimeMinutes: Number(row.read_time_minutes ?? 5),
    locale: row.locale as string,
    publishedAt: row.published_at
      ? new Date(row.published_at as string).toISOString()
      : null,
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function mapStaffRow(row: RowDataPacket) {
  return {
    ...mapPublicRow(row),
    status: row.status as "draft" | "published" | "archived",
    authorAdminId: (row.author_admin_id as number | null) ?? null,
    authorMemberId: (row.author_member_id as number | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

const BLOG_SELECT = `
  bp.id, bp.public_uuid, bp.slug, bp.title, bp.excerpt, bp.body_html,
  bp.cover_image_url, bp.status, bp.featured, bp.scope, bp.organizer_id,
  bp.event_id, bp.author_admin_id, bp.author_member_id, bp.author_name,
  bp.seo_title, bp.seo_description, bp.og_image_url, bp.read_time_minutes,
  bp.locale, bp.published_at, bp.created_at, bp.updated_at,
  o.name AS organizer_name, o.slug AS organizer_slug,
  e.title AS event_title, e.slug AS event_slug
`;

const BLOG_FROM = `
  FROM blog_posts bp
  LEFT JOIN organizers o ON o.id = bp.organizer_id AND o.deleted_at IS NULL
  LEFT JOIN events e ON e.id = bp.event_id AND e.deleted_at IS NULL
`;

async function isBlogSlugTaken(
  pool: Pool,
  slug: string,
  excludeId?: number,
): Promise<boolean> {
  const params: (string | number)[] = excludeId != null ? [slug, excludeId] : [slug];
  const sql =
    excludeId != null
      ? "SELECT id FROM blog_posts WHERE slug = ? AND id <> ? AND deleted_at IS NULL LIMIT 1"
      : "SELECT id FROM blog_posts WHERE slug = ? AND deleted_at IS NULL LIMIT 1";
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows.length > 0;
}

async function uniqueBlogSlug(
  pool: Pool,
  base: string,
  excludeId?: number,
): Promise<string> {
  const candidate = normalizeBlogSlug(base) || "post";
  for (let n = 0; n < 100; n++) {
    const slug = n === 0 ? candidate : `${candidate}-${n}`;
    const taken = await isBlogSlugTaken(pool, slug, excludeId);
    if (!taken) return slug;
  }
  return `${candidate}-${Date.now()}`;
}

async function checkBlogSlugAvailability(
  pool: Pool,
  rawSlug: string,
  excludeId?: number,
): Promise<{ slug: string; available: boolean; suggestion?: string }> {
  const slug = normalizeBlogSlug(rawSlug);
  if (!slug) {
    return { slug: "", available: false, suggestion: "post" };
  }
  const taken = await isBlogSlugTaken(pool, slug, excludeId);
  if (!taken) {
    return { slug, available: true };
  }
  const suggestion = await uniqueBlogSlug(pool, slug, excludeId);
  return { slug, available: false, suggestion };
}

async function getOrganizerMemberRole(
  pool: Pool,
  memberId: number,
): Promise<string | null> {
  const [[row]] = await pool.query<RowDataPacket[]>(
    "SELECT role FROM organizer_members WHERE id = ? AND status = 'active' LIMIT 1",
    [memberId],
  );
  return (row?.role as string) ?? null;
}

function canEditOrganizerBlog(role: string | null): boolean {
  return role != null && BLOG_EDITOR_ROLES.has(role);
}

export interface BlogRoutesDeps {
  pool: Pool;
  requireAdmin: RequestHandler;
  requireOrganizer: RequestHandler;
  newPublicUuid: () => string;
}

export function registerBlogRoutes(app: Express, deps: BlogRoutesDeps): void {
  const { pool, requireAdmin, requireOrganizer, newPublicUuid } = deps;

  const requireBlogEditor: RequestHandler = async (
    req: AuthedRequest,
    res: Response,
    next,
  ) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (req.auth.actor === "admin") return next();
    if (req.auth.actor === "organizer") {
      const role = await getOrganizerMemberRole(pool, req.auth.id);
      if (canEditOrganizerBlog(role)) return next();
      return res
        .status(403)
        .json({ error: "Insufficient permissions for blog editing" });
    }
    return res.status(401).json({ error: "Unauthorized" });
  };

  app.get("/api/public/blog", async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 12, 48);
    const offset = Number(req.query.offset) || 0;
    const featured =
      req.query.featured === "1" || req.query.featured === "true" ? true : null;
    const organizerSlug = req.query.organizer
      ? String(req.query.organizer).trim()
      : null;
    const eventSlug = req.query.event
      ? String(req.query.event).trim()
      : null;
    const localeParam = req.query.locale
      ? String(req.query.locale).trim().slice(0, 5)
      : null;

    let sql = `
      SELECT ${BLOG_SELECT}
      ${BLOG_FROM}
      WHERE bp.deleted_at IS NULL
        AND bp.status = 'published'
        AND (bp.published_at IS NULL OR bp.published_at <= NOW())
    `;
    const params: unknown[] = [];

    if (featured) sql += " AND bp.featured = 1";
    if (organizerSlug) {
      sql += " AND o.slug = ?";
      params.push(organizerSlug);
    }
    if (eventSlug) {
      sql += ` AND (
        e.slug = ?
        OR (
          bp.scope = 'organizer'
          AND bp.organizer_id = (
            SELECT ev.organizer_id FROM events ev
            WHERE ev.slug = ? AND ev.deleted_at IS NULL
            LIMIT 1
          )
        )
      )`;
      params.push(eventSlug, eventSlug);
    }
    if (localeParam) {
      if (localeParam.startsWith("en")) {
        sql += " AND bp.locale IN ('en', 'es')";
      } else {
        sql += " AND bp.locale = ?";
        params.push(localeParam);
      }
    }

    const localeOrder =
      localeParam?.startsWith("en")
        ? "CASE WHEN bp.locale = 'en' THEN 0 ELSE 1 END, "
        : "";
    sql += ` ORDER BY ${localeOrder}bp.featured DESC, bp.published_at DESC, bp.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    res.json({ posts: rows.map(mapPublicRow), limit, offset });
  });

  app.get("/api/public/blog/:slug", async (req, res) => {
    const slug = String(req.params.slug).trim();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${BLOG_SELECT}
       ${BLOG_FROM}
       WHERE bp.slug = ? AND bp.deleted_at IS NULL
         AND bp.status = 'published'
         AND (bp.published_at IS NULL OR bp.published_at <= NOW())
       LIMIT 1`,
      [slug],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json({ post: mapPublicRow(rows[0]) });
  });

  async function handleBlogImageUpload(req: AuthedRequest, res: Response) {
    const dataBase64 = String(req.body?.dataBase64 ?? "");
    const filename = String(req.body?.filename ?? "image.jpg").slice(0, 200);
    const mimeType = String(req.body?.mimeType ?? "image/jpeg");
    const uploadId = String(req.body?.uploadId ?? "blog_temp").slice(0, 120);

    if (!dataBase64) {
      return res.status(400).json({ error: "dataBase64 required" });
    }
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(mimeType)) {
      return res.status(400).json({ error: "Unsupported image type" });
    }

    const buffer = Buffer.from(dataBase64, "base64");
    if (buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ error: "Image exceeds 8MB limit" });
    }

    try {
      const result = await uploadImageBufferToCdn({
        buffer,
        filename,
        mimeType,
        uploadId: `blog_${uploadId}`,
      });
      res.json({ ok: true, url: result.url, path: result.path });
    } catch (err) {
      console.error("[blog:upload-image]", err);
      res.status(502).json({ error: "CDN upload failed" });
    }
  }

  async function handleCheckSlug(req: Request, res: Response) {
    const raw = String(req.query.slug ?? "").trim();
    const excludeId = req.query.excludeId
      ? Number(req.query.excludeId)
      : undefined;
    if (!raw) {
      return res.status(400).json({ error: "slug query required" });
    }
    const result = await checkBlogSlugAvailability(
      pool,
      raw,
      Number.isFinite(excludeId) ? excludeId : undefined,
    );
    res.json(result);
  }

  app.post(
    "/api/admin/blog/upload-image",
    requireAdmin,
    (req, res) => handleBlogImageUpload(req as AuthedRequest, res),
  );

  app.post(
    "/api/organizer/blog/upload-image",
    requireOrganizer,
    requireBlogEditor,
    (req, res) => handleBlogImageUpload(req as AuthedRequest, res),
  );

  app.get("/api/admin/blog-posts/check-slug", requireAdmin, handleCheckSlug);

  app.get(
    "/api/organizer/blog-posts/check-slug",
    requireOrganizer,
    requireBlogEditor,
    handleCheckSlug,
  );

  app.get("/api/admin/blog-posts", requireAdmin, async (_req, res) => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${BLOG_SELECT}
       ${BLOG_FROM}
       WHERE bp.deleted_at IS NULL
       ORDER BY bp.updated_at DESC
       LIMIT 200`,
    );
    res.json({ posts: rows.map(mapStaffRow) });
  });

  app.get("/api/admin/blog-posts/:postId", requireAdmin, async (req, res) => {
    const postId = Number(req.params.postId);
    if (!Number.isFinite(postId)) {
      return res.status(400).json({ error: "Invalid post id" });
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${BLOG_SELECT}
       ${BLOG_FROM}
       WHERE bp.id = ? AND bp.deleted_at IS NULL LIMIT 1`,
      [postId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json({ post: mapStaffRow(rows[0]) });
  });

  app.post("/api/admin/blog-posts", requireAdmin, async (req: AuthedRequest, res) => {
    try {
      const post = await createBlogPost(pool, req, newPublicUuid, null);
      res.status(201).json({ post });
    } catch (err) {
      sendBlogError(res, err);
    }
  });

  app.patch("/api/admin/blog-posts/:postId", requireAdmin, async (req, res) => {
    try {
      const post = await updateBlogPost(
        pool,
        Number(req.params.postId),
        req.body,
        null,
      );
      res.json({ post });
    } catch (err) {
      sendBlogError(res, err);
    }
  });

  app.delete("/api/admin/blog-posts/:postId", requireAdmin, async (req, res) => {
    const postId = Number(req.params.postId);
    await pool.query(
      "UPDATE blog_posts SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL",
      [postId],
    );
    res.json({ ok: true });
  });

  app.get(
    "/api/organizer/blog-posts",
    requireOrganizer,
    requireBlogEditor,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context required" });
      }
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${BLOG_SELECT}
         ${BLOG_FROM}
         WHERE bp.deleted_at IS NULL AND bp.organizer_id = ?
         ORDER BY bp.updated_at DESC LIMIT 200`,
        [organizerId],
      );
      res.json({ posts: rows.map(mapStaffRow) });
    },
  );

  app.get(
    "/api/organizer/blog-posts/:postId",
    requireOrganizer,
    requireBlogEditor,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      const postId = Number(req.params.postId);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${BLOG_SELECT}
         ${BLOG_FROM}
         WHERE bp.id = ? AND bp.organizer_id = ? AND bp.deleted_at IS NULL
         LIMIT 1`,
        [postId, organizerId],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.json({ post: mapStaffRow(rows[0]) });
    },
  );

  app.post(
    "/api/organizer/blog-posts",
    requireOrganizer,
    requireBlogEditor,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context required" });
      }
      try {
        const post = await createBlogPost(
          pool,
          req,
          newPublicUuid,
          organizerId,
        );
        res.status(201).json({ post });
      } catch (err) {
        sendBlogError(res, err);
      }
    },
  );

  app.patch(
    "/api/organizer/blog-posts/:postId",
    requireOrganizer,
    requireBlogEditor,
    async (req: AuthedRequest, res) => {
      try {
        const post = await updateBlogPost(
          pool,
          Number(req.params.postId),
          req.body,
          req.auth!.organizerId ?? null,
        );
        res.json({ post });
      } catch (err) {
        sendBlogError(res, err);
      }
    },
  );

  app.delete(
    "/api/organizer/blog-posts/:postId",
    requireOrganizer,
    requireBlogEditor,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      const postId = Number(req.params.postId);
      await pool.query(
        `UPDATE blog_posts SET deleted_at = NOW()
         WHERE id = ? AND organizer_id = ? AND deleted_at IS NULL`,
        [postId, organizerId],
      );
      res.json({ ok: true });
    },
  );
}

function sendBlogError(res: Response, err: unknown) {
  const status =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status: number }).status)
      : 500;
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: string }).message)
      : "Unexpected error";
  res.status(status).json({ error: message });
}

type BlogBody = {
  title?: string;
  slug?: string;
  excerpt?: string;
  bodyHtml?: string;
  coverImageUrl?: string;
  status?: "draft" | "published" | "archived";
  featured?: boolean;
  scope?: "platform" | "organizer";
  organizerId?: number | null;
  eventId?: number | null;
  authorName?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImageUrl?: string;
  locale?: string;
  publishedAt?: string | null;
};

function parseBlogBody(body: unknown): BlogBody {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    title: b.title != null ? String(b.title).trim() : undefined,
    slug: b.slug != null ? normalizeBlogSlug(String(b.slug)) : undefined,
    excerpt: b.excerpt != null ? String(b.excerpt).trim() : undefined,
    bodyHtml:
      b.body_html != null
        ? String(b.body_html)
        : b.bodyHtml != null
          ? String(b.bodyHtml)
          : undefined,
    coverImageUrl:
      b.cover_image_url != null
        ? String(b.cover_image_url)
        : b.coverImageUrl != null
          ? String(b.coverImageUrl)
          : undefined,
    status: ["draft", "published", "archived"].includes(String(b.status))
      ? (String(b.status) as BlogBody["status"])
      : undefined,
    featured: b.featured === true || b.featured === 1 || b.featured === "1",
    scope:
      b.scope === "organizer"
        ? "organizer"
        : b.scope === "platform"
          ? "platform"
          : undefined,
    organizerId:
      b.organizer_id != null
        ? Number(b.organizer_id)
        : b.organizerId != null
          ? Number(b.organizerId)
          : undefined,
    eventId:
      b.event_id != null
        ? Number(b.event_id)
        : b.eventId != null
          ? Number(b.eventId)
          : undefined,
    authorName:
      b.author_name != null
        ? String(b.author_name)
        : b.authorName != null
          ? String(b.authorName)
          : undefined,
    seoTitle:
      b.seo_title != null
        ? String(b.seo_title)
        : b.seoTitle != null
          ? String(b.seoTitle)
          : undefined,
    seoDescription:
      b.seo_description != null
        ? String(b.seo_description)
        : b.seoDescription != null
          ? String(b.seoDescription)
          : undefined,
    ogImageUrl:
      b.og_image_url != null
        ? String(b.og_image_url)
        : b.ogImageUrl != null
          ? String(b.ogImageUrl)
          : undefined,
    locale: b.locale != null ? String(b.locale).slice(0, 5) : undefined,
    publishedAt:
      b.published_at != null
        ? String(b.published_at)
        : b.publishedAt != null
          ? String(b.publishedAt)
          : undefined,
  };
}

function resolvePublishedAt(
  status?: string,
  publishedAt?: string | null,
): string | null {
  if (status === "published") {
    if (publishedAt) {
      return new Date(publishedAt)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
    }
    return new Date().toISOString().slice(0, 19).replace("T", " ");
  }
  if (publishedAt) {
    return new Date(publishedAt).toISOString().slice(0, 19).replace("T", " ");
  }
  return null;
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

async function assertOrganizerExists(
  pool: Pool,
  organizerId: number,
): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM organizers WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [organizerId],
  );
  return rows.length > 0;
}

async function getEventOrganizerId(
  pool: Pool,
  eventId: number,
): Promise<number | null> {
  const [[row]] = await pool.query<RowDataPacket[]>(
    "SELECT organizer_id FROM events WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [eventId],
  );
  const id = row?.organizer_id;
  return id != null && Number.isFinite(Number(id)) ? Number(id) : null;
}

async function createBlogPost(
  pool: Pool,
  req: AuthedRequest,
  newPublicUuid: () => string,
  routeOrganizerId: number | null,
) {
  const payload = parseBlogBody(req.body);
  if (!payload.title) {
    throw Object.assign(new Error("title required"), { status: 400 });
  }

  const isAdminActor = req.auth!.actor === "admin";
  let resolvedOrganizerId: number | null = routeOrganizerId;

  if (isAdminActor) {
    if (payload.organizerId != null && Number.isFinite(payload.organizerId)) {
      const exists = await assertOrganizerExists(pool, payload.organizerId);
      if (!exists) {
        throw Object.assign(new Error("Organizer not found"), { status: 400 });
      }
      resolvedOrganizerId = payload.organizerId;
    } else if (payload.scope === "platform" || payload.organizerId === null) {
      resolvedOrganizerId = null;
    }
  }

  if (payload.eventId) {
    const eventOrganizerId = await getEventOrganizerId(pool, payload.eventId);
    if (!eventOrganizerId) {
      throw Object.assign(new Error("Event not found"), { status: 400 });
    }
    if (resolvedOrganizerId != null && eventOrganizerId !== resolvedOrganizerId) {
      throw Object.assign(new Error("Event not in selected organizer account"), {
        status: 403,
      });
    }
    if (resolvedOrganizerId == null && isAdminActor) {
      resolvedOrganizerId = eventOrganizerId;
    }
    if (!isAdminActor && routeOrganizerId) {
      const ok = await assertOrganizerOwnsEvent(
        pool,
        routeOrganizerId,
        payload.eventId,
      );
      if (!ok) {
        throw Object.assign(new Error("Event not in your organizer account"), {
          status: 403,
        });
      }
    }
  }

  const slug = await uniqueBlogSlug(
    pool,
    resolveBlogSlug(payload.title ?? "", payload.slug),
  );
  const readTime = computeReadMinutes(
    payload.bodyHtml ?? "",
    payload.title,
    payload.excerpt ?? "",
  );
  const publishedAt = resolvePublishedAt(payload.status, payload.publishedAt);

  let authorName = payload.authorName ?? "Triboo Sport";
  let authorAdminId: number | null = null;
  let authorMemberId: number | null = null;
  const scope =
    resolvedOrganizerId != null
      ? "organizer"
      : payload.scope === "organizer"
        ? "organizer"
        : "platform";

  if (isAdminActor) {
    authorAdminId = req.auth!.id;
    const [[admin]] = await pool.query<RowDataPacket[]>(
      "SELECT first_name, last_name FROM admins WHERE id = ? LIMIT 1",
      [req.auth!.id],
    );
    if (admin) {
      authorName = `${admin.first_name} ${admin.last_name}`.trim();
    }
  } else if (routeOrganizerId) {
    authorMemberId = req.auth!.id;
    const [[member]] = await pool.query<RowDataPacket[]>(
      "SELECT first_name, last_name FROM organizer_members WHERE id = ? LIMIT 1",
      [req.auth!.id],
    );
    if (member) {
      authorName = `${member.first_name} ${member.last_name}`.trim();
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO blog_posts (
      public_uuid, slug, title, excerpt, body_html, cover_image_url,
      status, featured, scope, organizer_id, event_id,
      author_admin_id, author_member_id, author_name,
      seo_title, seo_description, og_image_url,
      read_time_minutes, locale, published_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newPublicUuid(),
      slug,
      payload.title.slice(0, 300),
      payload.excerpt?.slice(0, 2000) ?? null,
      payload.bodyHtml ?? null,
      payload.coverImageUrl ?? null,
      payload.status ?? "draft",
      payload.featured ? 1 : 0,
      scope,
      resolvedOrganizerId,
      payload.eventId ?? null,
      authorAdminId,
      authorMemberId,
      authorName.slice(0, 200),
      payload.seoTitle?.slice(0, 300) ?? null,
      payload.seoDescription?.slice(0, 500) ?? null,
      payload.ogImageUrl ?? payload.coverImageUrl ?? null,
      readTime,
      payload.locale ?? "es",
      publishedAt,
    ],
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${BLOG_SELECT} ${BLOG_FROM} WHERE bp.id = ? LIMIT 1`,
    [result.insertId],
  );
  return mapStaffRow(rows[0]);
}

async function updateBlogPost(
  pool: Pool,
  postId: number,
  body: unknown,
  organizerId: number | null,
) {
  if (!Number.isFinite(postId)) {
    throw Object.assign(new Error("Invalid post id"), { status: 400 });
  }

  const [[existing]] = await pool.query<RowDataPacket[]>(
    `SELECT id, title, excerpt, body_html, slug, status, organizer_id
     FROM blog_posts
     WHERE id = ? AND deleted_at IS NULL
       ${organizerId != null ? "AND organizer_id = ?" : ""}
     LIMIT 1`,
    organizerId != null ? [postId, organizerId] : [postId],
  );
  if (!existing) {
    throw Object.assign(new Error("Post not found"), { status: 404 });
  }

  const payload = parseBlogBody(body);
  const fields: string[] = [];
  const params: unknown[] = [];

  const set = (col: string, val: unknown) => {
    fields.push(`${col} = ?`);
    params.push(val);
  };

  const isAdminUpdate = organizerId == null;
  let effectiveOrganizerId =
    existing.organizer_id != null ? Number(existing.organizer_id) : null;

  if (isAdminUpdate && payload.organizerId !== undefined) {
    if (payload.organizerId != null && Number.isFinite(payload.organizerId)) {
      const exists = await assertOrganizerExists(pool, payload.organizerId);
      if (!exists) {
        throw Object.assign(new Error("Organizer not found"), { status: 400 });
      }
      effectiveOrganizerId = payload.organizerId;
    } else {
      effectiveOrganizerId = null;
    }
    set("organizer_id", effectiveOrganizerId);
    set("scope", effectiveOrganizerId != null ? "organizer" : "platform");
  } else if (isAdminUpdate && payload.scope != null) {
    if (payload.scope === "platform") {
      effectiveOrganizerId = null;
      set("organizer_id", null);
    }
    set("scope", payload.scope);
  }

  if (payload.eventId !== undefined) {
    if (payload.eventId != null) {
      const eventOrganizerId = await getEventOrganizerId(pool, payload.eventId);
      if (!eventOrganizerId) {
        throw Object.assign(new Error("Event not found"), { status: 400 });
      }
      const checkOrgId = isAdminUpdate
        ? effectiveOrganizerId ?? eventOrganizerId
        : organizerId;
      if (checkOrgId != null && eventOrganizerId !== checkOrgId) {
        throw Object.assign(
          new Error("Event not in selected organizer account"),
          { status: 403 },
        );
      }
      if (isAdminUpdate && effectiveOrganizerId == null) {
        effectiveOrganizerId = eventOrganizerId;
        set("organizer_id", eventOrganizerId);
        set("scope", "organizer");
      }
    }
    set("event_id", payload.eventId);
  }

  if (payload.title != null) set("title", payload.title.slice(0, 300));
  if (payload.slug != null) {
    const normalized = normalizeBlogSlug(payload.slug);
    if (!normalized) {
      throw Object.assign(new Error("Invalid slug"), { status: 400 });
    }
    const slug = await uniqueBlogSlug(pool, normalized, postId);
    set("slug", slug);
  }
  if (payload.excerpt != null) set("excerpt", payload.excerpt.slice(0, 2000));
  if (payload.bodyHtml != null) set("body_html", payload.bodyHtml);
  if (payload.coverImageUrl != null) set("cover_image_url", payload.coverImageUrl);
  if (payload.status != null) {
    set("status", payload.status);
    if (payload.status === "published" && existing.status !== "published") {
      set(
        "published_at",
        resolvePublishedAt("published", payload.publishedAt),
      );
    }
  }
  if (payload.featured != null) set("featured", payload.featured ? 1 : 0);
  if (payload.authorName != null) {
    set("author_name", payload.authorName.slice(0, 200));
  }
  if (payload.seoTitle != null) set("seo_title", payload.seoTitle.slice(0, 300));
  if (payload.seoDescription != null) {
    set("seo_description", payload.seoDescription.slice(0, 500));
  }
  if (payload.ogImageUrl != null) set("og_image_url", payload.ogImageUrl);
  if (payload.locale != null) set("locale", payload.locale.slice(0, 5));
  if (payload.publishedAt !== undefined && payload.status !== "published") {
    set("published_at", resolvePublishedAt(undefined, payload.publishedAt));
  }

  const title = payload.title ?? (existing.title as string);
  const excerpt = payload.excerpt ?? (existing.excerpt as string) ?? "";
  const bodyHtml = payload.bodyHtml ?? (existing.body_html as string) ?? "";
  set("read_time_minutes", computeReadMinutes(bodyHtml, title, excerpt));

  if (fields.length === 0) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${BLOG_SELECT} ${BLOG_FROM} WHERE bp.id = ? LIMIT 1`,
      [postId],
    );
    return mapStaffRow(rows[0]);
  }

  params.push(postId);
  await pool.query(
    `UPDATE blog_posts SET ${fields.join(", ")} WHERE id = ?`,
    params,
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${BLOG_SELECT} ${BLOG_FROM} WHERE bp.id = ? LIMIT 1`,
    [postId],
  );
  return mapStaffRow(rows[0]);
}
