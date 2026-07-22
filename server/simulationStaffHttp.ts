import type { Express, Response } from "express";
import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  SIMULATION_MAX_ACTIVE_PER_ORG,
  SIMULATION_MAX_REGS_PER_EVENT,
  SIMULATION_TTL_DAYS,
} from "../shared/simulation.js";
import {
  bumpSimulationActivity,
  countActiveSimulations,
  countSimulationRegistrations,
  createSimulationEvent,
  loadSimulationEventForOrganizer,
  regenerateSimulationToken,
  wipeSimulationGeneratedData,
} from "./simulation.js";

type AuthedRequest = import("express").Request & {
  auth?: { actor: string; id: number; organizerId?: number };
};

async function getMemberRole(
  pool: Pool,
  memberId: number,
  organizerId: number,
): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT role FROM organizer_members
     WHERE id = ? AND organizer_id = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
    [memberId, organizerId],
  );
  return (rows[0]?.role as string) ?? null;
}

function appBaseUrl(): string {
  return (
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.VITE_PUBLIC_APP_URL?.trim() ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
}

function simPublicUrl(token: string): string {
  return `${appBaseUrl()}/events/sim/${token}`;
}

function mapSimRow(row: RowDataPacket, regCount?: number) {
  const token = row.simulation_access_token
    ? String(row.simulation_access_token)
    : null;
  return {
    id: Number(row.id),
    public_uuid: String(row.public_uuid),
    slug: String(row.slug),
    title: String(row.title),
    status: String(row.status),
    start_date: String(row.start_date),
    organizer_id: Number(row.organizer_id),
    organizer_name: row.organizer_name != null ? String(row.organizer_name) : undefined,
    sport_name: row.sport_name != null ? String(row.sport_name) : undefined,
    is_simulation: true,
    simulation_access_token: token,
    simulation_expires_at: row.simulation_expires_at,
    simulation_last_activity_at: row.simulation_last_activity_at,
    cloned_from_event_id:
      row.cloned_from_event_id != null ? Number(row.cloned_from_event_id) : null,
    access_url: token ? simPublicUrl(token) : null,
    registration_count: regCount ?? Number(row.registration_count ?? 0),
    ttl_days: SIMULATION_TTL_DAYS,
    max_regs: SIMULATION_MAX_REGS_PER_EVENT,
  };
}

/**
 * Owner-only organizer simulation CRUD + admin list/reset.
 * Does not change live event publish/marketplace paths.
 */
export function registerSimulationStaffRoutes(
  app: Express,
  deps: {
    pool: Pool;
    requireAdmin: import("express").RequestHandler;
    requireOrganizer: import("express").RequestHandler;
    newPublicUuid: () => string;
    getStripeTestClient: () => import("stripe").default | null;
  },
): void {
  const { pool, requireAdmin, requireOrganizer, newPublicUuid, getStripeTestClient } =
    deps;

  async function requireOwner(
    req: AuthedRequest,
    res: Response,
  ): Promise<boolean> {
    const organizerId = req.auth!.organizerId;
    if (!organizerId) {
      res.status(403).json({ error: "Organizer context missing" });
      return false;
    }
    const role = await getMemberRole(pool, req.auth!.id, organizerId);
    if (role !== "owner") {
      res.status(403).json({
        error: "Only the organization owner can manage simulations",
        code: "simulation_owner_only",
      });
      return false;
    }
    return true;
  }

  app.get(
    "/api/organizer/simulations",
    requireOrganizer,
    async (req: AuthedRequest, res: Response) => {
      if (!(await requireOwner(req, res))) return;
      const organizerId = req.auth!.organizerId!;
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT e.id, e.public_uuid, e.slug, e.title, e.status, e.start_date, e.organizer_id,
                e.simulation_access_token, e.simulation_expires_at, e.simulation_last_activity_at,
                e.cloned_from_event_id, st.name AS sport_name,
                (SELECT COUNT(*) FROM registrations r
                 WHERE r.event_id = e.id AND r.is_simulation = 1 AND r.deleted_at IS NULL
                   AND r.status IN ('confirmed','pending_payment')) AS registration_count
         FROM events e
         JOIN sport_types st ON st.id = e.sport_type_id
         WHERE e.organizer_id = ? AND e.is_simulation = 1 AND e.deleted_at IS NULL
         ORDER BY e.simulation_last_activity_at DESC, e.id DESC`,
        [organizerId],
      );
      const active = await countActiveSimulations(pool, organizerId);
      res.json({
        simulations: rows.map((r) => mapSimRow(r)),
        quota: {
          active,
          max_active: SIMULATION_MAX_ACTIVE_PER_ORG,
          max_regs_per_event: SIMULATION_MAX_REGS_PER_EVENT,
          ttl_days: SIMULATION_TTL_DAYS,
        },
      });
    },
  );

  app.post(
    "/api/organizer/simulations",
    requireOrganizer,
    async (req: AuthedRequest, res: Response) => {
      if (!(await requireOwner(req, res))) return;
      const organizerId = req.auth!.organizerId!;
      const title = String(req.body?.title ?? "").trim();
      const sportTypeId = Number(req.body?.sportTypeId ?? req.body?.sport_type_id);
      const startDate = String(req.body?.startDate ?? req.body?.start_date ?? "").trim();
      const cloneFromEventIdRaw =
        req.body?.cloneFromEventId ?? req.body?.clone_from_event_id;
      const cloneFromEventId =
        cloneFromEventIdRaw != null && String(cloneFromEventIdRaw).trim() !== ""
          ? Number(cloneFromEventIdRaw)
          : null;

      if (!title || !Number.isFinite(sportTypeId) || sportTypeId <= 0 || !startDate) {
        if (!cloneFromEventId) {
          return res.status(400).json({
            error: "title, sportTypeId, and startDate are required (or cloneFromEventId)",
          });
        }
      }

      let resolvedTitle = title;
      let resolvedSport = sportTypeId;
      let resolvedStart = startDate;
      if (cloneFromEventId && (!title || !startDate || !Number.isFinite(sportTypeId))) {
        const [src] = await pool.query<RowDataPacket[]>(
          `SELECT title, sport_type_id, start_date FROM events
           WHERE id = ? AND organizer_id = ? AND deleted_at IS NULL LIMIT 1`,
          [cloneFromEventId, organizerId],
        );
        if (src.length === 0) {
          return res.status(404).json({ error: "Source event not found" });
        }
        resolvedTitle = title || `${String(src[0].title)} (SIM)`;
        resolvedSport = Number.isFinite(sportTypeId) && sportTypeId > 0
          ? sportTypeId
          : Number(src[0].sport_type_id);
        resolvedStart = startDate || String(src[0].start_date);
      }

      const result = await createSimulationEvent(pool, {
        organizerId,
        title: resolvedTitle,
        sportTypeId: resolvedSport,
        startDate: resolvedStart,
        cloneFromEventId,
        newPublicUuid,
      });
      if (result.ok === false) {
        return res.status(result.status).json({
          error: result.error,
          code: result.code,
        });
      }

      const event = await loadSimulationEventForOrganizer(
        pool,
        result.eventId,
        organizerId,
      );
      res.status(201).json({
        simulation: event ? mapSimRow(event) : null,
        access_url: simPublicUrl(result.token),
        token: result.token,
        slug: result.slug,
      });
    },
  );

  app.post(
    "/api/organizer/simulations/:eventId/reset",
    requireOrganizer,
    async (req: AuthedRequest, res: Response) => {
      if (!(await requireOwner(req, res))) return;
      const organizerId = req.auth!.organizerId!;
      const eventId = Number(req.params.eventId);
      const event = await loadSimulationEventForOrganizer(pool, eventId, organizerId);
      if (!event) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      const stripe = getStripeTestClient();
      const wiped = await wipeSimulationGeneratedData(pool, eventId, {
        stripeCancel: stripe
          ? async (piId) => {
              const pi = await stripe.paymentIntents.retrieve(piId);
              if (
                pi.status === "requires_payment_method" ||
                pi.status === "requires_confirmation" ||
                pi.status === "requires_action"
              ) {
                await stripe.paymentIntents.cancel(piId);
              }
            }
          : undefined,
      });
      await bumpSimulationActivity(pool, eventId);
      res.json({ ok: true, wiped });
    },
  );

  app.post(
    "/api/organizer/simulations/:eventId/regenerate-link",
    requireOrganizer,
    async (req: AuthedRequest, res: Response) => {
      if (!(await requireOwner(req, res))) return;
      const organizerId = req.auth!.organizerId!;
      const eventId = Number(req.params.eventId);
      const event = await loadSimulationEventForOrganizer(pool, eventId, organizerId);
      if (!event) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      const token = await regenerateSimulationToken(pool, eventId);
      res.json({
        ok: true,
        token,
        access_url: simPublicUrl(token),
      });
    },
  );

  app.get(
    "/api/organizer/simulations/:eventId",
    requireOrganizer,
    async (req: AuthedRequest, res: Response) => {
      if (!(await requireOwner(req, res))) return;
      const organizerId = req.auth!.organizerId!;
      const eventId = Number(req.params.eventId);
      const event = await loadSimulationEventForOrganizer(pool, eventId, organizerId);
      if (!event) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      const regCount = await countSimulationRegistrations(pool, eventId);
      res.json({ simulation: mapSimRow(event, regCount) });
    },
  );

  app.get(
    "/api/admin/simulations",
    requireAdmin,
    async (_req, res: Response) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT e.id, e.public_uuid, e.slug, e.title, e.status, e.start_date, e.organizer_id,
                e.simulation_access_token, e.simulation_expires_at, e.simulation_last_activity_at,
                e.cloned_from_event_id, st.name AS sport_name, o.name AS organizer_name,
                (SELECT COUNT(*) FROM registrations r
                 WHERE r.event_id = e.id AND r.is_simulation = 1 AND r.deleted_at IS NULL
                   AND r.status IN ('confirmed','pending_payment')) AS registration_count
         FROM events e
         JOIN sport_types st ON st.id = e.sport_type_id
         JOIN organizers o ON o.id = e.organizer_id
         WHERE e.is_simulation = 1 AND e.deleted_at IS NULL
         ORDER BY e.simulation_expires_at ASC, e.id DESC
         LIMIT 200`,
      );
      res.json({
        simulations: rows.map((r) => mapSimRow(r)),
        quota: {
          max_active: SIMULATION_MAX_ACTIVE_PER_ORG,
          max_regs_per_event: SIMULATION_MAX_REGS_PER_EVENT,
          ttl_days: SIMULATION_TTL_DAYS,
        },
      });
    },
  );

  app.post(
    "/api/admin/simulations/:eventId/reset",
    requireAdmin,
    async (req, res: Response) => {
      const eventId = Number(req.params.eventId);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM events WHERE id = ? AND is_simulation = 1 AND deleted_at IS NULL LIMIT 1`,
        [eventId],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      const stripe = getStripeTestClient();
      const wiped = await wipeSimulationGeneratedData(pool, eventId, {
        stripeCancel: stripe
          ? async (piId) => {
              const pi = await stripe.paymentIntents.retrieve(piId);
              if (
                pi.status === "requires_payment_method" ||
                pi.status === "requires_confirmation" ||
                pi.status === "requires_action"
              ) {
                await stripe.paymentIntents.cancel(piId);
              }
            }
          : undefined,
      });
      await bumpSimulationActivity(pool, eventId);
      res.json({ ok: true, wiped });
    },
  );
}
