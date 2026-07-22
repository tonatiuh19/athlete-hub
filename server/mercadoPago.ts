/**
 * Mercado Pago marketplace (Split 1:1) — OAuth, preferences, payments, refunds.
 * Uses REST fetch (no SDK) for Vercel serverless compatibility.
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  isMercadoPagoReady,
  isPayoutRail,
  type MercadoPagoOauthStatus,
  type PayoutRail,
} from "../shared/payoutRail.js";

function logMp(level: "warn" | "error", msg: string, err?: unknown) {
  if (level === "warn") console.warn(msg, err);
  else console.error(msg, err);
}

const MP_API = "https://api.mercadopago.com";
const MP_AUTH_MX = "https://auth.mercadopago.com.mx/authorization";

type AuthedRequest = Request & {
  auth?: { id: number; organizerId?: number; role?: string };
};

function appUrl(): string {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.VITE_PUBLIC_APP_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(
    process.env.MP_CLIENT_ID?.trim() &&
    process.env.MP_CLIENT_SECRET?.trim() &&
    process.env.MP_PLATFORM_ACCESS_TOKEN?.trim(),
  );
}

export function mpPlatformPublicKey(): string | null {
  return process.env.MP_PLATFORM_PUBLIC_KEY?.trim() || null;
}

function encryptionKey(): Buffer {
  const raw =
    process.env.MP_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "triboo-mp-dev-key-change-me!!";
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptSecret(
  payload: string | null | undefined,
): string | null {
  if (!payload) return null;
  if (!payload.startsWith("v1:")) return payload;
  const [, ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

async function mpFetch<T>(
  path: string,
  opts: {
    method?: string;
    accessToken: string;
    body?: unknown;
    formUrlEncoded?: Record<string, string>;
  },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.accessToken}`,
    Accept: "application/json",
  };
  let body: string | undefined;
  if (opts.formUrlEncoded) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.formUrlEncoded).toString();
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${MP_API}${path}`, {
    method: opts.method || "GET",
    headers,
    body,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg =
      typeof json === "object" &&
      json &&
      "message" in json &&
      typeof (json as { message: unknown }).message === "string"
        ? (json as { message: string }).message
        : `Mercado Pago HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json as T;
}

export type OrganizerMpRow = {
  id: number;
  payout_rail: PayoutRail;
  mp_user_id: string | null;
  mp_access_token_enc: string | null;
  mp_refresh_token_enc: string | null;
  mp_token_expires_at: Date | string | null;
  mp_public_key: string | null;
  mp_oauth_status: MercadoPagoOauthStatus;
  mp_oauth_connected_at: Date | string | null;
  mp_oauth_last_synced_at: Date | string | null;
  legal_name: string | null;
  billing_email: string | null;
  rfc: string | null;
  payout_terms_accepted_at: Date | string | null;
  payout_fee_acknowledged_at: Date | string | null;
};

export async function loadOrganizerMp(
  pool: Pool,
  organizerId: number,
): Promise<OrganizerMpRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, payout_rail, mp_user_id, mp_access_token_enc, mp_refresh_token_enc,
            mp_token_expires_at, mp_public_key, mp_oauth_status, mp_oauth_connected_at,
            mp_oauth_last_synced_at, legal_name, billing_email, rfc,
            payout_terms_accepted_at, payout_fee_acknowledged_at
     FROM organizers WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [organizerId],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    payout_rail: isPayoutRail(r.payout_rail) ? r.payout_rail : "stripe",
    mp_user_id: (r.mp_user_id as string) ?? null,
    mp_access_token_enc: (r.mp_access_token_enc as string) ?? null,
    mp_refresh_token_enc: (r.mp_refresh_token_enc as string) ?? null,
    mp_token_expires_at: r.mp_token_expires_at as Date | string | null,
    mp_public_key: (r.mp_public_key as string) ?? null,
    mp_oauth_status:
      (r.mp_oauth_status as MercadoPagoOauthStatus) || "not_started",
    mp_oauth_connected_at: r.mp_oauth_connected_at as Date | string | null,
    mp_oauth_last_synced_at: r.mp_oauth_last_synced_at as Date | string | null,
    legal_name: (r.legal_name as string) ?? null,
    billing_email: (r.billing_email as string) ?? null,
    rfc: (r.rfc as string) ?? null,
    payout_terms_accepted_at: r.payout_terms_accepted_at as
      | Date
      | string
      | null,
    payout_fee_acknowledged_at: r.payout_fee_acknowledged_at as
      | Date
      | string
      | null,
  };
}

export function organizerMpReady(row: OrganizerMpRow): boolean {
  if (!isMercadoPagoReady(row.mp_oauth_status)) return false;
  if (!row.mp_user_id || !row.mp_access_token_enc) return false;
  if (!row.payout_terms_accepted_at || !row.payout_fee_acknowledged_at)
    return false;
  if (!row.legal_name?.trim() || !row.billing_email?.trim() || !row.rfc?.trim())
    return false;
  return true;
}

export async function getSellerAccessToken(
  pool: Pool,
  row: OrganizerMpRow,
): Promise<string> {
  let token = decryptSecret(row.mp_access_token_enc);
  if (!token) throw new Error("Mercado Pago seller token missing");

  const expiresAt = row.mp_token_expires_at
    ? new Date(row.mp_token_expires_at).getTime()
    : 0;
  const refresh = decryptSecret(row.mp_refresh_token_enc);
  if (refresh && expiresAt && Date.now() > expiresAt - 60_000) {
    try {
      const refreshed = await mpFetch<{
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        public_key?: string;
        user_id?: number;
      }>("/oauth/token", {
        method: "POST",
        accessToken: process.env.MP_PLATFORM_ACCESS_TOKEN!,
        formUrlEncoded: {
          client_id: process.env.MP_CLIENT_ID!,
          client_secret: process.env.MP_CLIENT_SECRET!,
          grant_type: "refresh_token",
          refresh_token: refresh,
        },
      });
      token = refreshed.access_token;
      const expires = refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000)
        : null;
      await pool.query(
        `UPDATE organizers SET
           mp_access_token_enc = ?,
           mp_refresh_token_enc = COALESCE(?, mp_refresh_token_enc),
           mp_token_expires_at = ?,
           mp_public_key = COALESCE(?, mp_public_key),
           mp_oauth_last_synced_at = NOW()
         WHERE id = ?`,
        [
          encryptSecret(refreshed.access_token),
          refreshed.refresh_token
            ? encryptSecret(refreshed.refresh_token)
            : null,
          expires,
          refreshed.public_key ?? null,
          row.id,
        ],
      );
    } catch (err) {
      logMp("warn", "[mp] refresh token failed", err);
    }
  }
  return token;
}

export function buildMpOauthAuthorizeUrl(state: string): string {
  const redirectUri = `${appUrl()}/api/organizer/payouts/mp/oauth/callback`;
  const params = new URLSearchParams({
    client_id: process.env.MP_CLIENT_ID!,
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: redirectUri,
  });
  return `${MP_AUTH_MX}?${params.toString()}`;
}

export async function exchangeMpOauthCode(
  pool: Pool,
  organizerId: number,
  code: string,
): Promise<void> {
  const redirectUri = `${appUrl()}/api/organizer/payouts/mp/oauth/callback`;
  const token = await mpFetch<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    public_key?: string;
    user_id?: number;
    live_mode?: boolean;
  }>("/oauth/token", {
    method: "POST",
    accessToken: process.env.MP_PLATFORM_ACCESS_TOKEN!,
    formUrlEncoded: {
      client_id: process.env.MP_CLIENT_ID!,
      client_secret: process.env.MP_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    },
  });

  const expires = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000)
    : null;

  await pool.query(
    `UPDATE organizers SET
       mp_user_id = ?,
       mp_access_token_enc = ?,
       mp_refresh_token_enc = ?,
       mp_token_expires_at = ?,
       mp_public_key = ?,
       mp_oauth_status = 'ready',
       mp_oauth_connected_at = NOW(),
       mp_oauth_last_synced_at = NOW()
     WHERE id = ? AND deleted_at IS NULL`,
    [
      token.user_id != null ? String(token.user_id) : null,
      encryptSecret(token.access_token),
      token.refresh_token ? encryptSecret(token.refresh_token) : null,
      expires,
      token.public_key ?? mpPlatformPublicKey(),
      organizerId,
    ],
  );
}

export async function createMarketplacePreference(opts: {
  pool: Pool;
  organizerId: number;
  title: string;
  amountCents: number;
  marketplaceFeeCents: number;
  externalReference: string;
  payerEmail?: string;
}): Promise<{ preferenceId: string; initPoint: string | null }> {
  const row = await loadOrganizerMp(opts.pool, opts.organizerId);
  if (!row || !organizerMpReady(row)) {
    throw new Error("Mercado Pago seller not ready");
  }
  const sellerToken = await getSellerAccessToken(opts.pool, row);
  const unitPrice = Math.round(opts.amountCents) / 100;
  const fee = Math.round(opts.marketplaceFeeCents) / 100;

  const pref = await mpFetch<{
    id: string;
    init_point?: string;
    sandbox_init_point?: string;
  }>("/checkout/preferences", {
    method: "POST",
    accessToken: sellerToken,
    body: {
      items: [
        {
          id: opts.externalReference.slice(0, 64),
          title: opts.title.slice(0, 256),
          quantity: 1,
          currency_id: "MXN",
          unit_price: unitPrice,
        },
      ],
      marketplace_fee: fee,
      external_reference: opts.externalReference,
      notification_url: `${appUrl()}/api/webhooks/mercadopago`,
      metadata: {
        payment_public_uuid: opts.externalReference,
        organizer_id: String(opts.organizerId),
      },
      payer: opts.payerEmail ? { email: opts.payerEmail } : undefined,
      payment_methods: {
        excluded_payment_types: [],
        installments: 1,
      },
    },
  });

  return {
    preferenceId: pref.id,
    initPoint: pref.init_point ?? pref.sandbox_init_point ?? null,
  };
}

export async function createMarketplacePayment(opts: {
  pool: Pool;
  organizerId: number;
  amountCents: number;
  applicationFeeCents: number;
  token: string;
  paymentMethodId: string;
  installments?: number;
  payerEmail: string;
  externalReference: string;
  description: string;
}): Promise<{ id: string; status: string; status_detail?: string }> {
  const row = await loadOrganizerMp(opts.pool, opts.organizerId);
  if (!row || !organizerMpReady(row)) {
    throw new Error("Mercado Pago seller not ready");
  }
  const sellerToken = await getSellerAccessToken(opts.pool, row);
  const payment = await mpFetch<{
    id: number | string;
    status: string;
    status_detail?: string;
  }>("/v1/payments", {
    method: "POST",
    accessToken: sellerToken,
    body: {
      transaction_amount: Math.round(opts.amountCents) / 100,
      token: opts.token,
      description: opts.description.slice(0, 255),
      installments: opts.installments ?? 1,
      payment_method_id: opts.paymentMethodId,
      payer: { email: opts.payerEmail },
      external_reference: opts.externalReference,
      application_fee: Math.round(opts.applicationFeeCents) / 100,
      metadata: {
        payment_public_uuid: opts.externalReference,
        organizer_id: String(opts.organizerId),
      },
      notification_url: `${appUrl()}/api/webhooks/mercadopago`,
    },
  });
  return {
    id: String(payment.id),
    status: payment.status,
    status_detail: payment.status_detail,
  };
}

export async function refundMercadoPagoPayment(opts: {
  pool: Pool;
  organizerId: number;
  mpPaymentId: string;
}): Promise<{ id: string }> {
  const row = await loadOrganizerMp(opts.pool, opts.organizerId);
  if (!row) throw new Error("Organizer not found");
  const sellerToken = await getSellerAccessToken(opts.pool, row);
  const refund = await mpFetch<{ id: number | string }>(
    `/v1/payments/${opts.mpPaymentId}/refunds`,
    {
      method: "POST",
      accessToken: sellerToken,
      body: {},
    },
  );
  return { id: String(refund.id) };
}

export async function fetchMpPayment(
  accessToken: string,
  paymentId: string,
): Promise<{
  id: string;
  status: string;
  external_reference?: string;
  metadata?: Record<string, unknown>;
}> {
  const payment = await mpFetch<{
    id: number | string;
    status: string;
    external_reference?: string;
    metadata?: Record<string, unknown>;
  }>(`/v1/payments/${paymentId}`, { accessToken });
  return {
    id: String(payment.id),
    status: payment.status,
    external_reference: payment.external_reference,
    metadata: payment.metadata,
  };
}

export function buildMpChecklist(row: OrganizerMpRow | null): {
  items: Array<{ key: string; complete: boolean; required: boolean }>;
  complete: boolean;
} {
  const connected = Boolean(
    row && isMercadoPagoReady(row.mp_oauth_status) && row.mp_user_id,
  );
  const items = [
    { key: "mp_oauth", complete: connected, required: true },
    {
      key: "mp_configured",
      complete: isMercadoPagoConfigured(),
      required: true,
    },
  ];
  return { items, complete: items.every((i) => i.complete) };
}

function canManagePayouts(role: string | undefined): boolean {
  return Boolean(
    role && ["owner", "finance", "organizer", "promoter"].includes(role),
  );
}

export function registerMercadoPagoRoutes(
  app: Express,
  pool: Pool,
  requireOrganizer: (req: Request, res: Response, next: () => void) => void,
  buildStatusResponse: (organizerId: number) => Promise<unknown>,
): void {
  app.get(
    "/api/organizer/payouts/mp/oauth/start",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      if (!canManagePayouts(req.auth?.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!isMercadoPagoConfigured()) {
        return res.status(503).json({
          error: "Mercado Pago is not configured",
          code: "mp_not_configured",
        });
      }
      const organizerId = req.auth!.organizerId!;
      const state = Buffer.from(
        JSON.stringify({
          organizerId,
          nonce: crypto.randomBytes(8).toString("hex"),
          ts: Date.now(),
        }),
      ).toString("base64url");
      await pool.query(
        `UPDATE organizers SET mp_oauth_status = 'pending' WHERE id = ?`,
        [organizerId],
      );
      return res.json({ url: buildMpOauthAuthorizeUrl(state) });
    },
  );

  app.get("/api/organizer/payouts/mp/oauth/callback", async (req, res) => {
    try {
      const code = String(req.query.code || "");
      const stateRaw = String(req.query.state || "");
      if (!code || !stateRaw) {
        return res.redirect(`${appUrl()}/staff/payouts?mp=error`);
      }
      const state = JSON.parse(
        Buffer.from(stateRaw, "base64url").toString("utf8"),
      ) as { organizerId?: number };
      if (!state.organizerId || !Number.isFinite(state.organizerId)) {
        return res.redirect(`${appUrl()}/staff/payouts?mp=error`);
      }
      await exchangeMpOauthCode(pool, state.organizerId, code);
      return res.redirect(`${appUrl()}/staff/payouts?mp=connected`);
    } catch (err) {
      logMp("error", "[mp] oauth callback", err);
      return res.redirect(`${appUrl()}/staff/payouts?mp=error`);
    }
  });

  app.post(
    "/api/organizer/payouts/rail",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      if (!canManagePayouts(req.auth?.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const rail = req.body?.payout_rail ?? req.body?.payoutRail;
      if (!isPayoutRail(rail)) {
        return res
          .status(400)
          .json({ error: "payout_rail must be stripe or mercadopago" });
      }
      if (rail === "mercadopago" && !isMercadoPagoConfigured()) {
        return res.status(503).json({
          error: "Digital wallet payouts are not available yet",
          code: "mp_not_configured",
        });
      }
      await pool.query(`UPDATE organizers SET payout_rail = ? WHERE id = ?`, [
        rail,
        req.auth!.organizerId!,
      ]);
      const status = await buildStatusResponse(req.auth!.organizerId!);
      return res.json(status);
    },
  );

  app.post(
    "/api/organizer/payouts/mp/disconnect",
    requireOrganizer,
    async (req: AuthedRequest, res) => {
      if (!req.auth?.role || !["owner", "finance"].includes(req.auth.role)) {
        return res
          .status(403)
          .json({ error: "Only owner or finance can disconnect" });
      }
      await pool.query(
        `UPDATE organizers SET
           mp_user_id = NULL,
           mp_access_token_enc = NULL,
           mp_refresh_token_enc = NULL,
           mp_token_expires_at = NULL,
           mp_oauth_status = 'revoked',
           mp_oauth_last_synced_at = NOW()
         WHERE id = ?`,
        [req.auth!.organizerId!],
      );
      const status = await buildStatusResponse(req.auth!.organizerId!);
      return res.json(status);
    },
  );
}

export async function recordMpWebhookEvent(
  pool: Pool,
  mpEventId: string,
  topic: string | null,
  action: string | null,
  payload: unknown,
): Promise<boolean> {
  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO mercadopago_webhook_events (mp_event_id, topic, action, payload_json, processed_at)
       VALUES (?,?,?,?,NOW())`,
      [mpEventId, topic, action, JSON.stringify(payload ?? null)],
    );
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "ER_DUP_ENTRY") return false;
    throw err;
  }
}
