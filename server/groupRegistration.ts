/**
 * Group / family multi-ticket registration checkout.
 */
import crypto from "crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type Stripe from "stripe";
import {
  applyDiscountToCheckout,
  breakdownToSnapshot,
  computeCheckoutBreakdown,
  computeCheckoutWithExtras,
  resolveFeePresentation,
  validateCheckoutBreakdown,
} from "../shared/checkoutBreakdown.js";
import { evaluateCategoryEligibility } from "../shared/categoryEligibility.js";
import { validateRegistrationFieldAnswers } from "../shared/registrationFields.js";
import {
  isMinorOnReferenceDate,
  normalizeParticipantEmail,
  type GroupCheckoutLineItemInput,
  type GroupCheckoutLineItemResolved,
  type GroupGuestParticipant,
} from "../shared/groupCheckout.js";
import type { RegistrationCheckoutResponse } from "../shared/api.js";
import { normalizeApiDateOnly } from "../shared/api.js";
import { CATEGORY_SOLD_COUNT_UNALIASED_SQL } from "./registrationCounts.js";
import type { GroupCheckoutPaymentMetadata } from "./checkoutMetadata.js";
import { fetchRegistrationFieldsForCategory } from "./registrationFields.js";
import {
  incrementExtrasSoldCount,
  insertRegistrationExtras,
  resolveSelectedExtras,
  type ExtraFieldAnswersInput,
} from "./eventExtras.js";
import {
  insertRegistrationWaiverSignatures,
  validateWaiverSignaturesForEvent,
} from "./eventWaivers.js";
import { allocateRegistrationNumber, type RegistrationFolioContext } from "./folioSegments.js";
import {
  fetchEventBibMode,
  resolveRegistrationBibNumber,
} from "./bibMode.js";

export type GroupRegistrationError = { status: number; body: Record<string, unknown> };

export function newPublicUuid(): string {
  return crypto.randomUUID();
}

export function newQrToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function newGuestClaimToken(): string {
  return crypto.randomUUID();
}

type CategoryRow = RowDataPacket & {
  id: number;
  name: string;
  price_cents: number;
  capacity: number | null;
  currency: string;
  waitlist_enabled: number;
  min_age: number | null;
  max_age: number | null;
  gender_restriction: string | null;
  sold_count: number;
};

async function loadCategory(
  db: Pool | PoolConnection,
  eventId: number,
  categoryId: number,
): Promise<CategoryRow | null> {
  const [rows] = await db.query<CategoryRow[]>(
    `SELECT id, name, price_cents, capacity, currency, waitlist_enabled,
            min_age, max_age, gender_restriction,
            ${CATEGORY_SOLD_COUNT_UNALIASED_SQL} AS sold_count
     FROM event_categories
     WHERE id = ? AND event_id = ? AND is_active = 1 LIMIT 1`,
    [categoryId, eventId],
  );
  return rows[0] ?? null;
}

async function athleteHasConfirmedRegistration(
  db: Pool | PoolConnection,
  eventId: number,
  athleteId: number,
): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id FROM registrations
     WHERE event_id = ? AND athlete_id = ? AND status = 'confirmed' AND deleted_at IS NULL LIMIT 1`,
    [eventId, athleteId],
  );
  return rows.length > 0;
}

async function findAthleteByEmail(
  db: Pool | PoolConnection,
  email: string,
): Promise<RowDataPacket | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, email, first_name, last_name, date_of_birth, gender
     FROM athletes WHERE email = ? AND deleted_at IS NULL AND status = 'active' LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

async function createGuestAthlete(
  conn: PoolConnection,
  guest: GroupGuestParticipant,
  isSimulation = false,
): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO athletes (
      public_uuid, email, first_name, last_name, date_of_birth, gender, preferred_language, status, is_simulation
    ) VALUES (?,?,?,?,?,?, 'es', 'active', ?)`,
    [
      newPublicUuid(),
      normalizeParticipantEmail(guest.email),
      guest.firstName.trim(),
      guest.lastName.trim(),
      guest.dateOfBirth,
      guest.gender,
      isSimulation ? 1 : 0,
    ],
  );
  return result.insertId;
}

async function resolveLineParticipant(
  conn: PoolConnection,
  line: GroupCheckoutLineItemInput,
  purchaserAthleteId: number,
  eventId: number,
  isSimulation = false,
): Promise<
  | {
      athleteId: number;
      email: string;
      label: string;
      profile: { date_of_birth: string | null; gender: string | null };
    }
  | GroupRegistrationError
> {
  if (line.participantType === "self") {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, email, first_name, last_name, date_of_birth, gender
       FROM athletes WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [purchaserAthleteId],
    );
    if (!rows.length) return { status: 401, body: { error: "Athlete not found" } };
    const a = rows[0];
    if (await athleteHasConfirmedRegistration(conn, eventId, purchaserAthleteId)) {
      return {
        status: 409,
        body: { error: "You are already registered for this event", code: "already_registered" },
      };
    }
    return {
      athleteId: purchaserAthleteId,
      email: String(a.email ?? ""),
      label: `${a.first_name} ${a.last_name}`.trim(),
      profile: {
        date_of_birth: a.date_of_birth as string | null,
        gender: a.gender as string | null,
      },
    };
  }

  if (line.participantType === "account") {
    const email = normalizeParticipantEmail(String(line.accountEmail ?? ""));
    if (!email) return { status: 400, body: { error: "Account email required" } };
    const athlete = await findAthleteByEmail(conn, email);
    if (!athlete) {
      return {
        status: 404,
        body: { error: `No Triboo account found for ${email}`, code: "account_not_found" },
      };
    }
    const athleteId = Number(athlete.id);
    if (await athleteHasConfirmedRegistration(conn, eventId, athleteId)) {
      return {
        status: 409,
        body: { error: `${email} is already registered`, code: "participant_already_registered" },
      };
    }
    return {
      athleteId,
      email,
      label: `${athlete.first_name} ${athlete.last_name}`.trim(),
      profile: {
        date_of_birth: athlete.date_of_birth as string | null,
        gender: athlete.gender as string | null,
      },
    };
  }

  const guest = line.guest;
  if (!guest?.firstName?.trim() || !guest?.lastName?.trim() || !guest?.email?.trim()) {
    return { status: 400, body: { error: "Guest name and email required" } };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(guest.dateOfBirth)) {
    return { status: 400, body: { error: "Guest date of birth required (YYYY-MM-DD)" } };
  }
  const email = normalizeParticipantEmail(guest.email);
  const existing = await findAthleteByEmail(conn, email);
  if (existing) {
    const athleteId = Number(existing.id);
    if (await athleteHasConfirmedRegistration(conn, eventId, athleteId)) {
      return {
        status: 409,
        body: { error: `${email} is already registered`, code: "participant_already_registered" },
      };
    }
    return {
      athleteId,
      email,
      label: `${guest.firstName} ${guest.lastName}`.trim(),
      profile: {
        date_of_birth: (existing.date_of_birth as string | null) ?? guest.dateOfBirth,
        gender: (existing.gender as string | null) ?? guest.gender,
      },
    };
  }
  const athleteId = await createGuestAthlete(conn, guest, isSimulation);
  return {
    athleteId,
    email,
    label: `${guest.firstName} ${guest.lastName}`.trim(),
    profile: { date_of_birth: guest.dateOfBirth, gender: guest.gender },
  };
}

export async function validateAndPriceGroupCheckout(
  pool: Pool,
  opts: {
    eventId: number;
    eventStartDate: string;
    purchaserAthleteId: number;
    maxPerOrder: number;
    feePercent: number;
    feePresentation: ReturnType<typeof resolveFeePresentation>;
    requiresWaiver: boolean;
    lineItems: GroupCheckoutLineItemInput[];
    isSimulation?: boolean;
    discount?: {
      id: number;
      code: string;
      discount_type: string;
      discount_value: number;
      applies_to: string;
      min_purchase_cents: number | null;
    };
  },
): Promise<
  | {
      ok: true;
      resolved: GroupCheckoutLineItemResolved[];
      totals: {
        subtotalCents: number;
        serviceFeeCents: number;
        discountAmountCents: number;
        totalCents: number;
        registrationAmountCents: number;
        orderBreakdown: ReturnType<typeof breakdownToSnapshot>;
      };
    }
  | { ok: false; error: GroupRegistrationError }
> {
  const items = opts.lineItems;
  if (!items?.length) {
    return { ok: false, error: { status: 400, body: { error: "At least one participant required" } } };
  }
  if (items.length > opts.maxPerOrder) {
    return {
      ok: false,
      error: {
        status: 400,
        body: { error: `Maximum ${opts.maxPerOrder} tickets per order`, code: "order_limit_exceeded" },
      },
    };
  }

  const emails = new Set<string>();
  const conn = await pool.getConnection();
  try {
    const resolved: GroupCheckoutLineItemResolved[] = [];
    const categoryDemand = new Map<number, number>();

    for (const line of items) {
      const participant = await resolveLineParticipant(
        conn,
        line,
        opts.purchaserAthleteId,
        opts.eventId,
        Boolean(opts.isSimulation),
      );
      if ("status" in participant) return { ok: false, error: participant };

      const emailKey = normalizeParticipantEmail(participant.email);
      if (emails.has(emailKey)) {
        return {
          ok: false,
          error: {
            status: 400,
            body: { error: "Duplicate participant email in order", code: "duplicate_participant" },
          },
        };
      }
      emails.add(emailKey);

      const category = await loadCategory(conn, opts.eventId, line.categoryId);
      if (!category) return { ok: false, error: { status: 404, body: { error: "Category not found" } } };

      const fieldRows = await fetchRegistrationFieldsForCategory(
        conn,
        opts.eventId,
        line.categoryId,
      );
      const fieldErr = validateRegistrationFieldAnswers(
        fieldRows.map((row) => ({
          field_key: String(row.field_key),
          label: String(row.label),
          field_type: String(row.field_type),
          is_required: row.is_required as boolean | number,
          options_json: row.options_json,
        })),
        line.fieldValues ?? {},
      );
      if (fieldErr) {
        return {
          ok: false,
          error: {
            status: 400,
            body: {
              error: `${participant.label}: ${fieldErr}`,
              code: "registration_fields_invalid",
            },
          },
        };
      }

      const elig = evaluateCategoryEligibility(
        category,
        participant.profile,
        opts.eventStartDate,
      );
      if (!elig.eligible) {
        return {
          ok: false,
          error: {
            status: 403,
            body: { error: `${participant.label}: not eligible for ${category.name}` },
          },
        };
      }

      if (
        isMinorOnReferenceDate(
          participant.profile.date_of_birth ?? "",
          opts.eventStartDate,
        ) &&
        !line.guardianRelationship?.trim()
      ) {
        return {
          ok: false,
          error: {
            status: 400,
            body: { error: `${participant.label}: guardian relationship required`, code: "guardian_required" },
          },
        };
      }

      if (opts.requiresWaiver && !line.waiverSignatures?.length) {
        return {
          ok: false,
          error: { status: 400, body: { error: `Waiver required for ${participant.label}` } },
        };
      }
      if (line.waiverSignatures?.length) {
        const validation = await validateWaiverSignaturesForEvent(pool, opts.eventId, line.waiverSignatures);
        if ("error" in validation) {
          return { ok: false, error: { status: 400, body: { error: validation.error } } };
        }
      }

      const extrasResult = await resolveSelectedExtras(pool, opts.eventId, line.selectedExtras ?? [], {
        categoryId: line.categoryId,
      });
      if (extrasResult.ok === false) {
        return { ok: false, error: { status: 400, body: { error: extrasResult.error } } };
      }

      const lineBreakdown = computeCheckoutWithExtras({
        categoryListPriceCents: Number(category.price_cents),
        extrasSubtotalCents: extrasResult.lines.reduce((s, l) => s + l.totalCents, 0),
        serviceFeePercent: opts.feePercent,
        feePresentation: opts.feePresentation,
      });
      const breakdownErr = validateCheckoutBreakdown(lineBreakdown);
      if (breakdownErr) return { ok: false, error: { status: 400, body: { error: breakdownErr } } };

      const demand = (categoryDemand.get(line.categoryId) ?? 0) + 1;
      categoryDemand.set(line.categoryId, demand);
      if (
        category.capacity != null &&
        Number(category.sold_count) + demand > Number(category.capacity) &&
        !line.waitlistEntryId
      ) {
        const code = Boolean(category.waitlist_enabled) ? "waitlist_available" : undefined;
        return {
          ok: false,
          error: {
            status: 409,
            body: { error: `${category.name} is sold out`, code, categoryId: category.id },
          },
        };
      }

      resolved.push({
        ...line,
        categoryName: String(category.name),
        categoryListPriceCents: Number(category.price_cents),
        extrasSubtotalCents: extrasResult.lines.reduce((s, l) => s + l.totalCents, 0),
        listPriceCents: lineBreakdown.listPriceCents,
        serviceFeeCents: lineBreakdown.serviceFeeCents,
        totalCents: lineBreakdown.athleteTotalCents,
        breakdown: breakdownToSnapshot(lineBreakdown),
        resolvedAthleteId: participant.athleteId,
        participantLabel: participant.label,
        participantEmail: participant.email,
        selectedExtras: extrasResult.lines,
      });
    }

    const subtotalCents = resolved.reduce((s, l) => s + l.listPriceCents, 0);
    let orderBreakdown = computeCheckoutBreakdown({
      listPriceCents: subtotalCents,
      serviceFeePercent: opts.feePercent,
      feePresentation: opts.feePresentation,
    });
    let discountAmountCents = 0;
    if (opts.discount) {
      try {
        const applied = applyDiscountToCheckout({
          listPriceCents: subtotalCents,
          serviceFeePercent: opts.feePercent,
          feePresentation: opts.feePresentation,
          discount: {
            discount_type:
              opts.discount.discount_type === "fixed_cents" ? "fixed_cents" : "percent",
            discount_value: opts.discount.discount_value,
            applies_to:
              opts.discount.applies_to === "registration" ||
              opts.discount.applies_to === "service_fee"
                ? opts.discount.applies_to
                : "total",
            min_purchase_cents: opts.discount.min_purchase_cents,
          },
        });
        orderBreakdown = applied.breakdown;
        discountAmountCents = applied.discountAmountCents;
      } catch (err) {
        return {
          ok: false,
          error: {
            status: 400,
            body: { error: err instanceof Error ? err.message : "Discount not applicable" },
          },
        };
      }
    }

    return {
      ok: true,
      resolved,
      totals: {
        subtotalCents,
        serviceFeeCents: orderBreakdown.serviceFeeCents,
        discountAmountCents,
        totalCents: orderBreakdown.athleteTotalCents,
        registrationAmountCents: orderBreakdown.stripeOrganizerTransferCents,
        orderBreakdown: breakdownToSnapshot(orderBreakdown),
      },
    };
  } finally {
    conn.release();
  }
}

export async function finalizeGroupRegistrationOrder(
  conn: PoolConnection,
  pay: RowDataPacket,
  meta: GroupCheckoutPaymentMetadata,
  _pi: Stripe.PaymentIntent,
  deps: {
    deliverRegistrationConfirmedEmail: (registrationId: number) => Promise<unknown>;
    deliverGroupOrderSummaryEmail?: (orderId: number, purchaserAthleteId: number) => Promise<unknown>;
  },
): Promise<{ success: boolean; orderPublicUuid?: string; registrations?: RowDataPacket[]; error?: string }> {
  const eventId = pay.event_id as number;
  const purchaserAthleteId = pay.athlete_id as number;
  const orderPublicUuid = meta.orderPublicUuid;

  const [existingOrder] = await conn.query<RowDataPacket[]>(
    `SELECT id, status FROM registration_orders WHERE public_uuid = ? LIMIT 1 FOR UPDATE`,
    [orderPublicUuid],
  );
  if (existingOrder.length > 0 && existingOrder[0].status === "confirmed") {
    const [regs] = await conn.query<RowDataPacket[]>(
      `SELECT r.public_uuid, r.registration_number, r.qr_code_token, r.bib_number, r.status, r.total_cents,
              ec.name AS category_name, e.title AS event_title, e.slug AS event_slug,
              CONCAT(a.first_name, ' ', a.last_name) AS participant_label, a.email AS participant_email,
              r.guest_claim_token, r.purchaser_athlete_id, r.athlete_id
       FROM registrations r
       JOIN event_categories ec ON ec.id = r.event_category_id
       JOIN events e ON e.id = r.event_id
       JOIN athletes a ON a.id = r.athlete_id
       WHERE r.order_id = ? AND r.deleted_at IS NULL`,
      [existingOrder[0].id],
    );
    const enriched = regs.map((r) => {
      const claimPending = Boolean(r.guest_claim_token);
      const managed =
        r.purchaser_athlete_id != null &&
        Number(r.purchaser_athlete_id) !== Number(r.athlete_id) &&
        !claimPending;
      return {
        ...r,
        wallet_held_by_purchaser: claimPending || managed,
        is_managed_participant: managed,
      };
    });
    return { success: true, orderPublicUuid, registrations: enriched };
  }

  const [[eventMetaRow]] = await conn.query<RowDataPacket[]>(
    "SELECT slug, start_date, is_simulation FROM events WHERE id = ? LIMIT 1",
    [eventId],
  );
  const isSim = Number(eventMetaRow?.is_simulation) === 1;
  const eventYear =
    eventMetaRow?.start_date != null
      ? String(new Date(eventMetaRow.start_date as string | Date).getFullYear())
      : String(new Date().getFullYear());
  const eventStartDate =
    normalizeApiDateOnly(eventMetaRow?.start_date) ??
    new Date().toISOString().slice(0, 10);
  const eventCode = String(eventMetaRow?.slug ?? eventId)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);

  const [orderResult] = await conn.query<ResultSetHeader>(
    `INSERT INTO registration_orders (
      public_uuid, event_id, purchaser_athlete_id, payment_id, status, item_count,
      subtotal_cents, service_fee_cents, discount_code_id, discount_amount_cents, total_cents, currency,
      is_simulation
    ) VALUES (?,?,?,?, 'confirmed', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderPublicUuid,
      eventId,
      purchaserAthleteId,
      pay.id,
      meta.itemCount,
      meta.lineItems.reduce((s, l) => s + l.listPriceCents, 0),
      Number(pay.service_fee_cents),
      meta.discountCodeId ?? null,
      meta.discountAmountCents ?? 0,
      Number(pay.amount_cents),
      pay.currency || "MXN",
      isSim || Number(pay.is_simulation) === 1 ? 1 : 0,
    ],
  );
  const orderId = orderResult.insertId;
  const createdRegs: RowDataPacket[] = [];
  const bibMode = await fetchEventBibMode(conn, eventId);

  for (const line of meta.lineItems) {
    const athleteId = line.resolvedAthleteId!;
    if (await athleteHasConfirmedRegistration(conn, eventId, athleteId)) {
      return { success: false, error: `${line.participantEmail} is already registered` };
    }

    const folioCtx: RegistrationFolioContext = {
      eventId,
      categoryId: line.categoryId,
      discountCodeId: meta.discountCodeId ?? null,
      discountCode: meta.discountCode ?? null,
      eventYear,
      eventCode,
    };
    const { registrationNumber, folioSegmentId } = await allocateRegistrationNumber(conn, folioCtx);
    const regUuid = newPublicUuid();
    const qrToken = newQrToken();
    const guestDob = line.guest?.dateOfBirth ?? "";
    const isManagedMinor =
      line.participantType === "guest" &&
      Boolean(guestDob) &&
      isMinorOnReferenceDate(guestDob, eventStartDate);
    const isManagedGuest =
      line.participantType === "guest" && (isManagedMinor || Boolean(line.managedByPurchaser));
    const guestClaimToken =
      line.participantType === "guest" && !isManagedGuest ? newGuestClaimToken() : null;
    const bibNumber = resolveRegistrationBibNumber({
      registrationNumber,
      bibMode,
    });

    const [regInsert] = await conn.query<ResultSetHeader>(
      `INSERT INTO registrations (
        public_uuid, event_id, event_category_id, athlete_id, registration_number,
        folio_segment_id, qr_code_token, bib_number, status, price_cents, service_fee_cents, total_cents,
        discount_code_id, currency, source, payment_id, order_id, purchaser_athlete_id, guest_claim_token,
        is_simulation
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        regUuid,
        eventId,
        line.categoryId,
        athleteId,
        registrationNumber,
        folioSegmentId,
        qrToken,
        bibNumber,
        "confirmed",
        line.breakdown.listPriceCents,
        line.serviceFeeCents,
        line.totalCents,
        meta.discountCodeId ?? null,
        pay.currency || "MXN",
        "web",
        pay.id,
        orderId,
        purchaserAthleteId,
        guestClaimToken,
        isSim || Number(pay.is_simulation) === 1 ? 1 : 0,
      ],
    );
    const registrationId = regInsert.insertId;

    const fieldRows = await fetchRegistrationFieldsForCategory(conn, eventId, line.categoryId);
    for (const field of fieldRows) {
      const raw = line.fieldValues[field.field_key as string];
      let valueText: string | null = null;
      if (field.field_type === "checkbox") {
        valueText = raw === true || raw === "true" ? "true" : "false";
      } else if (raw != null && String(raw).trim()) {
        valueText = String(raw).trim();
      }
      if (valueText != null) {
        await conn.query(
          `INSERT INTO registration_field_values (registration_id, field_id, value_text) VALUES (?,?,?)`,
          [registrationId, field.id, valueText],
        );
      }
    }

    if (line.waiverSignatures?.length) {
      await insertRegistrationWaiverSignatures(conn, registrationId, line.waiverSignatures, {
        clientIp: meta.clientIp,
        userAgent: meta.userAgent,
        deviceInfo: meta.deviceInfo,
      });
    }

    if (line.selectedExtras?.length) {
      const extrasSoldErr = await incrementExtrasSoldCount(conn, line.selectedExtras);
      if (extrasSoldErr) return { success: false, error: extrasSoldErr.error };
      await insertRegistrationExtras(
        conn,
        registrationId,
        line.selectedExtras,
        line.extraFieldAnswers as ExtraFieldAnswersInput | undefined,
      );
    }

    const [soldInc] = await conn.query<ResultSetHeader>(
      `UPDATE event_categories SET sold_count = sold_count + 1
       WHERE id = ? AND (capacity IS NULL OR sold_count < capacity)`,
      [line.categoryId],
    );
    if (soldInc.affectedRows === 0) {
      return { success: false, error: `${line.categoryName} is sold out` };
    }

    await conn.query(`UPDATE events SET registration_count = registration_count + 1 WHERE id = ?`, [
      eventId,
    ]);

    createdRegs.push({
      id: registrationId,
      public_uuid: regUuid,
      registration_number: registrationNumber,
      qr_code_token: qrToken,
      bib_number: bibNumber,
      status: "confirmed",
      total_cents: line.totalCents,
      category_name: line.categoryName,
      participant_label: line.participantLabel,
      participant_email: line.participantEmail,
      guest_claim_token: guestClaimToken,
      wallet_held_by_purchaser:
        line.participantType === "guest" && (Boolean(guestClaimToken) || isManagedGuest),
      is_managed_participant: isManagedGuest,
    } as RowDataPacket);
  }

  if (meta.discountCodeId) {
    await conn.query(
      `UPDATE discount_codes SET used_count = used_count + 1
       WHERE id = ? AND (max_uses IS NULL OR used_count < max_uses)`,
      [meta.discountCodeId],
    );
  }

  for (const reg of createdRegs) {
    await deps.deliverRegistrationConfirmedEmail(Number(reg.id));
  }

  if (deps.deliverGroupOrderSummaryEmail) {
    await deps.deliverGroupOrderSummaryEmail(orderId, purchaserAthleteId);
  }

  return { success: true, orderPublicUuid, registrations: createdRegs };
}

export async function claimGuestRegistration(
  pool: Pool,
  claimingAthleteId: number,
  claimToken: string,
): Promise<
  | {
      ok: true;
      registration: {
        public_uuid: string;
        registration_number: string;
        event_slug: string;
        event_title: string;
        category_name: string;
      };
    }
  | { ok: false; error: GroupRegistrationError }
> {
  const token = String(claimToken ?? "").trim();
  if (!token) {
    return { ok: false, error: { status: 400, body: { error: "claimToken required" } } };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [regRows] = await conn.query<RowDataPacket[]>(
      `SELECT r.id, r.event_id, r.athlete_id, r.status, r.guest_claim_token,
              r.registration_number, r.public_uuid,
              a.email AS guest_email,
              e.slug AS event_slug, e.title AS event_title,
              ec.name AS category_name
       FROM registrations r
       JOIN athletes a ON a.id = r.athlete_id
       JOIN events e ON e.id = r.event_id
       JOIN event_categories ec ON ec.id = r.event_category_id
       WHERE r.guest_claim_token = ? AND r.status = 'confirmed' AND r.deleted_at IS NULL
       LIMIT 1 FOR UPDATE`,
      [token],
    );
    if (!regRows.length) {
      await conn.rollback();
      return {
        ok: false,
        error: {
          status: 404,
          body: { error: "Invalid or expired claim link", code: "claim_not_found" },
        },
      };
    }
    const reg = regRows[0];

    const [claimerRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, email FROM athletes WHERE id = ? AND deleted_at IS NULL AND status = 'active' LIMIT 1`,
      [claimingAthleteId],
    );
    if (!claimerRows.length) {
      await conn.rollback();
      return { ok: false, error: { status: 401, body: { error: "Athlete not found" } } };
    }

    const claimerEmail = normalizeParticipantEmail(String(claimerRows[0].email ?? ""));
    const guestEmail = normalizeParticipantEmail(String(reg.guest_email ?? ""));
    if (!claimerEmail || claimerEmail !== guestEmail) {
      await conn.rollback();
      return {
        ok: false,
        error: {
          status: 403,
          body: {
            error: "This registration belongs to a different email address",
            code: "email_mismatch",
          },
        },
      };
    }

    const eventId = Number(reg.event_id);
    const registrationId = Number(reg.id);

    if (Number(reg.athlete_id) !== claimingAthleteId) {
      const [dup] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM registrations
         WHERE event_id = ? AND athlete_id = ? AND status = 'confirmed'
           AND deleted_at IS NULL AND id <> ?
         LIMIT 1`,
        [eventId, claimingAthleteId, registrationId],
      );
      if (dup.length) {
        await conn.rollback();
        return {
          ok: false,
          error: {
            status: 409,
            body: {
              error: "You already have a registration for this event",
              code: "already_registered",
            },
          },
        };
      }

      await conn.query(
        `UPDATE registrations SET athlete_id = ?, guest_claim_token = NULL, updated_at = NOW()
         WHERE id = ?`,
        [claimingAthleteId, registrationId],
      );
    } else {
      await conn.query(
        `UPDATE registrations SET guest_claim_token = NULL, updated_at = NOW() WHERE id = ?`,
        [registrationId],
      );
    }

    await conn.commit();
    return {
      ok: true,
      registration: {
        public_uuid: String(reg.public_uuid),
        registration_number: String(reg.registration_number),
        event_slug: String(reg.event_slug),
        event_title: String(reg.event_title),
        category_name: String(reg.category_name),
      },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export type GroupCheckoutApiResponse = RegistrationCheckoutResponse & {
  orderMode: "group";
  orderPublicUuid: string;
  itemCount: number;
  lineItems: GroupCheckoutLineItemResolved[];
};
