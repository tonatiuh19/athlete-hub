import type { Express, RequestHandler } from "express";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type Stripe from "stripe";
import {
  buildStripePayoutChecklist,
  buildTribooPayoutChecklist,
  deriveStripeConnectStatusFromCapabilities,
  isOrganizerPayoutReady,
  isTribooPayoutProfileComplete,
  type OrganizerConnectState,
  type StripeConnectOnboardingMode,
  type StripeConnectStatus,
} from "../shared/stripeConnect.js";
import type { AuthedRequest } from "./staffPortal.js";

const ORGANIZER_CONNECT_SELECT = `
  o.id AS organizer_id,
  o.email,
  o.legal_name,
  o.billing_email,
  o.rfc,
  o.tax_regime,
  o.service_fee_percent,
  o.status,
  o.stripe_account_id,
  o.stripe_onboarding_complete,
  o.stripe_connect_status,
  o.stripe_charges_enabled,
  o.stripe_payouts_enabled,
  o.stripe_details_submitted,
  DATE_FORMAT(o.stripe_connect_onboarded_at, '%Y-%m-%d %H:%i:%s') AS stripe_connect_onboarded_at,
  DATE_FORMAT(o.stripe_connect_last_synced_at, '%Y-%m-%d %H:%i:%s') AS stripe_connect_last_synced_at,
  o.stripe_connect_onboarding_mode,
  DATE_FORMAT(o.payout_terms_accepted_at, '%Y-%m-%d %H:%i:%s') AS payout_terms_accepted_at,
  DATE_FORMAT(o.payout_fee_acknowledged_at, '%Y-%m-%d %H:%i:%s') AS payout_fee_acknowledged_at
`;

export interface StripeConnectDeps {
  pool: Pool;
  requireAdmin: RequestHandler;
  requireOrganizer: RequestHandler;
  getStripeClient: () => Stripe | null;
  appUrl: string;
  getOrganizerMemberRole: (
    pool: Pool,
    memberId: number,
    organizerId: number,
  ) => Promise<string | null>;
}

type OrganizerConnectRow = RowDataPacket & {
  organizer_id: number;
  email: string;
  legal_name: string | null;
  billing_email: string | null;
  rfc: string | null;
  tax_regime: string | null;
  service_fee_percent: number | string;
  status: string;
  stripe_account_id: string | null;
  stripe_onboarding_complete: number;
  stripe_connect_status: StripeConnectStatus;
  stripe_charges_enabled: number;
  stripe_payouts_enabled: number;
  stripe_details_submitted: number;
  stripe_connect_onboarded_at: string | null;
  stripe_connect_last_synced_at: string | null;
  stripe_connect_onboarding_mode: StripeConnectOnboardingMode | null;
  payout_terms_accepted_at: string | null;
  payout_fee_acknowledged_at: string | null;
};

export async function loadOrganizerConnectRow(
  pool: Pool,
  organizerId: number,
): Promise<OrganizerConnectRow | null> {
  const [rows] = await pool.query<OrganizerConnectRow[]>(
    `SELECT ${ORGANIZER_CONNECT_SELECT}
     FROM organizers o
     WHERE o.id = ? AND o.deleted_at IS NULL
     LIMIT 1`,
    [organizerId],
  );
  return rows[0] ?? null;
}

function rowToConnectState(
  row: OrganizerConnectRow,
  requirements?: {
    currently_due: string[];
    eventually_due: string[];
    disabled_reason: string | null;
  },
): OrganizerConnectState {
  const tribooComplete = isTribooPayoutProfileComplete(row);
  return {
    organizer_id: Number(row.organizer_id),
    email: String(row.email),
    legal_name: row.legal_name,
    billing_email: row.billing_email,
    rfc: row.rfc,
    tax_regime: row.tax_regime,
    service_fee_percent: Number(row.service_fee_percent ?? 11),
    stripe_account_id: row.stripe_account_id,
    stripe_onboarding_complete: Boolean(row.stripe_onboarding_complete),
    stripe_connect_status: row.stripe_connect_status ?? "not_started",
    stripe_charges_enabled: Boolean(row.stripe_charges_enabled),
    stripe_payouts_enabled: Boolean(row.stripe_payouts_enabled),
    stripe_details_submitted: Boolean(row.stripe_details_submitted),
    stripe_connect_onboarded_at: row.stripe_connect_onboarded_at,
    stripe_connect_last_synced_at: row.stripe_connect_last_synced_at,
    stripe_connect_onboarding_mode: row.stripe_connect_onboarding_mode,
    payout_terms_accepted_at: row.payout_terms_accepted_at,
    payout_fee_acknowledged_at: row.payout_fee_acknowledged_at,
    requirements_currently_due: requirements?.currently_due ?? [],
    requirements_eventually_due: requirements?.eventually_due ?? [],
    requirements_disabled_reason: requirements?.disabled_reason ?? null,
  };
}

export function buildConnectStatusPayload(
  row: OrganizerConnectRow,
  requirements?: {
    currently_due: string[];
    eventually_due: string[];
    disabled_reason: string | null;
  },
) {
  const state = rowToConnectState(row, requirements);
  const tribooChecklist = buildTribooPayoutChecklist(state);
  const stripeChecklist = buildStripePayoutChecklist({
    stripe_account_id: state.stripe_account_id,
    stripe_details_submitted: state.stripe_details_submitted,
    stripe_charges_enabled: state.stripe_charges_enabled,
    stripe_payouts_enabled: state.stripe_payouts_enabled,
    requirements_currently_due: state.requirements_currently_due,
    requirements_eventually_due: state.requirements_eventually_due,
  });
  const ready = isOrganizerPayoutReady({
    stripe_connect_status: state.stripe_connect_status,
    stripe_account_id: state.stripe_account_id,
    stripe_charges_enabled: state.stripe_charges_enabled,
    stripe_payouts_enabled: state.stripe_payouts_enabled,
    requirements_currently_due: state.requirements_currently_due,
    triboo_profile_complete: tribooChecklist.complete,
  });

  return {
    organizer: state,
    tribooChecklist,
    stripeChecklist,
    payoutReady: ready,
    serviceFeePercent: state.service_fee_percent,
  };
}

export async function persistOrganizerConnectFromStripeAccount(
  pool: Pool,
  organizerId: number,
  account: Stripe.Account,
  onboardingMode?: StripeConnectOnboardingMode | null,
): Promise<void> {
  const [[existing]] = await pool.query<RowDataPacket[]>(
    "SELECT stripe_connect_status FROM organizers WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [organizerId],
  );
  if (existing?.stripe_connect_status === "disabled") {
    await pool.query<ResultSetHeader>(
      `UPDATE organizers SET stripe_connect_last_synced_at = NOW() WHERE id = ?`,
      [organizerId],
    );
    return;
  }

  const currentlyDue = account.requirements?.currently_due ?? [];
  const disabledReason = account.requirements?.disabled_reason ?? null;
  const status = deriveStripeConnectStatusFromCapabilities({
    disabled: false,
    charges_enabled: Boolean(account.charges_enabled),
    payouts_enabled: Boolean(account.payouts_enabled),
    details_submitted: Boolean(account.details_submitted),
    currently_due: currentlyDue,
    disabled_reason: disabledReason,
    has_account: true,
  });
  const ready = status === "ready";

  await pool.query<ResultSetHeader>(
    `UPDATE organizers SET
       stripe_account_id = ?,
       stripe_onboarding_complete = ?,
       stripe_connect_status = ?,
       stripe_charges_enabled = ?,
       stripe_payouts_enabled = ?,
       stripe_details_submitted = ?,
       stripe_connect_onboarded_at = CASE
         WHEN ? = 1 AND stripe_connect_onboarded_at IS NULL THEN NOW()
         ELSE stripe_connect_onboarded_at
       END,
       stripe_connect_last_synced_at = NOW(),
       stripe_connect_onboarding_mode = COALESCE(?, stripe_connect_onboarding_mode)
     WHERE id = ?`,
    [
      account.id,
      ready ? 1 : 0,
      status,
      account.charges_enabled ? 1 : 0,
      account.payouts_enabled ? 1 : 0,
      account.details_submitted ? 1 : 0,
      ready ? 1 : 0,
      onboardingMode ?? null,
      organizerId,
    ],
  );
}

export async function syncOrganizerConnectFromStripe(
  pool: Pool,
  organizerId: number,
  stripe: Stripe,
): Promise<OrganizerConnectRow | null> {
  const row = await loadOrganizerConnectRow(pool, organizerId);
  if (!row?.stripe_account_id) return row;
  const account = await stripe.accounts.retrieve(row.stripe_account_id);
  await persistOrganizerConnectFromStripeAccount(pool, organizerId, account);
  return loadOrganizerConnectRow(pool, organizerId);
}

async function ensureStripeConnectAccount(
  pool: Pool,
  stripe: Stripe,
  row: OrganizerConnectRow,
  mode: StripeConnectOnboardingMode,
): Promise<string> {
  if (row.stripe_account_id) return row.stripe_account_id;

  const legalName = row.legal_name?.trim();
  const billingEmail = row.billing_email?.trim().toLowerCase();
  const rfc = row.rfc?.trim().toUpperCase();

  const account = await stripe.accounts.create({
    type: "express",
    country: "MX",
    email: billingEmail || row.email,
    ...(legalName ? { business_profile: { name: legalName } } : {}),
    ...(rfc ? { company: { tax_id: rfc } } : {}),
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      organizer_id: String(row.organizer_id),
      triboo_platform: "athlete-hub",
    },
  });

  await pool.query<ResultSetHeader>(
    `UPDATE organizers SET
       stripe_account_id = ?,
       stripe_connect_status = 'pending',
       stripe_connect_onboarding_mode = ?,
       stripe_connect_last_synced_at = NOW()
     WHERE id = ?`,
    [account.id, mode, row.organizer_id],
  );

  return account.id;
}

async function createAccountManagementLink(
  stripe: Stripe,
  account: Stripe.Account,
  accountId: string,
  appUrl: string,
): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: account.details_submitted ? "account_update" : "account_onboarding",
    return_url: `${appUrl}/staff/payouts?connect=return`,
    refresh_url: `${appUrl}/staff/payouts?connect=refresh`,
  });
  return link.url;
}

async function createExpressDashboardLoginLink(
  stripe: Stripe,
  accountId: string,
): Promise<string> {
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

export async function eventHasPaidActiveCategories(
  pool: Pool,
  eventId: number,
): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM event_categories
     WHERE event_id = ? AND is_active = 1 AND price_cents > 0
     LIMIT 1`,
    [eventId],
  );
  return rows.length > 0;
}

export type PaidCategoryMutationError = {
  status: number;
  error: string;
  code?: string;
};

/** Blocks paid category create/update on published events when organizer payout is not ready. */
export async function assertPaidCategoryMutationAllowed(
  pool: Pool,
  eventId: number,
  priceCents: number,
  stripe?: Stripe | null,
): Promise<PaidCategoryMutationError | null> {
  if (priceCents <= 0) return null;

  const [[event]] = await pool.query<RowDataPacket[]>(
    `SELECT status, organizer_id FROM events WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [eventId],
  );
  if (!event || event.status !== "published") return null;

  const payoutCheck = await assertOrganizerPayoutReadyForPaidEvent(
    pool,
    Number(event.organizer_id),
    stripe ?? null,
  );
  if (payoutCheck.ok === false) {
    return {
      status: 403,
      error:
        "Complete payout setup before adding or updating paid categories on a published event.",
      code: payoutCheck.code,
    };
  }
  return null;
}

export async function attachEventPaymentAvailability(
  pool: Pool,
  event: { id: number; status: string; organizer_id: number },
  stripe?: Stripe | null,
): Promise<{ has_paid_categories: boolean; payments_available: boolean }> {
  const has_paid_categories = await eventHasPaidActiveCategories(pool, event.id);
  if (event.status !== "published" || !has_paid_categories) {
    return { has_paid_categories, payments_available: true };
  }
  const payoutCheck = await assertOrganizerPayoutReadyForPaidEvent(
    pool,
    event.organizer_id,
    stripe ?? null,
  );
  return { has_paid_categories, payments_available: payoutCheck.ok };
}

export async function enrichStaffEventsWithPaymentAvailability<
  T extends { id: number; status: string; organizer_id?: number | null },
>(
  pool: Pool,
  events: T[],
  stripe?: Stripe | null,
): Promise<(T & { has_paid_categories: boolean; payments_available: boolean })[]> {
  if (events.length === 0) return [];

  const ids = events.map((e) => e.id);
  const placeholders = ids.map(() => "?").join(", ");
  const [paidRows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT event_id FROM event_categories
     WHERE event_id IN (${placeholders}) AND is_active = 1 AND price_cents > 0`,
    ids,
  );
  const paidSet = new Set(paidRows.map((r) => Number(r.event_id)));
  const organizerReadyCache = new Map<number, boolean>();

  return Promise.all(
    events.map(async (event) => {
      const has_paid_categories = paidSet.has(event.id);
      let payments_available = true;
      if (
        event.status === "published" &&
        has_paid_categories &&
        event.organizer_id != null
      ) {
        const organizerId = Number(event.organizer_id);
        if (!organizerReadyCache.has(organizerId)) {
          const check = await assertOrganizerPayoutReadyForPaidEvent(
            pool,
            organizerId,
            stripe ?? null,
          );
          organizerReadyCache.set(organizerId, check.ok);
        }
        payments_available = organizerReadyCache.get(organizerId) ?? false;
      }
      return { ...event, has_paid_categories, payments_available };
    }),
  );
}

export async function assertOrganizerPayoutReadyForPaidEvent(
  pool: Pool,
  organizerId: number,
  stripe?: Stripe | null,
): Promise<
  | { ok: true; stripeAccountId: string }
  | { ok: false; code: string; message: string }
> {
  let row = await loadOrganizerConnectRow(pool, organizerId);
  if (!row) {
    return {
      ok: false,
      code: "organizer_not_found",
      message: "Organizer not found",
    };
  }

  if (row.status === "suspended" || row.status === "inactive") {
    return {
      ok: false,
      code: "organizer_suspended",
      message: "Organizer account is not active",
    };
  }
  if (row.stripe_connect_status === "disabled") {
    return {
      ok: false,
      code: "organizer_payouts_disabled",
      message: "Organizer payouts are disabled",
    };
  }

  if (stripe && row.stripe_account_id) {
    row = (await syncOrganizerConnectFromStripe(pool, organizerId, stripe)) ?? row;
  }

  const payload = buildConnectStatusPayload(row);
  if (!payload.payoutReady) {
    return {
      ok: false,
      code: "organizer_payouts_not_ready",
      message: "Organizer payout setup is not complete",
    };
  }
  if (!row.stripe_account_id) {
    return {
      ok: false,
      code: "organizer_payouts_not_ready",
      message: "Organizer Stripe account is missing",
    };
  }
  return { ok: true, stripeAccountId: row.stripe_account_id };
}

export type CheckoutConnectResolution =
  | { mode: "destination"; stripeAccountId: string }
  | { mode: "blocked"; code: string; message: string };

/** Destination Connect charges only when the organizer payout profile is ready. */
export async function resolveCheckoutConnectMode(
  pool: Pool,
  organizerId: number,
  stripe?: Stripe | null,
): Promise<CheckoutConnectResolution> {
  const check = await assertOrganizerPayoutReadyForPaidEvent(pool, organizerId, stripe);
  if (check.ok === true) {
    return { mode: "destination", stripeAccountId: check.stripeAccountId };
  }
  return { mode: "blocked", code: check.code, message: check.message };
}

export function applyConnectToPaymentIntent(
  params: Stripe.PaymentIntentCreateParams,
  opts: { destinationAccountId: string; applicationFeeCents: number },
): Stripe.PaymentIntentCreateParams {
  return {
    ...params,
    transfer_data: { destination: opts.destinationAccountId },
    ...(opts.applicationFeeCents > 0
      ? { application_fee_amount: opts.applicationFeeCents }
      : {}),
  };
}

export async function handleStripeAccountUpdatedWebhook(
  pool: Pool,
  account: Stripe.Account,
): Promise<void> {
  const organizerIdRaw = account.metadata?.organizer_id;
  let organizerId = organizerIdRaw ? Number(organizerIdRaw) : NaN;

  if (!Number.isFinite(organizerId)) {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM organizers WHERE stripe_account_id = ? AND deleted_at IS NULL LIMIT 1",
      [account.id],
    );
    if (rows.length === 0) return;
    organizerId = Number(rows[0].id);
  }

  await persistOrganizerConnectFromStripeAccount(pool, organizerId, account);
}

export async function handleStripeConnectDeauthorized(
  pool: Pool,
  accountId: string,
): Promise<void> {
  await pool.query<ResultSetHeader>(
    `UPDATE organizers SET
       stripe_connect_status = 'restricted',
       stripe_charges_enabled = 0,
       stripe_payouts_enabled = 0,
       stripe_onboarding_complete = 0,
       stripe_connect_last_synced_at = NOW()
     WHERE stripe_account_id = ? AND deleted_at IS NULL`,
    [accountId],
  );
}

function assertPayoutRole(role: string | null): boolean {
  return Boolean(role && ["owner", "finance", "organizer"].includes(role));
}

export function registerStripeConnectRoutes(app: Express, deps: StripeConnectDeps): void {
  const { pool, requireAdmin, requireOrganizer, getStripeClient, appUrl, getOrganizerMemberRole } =
    deps;

  async function buildStatusResponse(organizerId: number) {
    let row = await loadOrganizerConnectRow(pool, organizerId);
    if (!row) return null;

    const stripe = getStripeClient();
    let requirements:
      | { currently_due: string[]; eventually_due: string[]; disabled_reason: string | null }
      | undefined;
    if (stripe && row.stripe_account_id) {
      row = (await syncOrganizerConnectFromStripe(pool, organizerId, stripe)) ?? row;
      const account = await stripe.accounts.retrieve(row.stripe_account_id!);
      requirements = {
        currently_due: account.requirements?.currently_due ?? [],
        eventually_due: account.requirements?.eventually_due ?? [],
        disabled_reason: account.requirements?.disabled_reason ?? null,
      };
    }

    return buildConnectStatusPayload(row, requirements);
  }

  app.get("/api/organizer/payouts/status", requireOrganizer, async (req: AuthedRequest, res) => {
    const organizerId = req.auth!.organizerId;
    if (!organizerId) {
      return res.status(403).json({ error: "Organizer context missing" });
    }
    const memberRole = await getOrganizerMemberRole(pool, req.auth!.id, organizerId);
    if (!assertPayoutRole(memberRole)) {
      return res.status(403).json({ error: "Insufficient permissions for payouts" });
    }

    const payload = await buildStatusResponse(organizerId);
    if (!payload) return res.status(404).json({ error: "Organizer not found" });
    res.json(payload);
  });

  app.patch("/api/organizer/payouts/profile", requireOrganizer, async (req: AuthedRequest, res) => {
    const organizerId = req.auth!.organizerId;
    if (!organizerId) {
      return res.status(403).json({ error: "Organizer context missing" });
    }
    const memberRole = await getOrganizerMemberRole(pool, req.auth!.id, organizerId);
    if (!assertPayoutRole(memberRole)) {
      return res.status(403).json({ error: "Insufficient permissions for payouts" });
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (req.body?.legal_name != null) {
      updates.push("legal_name = ?");
      params.push(String(req.body.legal_name).trim().slice(0, 255) || null);
    }
    if (req.body?.billing_email != null) {
      const billingEmail = String(req.body.billing_email).trim().toLowerCase().slice(0, 255);
      if (billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) {
        return res.status(400).json({ error: "Invalid billing_email" });
      }
      updates.push("billing_email = ?");
      params.push(billingEmail || null);
    }
    if (req.body?.rfc != null) {
      const rfc = String(req.body.rfc).trim().slice(0, 13).toUpperCase();
      if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
        return res.status(400).json({ error: "Invalid RFC format" });
      }
      updates.push("rfc = ?");
      params.push(rfc || null);
    }
    if (req.body?.tax_regime != null) {
      updates.push("tax_regime = ?");
      params.push(String(req.body.tax_regime).trim().slice(0, 10) || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(organizerId);
    await pool.query<ResultSetHeader>(
      `UPDATE organizers SET ${updates.join(", ")} WHERE id = ?`,
      params,
    );

    const payload = await buildStatusResponse(organizerId);
    res.json(payload);
  });

  app.post(
    "/api/organizer/payouts/accept-terms",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      const organizerId = req.auth!.organizerId;
      if (!organizerId) {
        return res.status(403).json({ error: "Organizer context missing" });
      }
      const memberRole = await getOrganizerMemberRole(pool, req.auth!.id, organizerId);
      if (!memberRole || !["owner", "finance"].includes(memberRole)) {
        return res.status(403).json({ error: "Only owner or finance can accept payout terms" });
      }

      await pool.query<ResultSetHeader>(
        `UPDATE organizers SET
           payout_terms_accepted_at = COALESCE(payout_terms_accepted_at, NOW()),
           payout_fee_acknowledged_at = COALESCE(payout_fee_acknowledged_at, NOW())
         WHERE id = ?`,
        [organizerId],
      );

      const payload = await buildStatusResponse(organizerId);
      res.json(payload);
    },
  );

  app.post("/api/organizer/payouts/onboard", requireOrganizer, async (req: AuthedRequest, res) => {
    const organizerId = req.auth!.organizerId;
    if (!organizerId) {
      return res.status(403).json({ error: "Organizer context missing" });
    }
    const memberRole = await getOrganizerMemberRole(pool, req.auth!.id, organizerId);
    if (!assertPayoutRole(memberRole)) {
      return res.status(403).json({ error: "Insufficient permissions for payouts" });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ error: "Payment service unavailable" });
    }

    const row = await loadOrganizerConnectRow(pool, organizerId);
    if (!row) return res.status(404).json({ error: "Organizer not found" });

    const tribooChecklist = buildTribooPayoutChecklist(row);
    if (!tribooChecklist.complete) {
      return res.status(400).json({
        error: "Complete your Triboo payout profile before starting Stripe onboarding",
        code: "triboo_profile_incomplete",
      });
    }

    const accountId = await ensureStripeConnectAccount(pool, stripe, row, "self");
    const account = await stripe.accounts.retrieve(accountId);
    const url = await createAccountManagementLink(stripe, account, accountId, appUrl);
    const payload = await buildStatusResponse(organizerId);
    res.json({ url, ...payload });
  });

  app.post("/api/organizer/payouts/login", requireOrganizer, async (req: AuthedRequest, res) => {
    const organizerId = req.auth!.organizerId;
    if (!organizerId) {
      return res.status(403).json({ error: "Organizer context missing" });
    }
    const memberRole = await getOrganizerMemberRole(pool, req.auth!.id, organizerId);
    if (!assertPayoutRole(memberRole)) {
      return res.status(403).json({ error: "Insufficient permissions for payouts" });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ error: "Payment service unavailable" });
    }

    const row = await loadOrganizerConnectRow(pool, organizerId);
    if (!row?.stripe_account_id) {
      return res.status(400).json({ error: "No payout account linked" });
    }

    const url = await createExpressDashboardLoginLink(stripe, row.stripe_account_id);
    res.json({ url });
  });

  app.post("/api/organizer/payouts/sync", requireOrganizer, async (req: AuthedRequest, res) => {
    const organizerId = req.auth!.organizerId;
    if (!organizerId) {
      return res.status(403).json({ error: "Organizer context missing" });
    }
    const memberRole = await getOrganizerMemberRole(pool, req.auth!.id, organizerId);
    if (!assertPayoutRole(memberRole)) {
      return res.status(403).json({ error: "Insufficient permissions for payouts" });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ error: "Payment service unavailable" });
    }

    const row = await loadOrganizerConnectRow(pool, organizerId);
    if (!row?.stripe_account_id) {
      return res.status(400).json({ error: "No Stripe Connect account linked" });
    }

    await syncOrganizerConnectFromStripe(pool, organizerId, stripe);
    const payload = await buildStatusResponse(organizerId);
    res.json(payload);
  });

  app.get(
    "/api/admin/organizers/:organizerId/connect",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const organizerId = Number(req.params.organizerId);
      if (!Number.isFinite(organizerId)) {
        return res.status(400).json({ error: "Invalid organizer id" });
      }
      const payload = await buildStatusResponse(organizerId);
      if (!payload) return res.status(404).json({ error: "Organizer not found" });
      res.json(payload);
    },
  );

  app.post(
    "/api/admin/organizers/:organizerId/connect/onboard",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const organizerId = Number(req.params.organizerId);
      if (!Number.isFinite(organizerId)) {
        return res.status(400).json({ error: "Invalid organizer id" });
      }

      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: "Payment service unavailable" });
      }

      const row = await loadOrganizerConnectRow(pool, organizerId);
      if (!row) return res.status(404).json({ error: "Organizer not found" });

      const accountId = await ensureStripeConnectAccount(pool, stripe, row, "admin");
      const account = await stripe.accounts.retrieve(accountId);
      const url = await createAccountManagementLink(stripe, account, accountId, appUrl);
      const payload = await buildStatusResponse(organizerId);
      res.json({ url, ...payload });
    },
  );

  app.post(
    "/api/admin/organizers/:organizerId/connect/sync",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const organizerId = Number(req.params.organizerId);
      if (!Number.isFinite(organizerId)) {
        return res.status(400).json({ error: "Invalid organizer id" });
      }

      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: "Payment service unavailable" });
      }

      const row = await loadOrganizerConnectRow(pool, organizerId);
      if (!row?.stripe_account_id) {
        return res.status(400).json({ error: "No Stripe Connect account linked" });
      }

      await syncOrganizerConnectFromStripe(pool, organizerId, stripe);
      const payload = await buildStatusResponse(organizerId);
      res.json(payload);
    },
  );

  app.post(
    "/api/admin/organizers/:organizerId/connect/link-account",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const organizerId = Number(req.params.organizerId);
      const accountId = String(req.body?.stripe_account_id ?? "").trim();
      if (!Number.isFinite(organizerId) || !accountId.startsWith("acct_")) {
        return res.status(400).json({ error: "organizerId and stripe_account_id (acct_…) required" });
      }

      const stripe = getStripeClient();
      if (!stripe) {
        return res.status(503).json({ error: "Payment service unavailable" });
      }

      const account = await stripe.accounts.retrieve(accountId);

      const [linked] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM organizers WHERE stripe_account_id = ? AND id != ? AND deleted_at IS NULL LIMIT 1",
        [accountId, organizerId],
      );
      if (linked.length > 0) {
        return res.status(409).json({ error: "Stripe account already linked to another organizer" });
      }

      await persistOrganizerConnectFromStripeAccount(pool, organizerId, account, "admin");
      const payload = await buildStatusResponse(organizerId);
      res.json(payload);
    },
  );

  app.post(
    "/api/admin/organizers/:organizerId/connect/disable",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const organizerId = Number(req.params.organizerId);
      if (!Number.isFinite(organizerId)) {
        return res.status(400).json({ error: "Invalid organizer id" });
      }

      await pool.query<ResultSetHeader>(
        `UPDATE organizers SET
           stripe_connect_status = 'disabled',
           stripe_onboarding_complete = 0
         WHERE id = ?`,
        [organizerId],
      );

      const payload = await buildStatusResponse(organizerId);
      res.json(payload);
    },
  );

  app.post(
    "/api/admin/organizers/:organizerId/connect/enable",
    requireAdmin,
    async (req: AuthedRequest, res) => {
      const organizerId = Number(req.params.organizerId);
      if (!Number.isFinite(organizerId)) {
        return res.status(400).json({ error: "Invalid organizer id" });
      }

      const stripe = getStripeClient();
      const row = await loadOrganizerConnectRow(pool, organizerId);
      if (!row) return res.status(404).json({ error: "Organizer not found" });

      if (stripe && row.stripe_account_id) {
        await syncOrganizerConnectFromStripe(pool, organizerId, stripe);
      } else {
        await pool.query<ResultSetHeader>(
          `UPDATE organizers SET stripe_connect_status = 'not_started' WHERE id = ?`,
          [organizerId],
        );
      }

      const payload = await buildStatusResponse(organizerId);
      res.json(payload);
    },
  );
}
