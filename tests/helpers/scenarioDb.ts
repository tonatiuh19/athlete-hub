import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { WAIVER_ACCEPTANCE_SIGNATURE } from "../../shared/waiverConstants";

export const SCENARIO = {
  athleteId: 1001,
  organizerId: 7,
  eventId: 42,
  categoryId: 10,
  slug: "mock-marathon-2026",
  eventTitle: "Mock Marathon 2026",
} as const;

type PaymentRow = RowDataPacket & {
  id: number;
  public_uuid: string;
  idempotency_key: string;
  registration_id: number | null;
  athlete_id: number;
  organizer_id: number;
  event_id: number;
  amount_cents: number;
  registration_amount_cents: number;
  service_fee_cents: number;
  currency: string;
  status: string;
  provider: string;
  metadata_json: string | Record<string, unknown>;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_application_fee_id: string | null;
  paid_at: string | null;
  created_at: string;
};

type RegistrationRow = RowDataPacket & {
  id: number;
  public_uuid: string;
  event_id: number;
  event_category_id: number;
  athlete_id: number;
  registration_number: string;
  qr_code_token: string;
  status: string;
  price_cents: number;
  service_fee_cents: number;
  total_cents: number;
  discount_code_id: number | null;
  currency: string;
  source: string;
  payment_id: number | null;
  deleted_at: string | null;
  waiver_signed_at: string | null;
};

type WaitlistRow = RowDataPacket & {
  id: number;
  athlete_id: number;
  event_id: number;
  event_category_id: number;
  status: string;
  offer_expires_at: string | null;
  converted_registration_id: number | null;
};

type DiscountCodeSeed = {
  id: number;
  code: string;
  discount_type: "percent" | "fixed_cents";
  discount_value: number;
  applies_to: "registration" | "service_fee" | "total";
  min_purchase_cents?: number | null;
  max_uses?: number | null;
  used_count?: number;
  event_id?: number | null;
};

export type OrganizerConnectSeed = {
  status?: "active" | "suspended" | "inactive";
  email?: string;
  legal_name?: string | null;
  billing_email?: string | null;
  rfc?: string | null;
  tax_regime?: string | null;
  service_fee_percent?: number;
  fee_presentation?: "pass_through" | "absorb_all";
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: number;
  stripe_connect_status?: string;
  stripe_charges_enabled?: number;
  stripe_payouts_enabled?: number;
  stripe_details_submitted?: number;
  stripe_connect_onboarded_at?: string | null;
  stripe_connect_last_synced_at?: string | null;
  stripe_connect_onboarding_mode?: string | null;
  payout_terms_accepted_at?: string | null;
  payout_fee_acknowledged_at?: string | null;
};

export interface ScenarioSeed {
  requiresWaiver?: boolean;
  waivers?: Array<{ id: number; title: string; version: number }>;
  discountCodes?: DiscountCodeSeed[];
  organizer?: OrganizerConnectSeed;
  event?: { fee_presentation?: "pass_through" | "absorb_all" | null };
  category?: {
    name?: string;
    price_cents?: number;
    capacity?: number | null;
    waitlist_enabled?: boolean;
  };
  confirmedRegistrationCount?: number;
  athleteAlreadyRegistered?: boolean;
  waitlistOffer?: { id: number; status: "offered" | "waiting" | "expired" };
  fields?: Array<{
    id: number;
    field_key: string;
    label: string;
    field_type: string;
    is_required: boolean;
    options_json?: string | null;
  }>;
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function header(insertId = 0, affectedRows = 1): ResultSetHeader {
  return { insertId, affectedRows } as ResultSetHeader;
}

export class RegistrationScenarioDb {
  readonly payments: PaymentRow[] = [];
  readonly registrations: RegistrationRow[] = [];
  readonly waiverSignatures: RowDataPacket[] = [];
  readonly fieldValues: RowDataPacket[] = [];
  readonly waitlist: WaitlistRow[] = [];
  readonly webhookEvents = new Map<
    string,
    { status: string; event_type: string; error_message: string | null }
  >();

  private nextPaymentId = 5000;
  private nextRegistrationId = 9000;
  private nextFieldValueId = 1;
  private txSnapshot: string | null = null;

  readonly requiresWaiver: boolean;
  readonly waivers: Array<{ id: number; title: string; version: number; is_active: number }>;
  readonly category: RowDataPacket;
  readonly event: RowDataPacket;
  readonly fields: RowDataPacket[];
  readonly athleteProfile: { date_of_birth: string; gender: string };
  readonly discountCodes: Array<
    DiscountCodeSeed & { is_active: number; organizer_id: number }
  >;
  readonly organizer: RowDataPacket;
  athleteStripeCustomerId: string | null = null;

  constructor(seed: ScenarioSeed = {}) {
    this.requiresWaiver = seed.requiresWaiver ?? false;
    this.waivers = (seed.waivers ?? []).map((w) => ({ ...w, is_active: 1 }));

    const priceCents = seed.category?.price_cents ?? 0;
    this.category = {
      id: SCENARIO.categoryId,
      name: seed.category?.name ?? "10K Elite",
      price_cents: priceCents,
      capacity: seed.category?.capacity ?? 100,
      currency: "MXN",
      waitlist_enabled: seed.category?.waitlist_enabled ? 1 : 0,
      registration_opens_at: null,
      registration_closes_at: null,
      min_age: null,
      max_age: null,
      gender_restriction: "any",
      is_active: 1,
      sold_count: 0,
      event_id: SCENARIO.eventId,
    } as RowDataPacket;

    this.event = {
      id: SCENARIO.eventId,
      title: SCENARIO.eventTitle,
      slug: SCENARIO.slug,
      status: "published",
      start_date: "2026-09-15",
      organizer_id: SCENARIO.organizerId,
      service_fee_percent: 11,
      org_fee_percent: 11,
      fee_presentation: seed.event?.fee_presentation ?? null,
      org_fee_presentation: seed.organizer?.fee_presentation ?? "pass_through",
      requires_waiver: this.requiresWaiver ? 1 : 0,
      registration_opens_at: null,
      registration_closes_at: null,
      registration_count: 0,
    } as RowDataPacket;

    this.athleteProfile = {
      date_of_birth: "1990-01-15",
      gender: "male",
    };

    this.fields = (seed.fields ?? []) as RowDataPacket[];

    this.discountCodes = (seed.discountCodes ?? []).map((d) => ({
      ...d,
      is_active: 1,
      organizer_id: SCENARIO.organizerId,
      event_id: d.event_id ?? SCENARIO.eventId,
      used_count: d.used_count ?? 0,
      min_purchase_cents: d.min_purchase_cents ?? null,
      max_uses: d.max_uses ?? null,
    }));

    const org = seed.organizer ?? {};
    this.organizer = {
      organizer_id: SCENARIO.organizerId,
      id: SCENARIO.organizerId,
      email: org.email ?? "organizer@test.local",
      legal_name: org.legal_name ?? null,
      billing_email: org.billing_email ?? null,
      rfc: org.rfc ?? null,
      tax_regime: org.tax_regime ?? null,
      service_fee_percent: org.service_fee_percent ?? 11,
      fee_presentation: org.fee_presentation ?? "pass_through",
      status: org.status ?? "active",
      stripe_account_id: org.stripe_account_id ?? null,
      stripe_onboarding_complete: org.stripe_onboarding_complete ?? 0,
      stripe_connect_status: org.stripe_connect_status ?? "not_started",
      stripe_charges_enabled: org.stripe_charges_enabled ?? 0,
      stripe_payouts_enabled: org.stripe_payouts_enabled ?? 0,
      stripe_details_submitted: org.stripe_details_submitted ?? 0,
      stripe_connect_onboarded_at: org.stripe_connect_onboarded_at ?? null,
      stripe_connect_last_synced_at: org.stripe_connect_last_synced_at ?? null,
      stripe_connect_onboarding_mode: org.stripe_connect_onboarding_mode ?? null,
      payout_terms_accepted_at: org.payout_terms_accepted_at ?? null,
      payout_fee_acknowledged_at: org.payout_fee_acknowledged_at ?? null,
      deleted_at: null,
    } as RowDataPacket;

    const confirmedCount = seed.confirmedRegistrationCount ?? 0;
    for (let i = 0; i < confirmedCount; i++) {
      this.registrations.push(this.makeRegistration(i + 1, SCENARIO.athleteId + i + 100));
    }

    if (seed.athleteAlreadyRegistered) {
      this.registrations.push(this.makeRegistration(999, SCENARIO.athleteId));
    }

    if (seed.waitlistOffer) {
      this.waitlist.push({
        id: seed.waitlistOffer.id,
        athlete_id: SCENARIO.athleteId,
        event_id: SCENARIO.eventId,
        event_category_id: SCENARIO.categoryId,
        status: seed.waitlistOffer.status,
        offer_expires_at:
          seed.waitlistOffer.status === "offered"
            ? new Date(Date.now() + 86400000).toISOString()
            : null,
        converted_registration_id: null,
      } as WaitlistRow);
    }
  }

  private makeRegistration(id: number, athleteId: number): RegistrationRow {
    return {
      id,
      public_uuid: `reg-uuid-${id}`,
      event_id: SCENARIO.eventId,
      event_category_id: SCENARIO.categoryId,
      athlete_id: athleteId,
      registration_number: `REG-0042-${String(id).padStart(5, "0")}`,
      qr_code_token: `qr-${id}`,
      status: "confirmed",
      price_cents: 0,
      service_fee_cents: 0,
      total_cents: 0,
      discount_code_id: null,
      currency: "MXN",
      source: "web",
      payment_id: null,
      deleted_at: null,
      waiver_signed_at: null,
    } as RegistrationRow;
  }

  private soldCount(categoryId = SCENARIO.categoryId): number {
    return this.registrations.filter(
      (r) =>
        r.event_category_id === categoryId &&
        r.status === "confirmed" &&
        r.deleted_at == null,
    ).length;
  }

  private categoryRow(): RowDataPacket {
    return {
      ...this.category,
      sold_count: this.soldCount(),
    };
  }

  private findPaymentByUuid(uuid: string): PaymentRow | undefined {
    return this.payments.find((p) => p.public_uuid === uuid);
  }

  private eventWithOrganizer(): RowDataPacket {
    return {
      ...this.event,
      stripe_account_id: this.organizer.stripe_account_id,
      stripe_onboarding_complete: this.organizer.stripe_onboarding_complete,
      stripe_connect_status: this.organizer.stripe_connect_status,
      stripe_charges_enabled: this.organizer.stripe_charges_enabled,
      stripe_payouts_enabled: this.organizer.stripe_payouts_enabled,
      org_fee_percent: this.organizer.service_fee_percent,
      org_fee_presentation: this.organizer.fee_presentation ?? "pass_through",
      fee_presentation: this.event.fee_presentation ?? null,
    } as RowDataPacket;
  }

  query = async (
    sql: string,
    params: unknown[] = [],
  ): Promise<[unknown, unknown]> => {
    const q = normalizeSql(sql);

    if (q.includes("update waitlist_entries set status = 'expired'")) {
      for (const w of this.waitlist) {
        if (w.status === "offered" && w.offer_expires_at && new Date(w.offer_expires_at) < new Date()) {
          w.status = "expired";
        }
      }
      return [header(0, 0), []];
    }

    if (q.includes("from events e") && q.includes("join organizers o") && q.includes("slug")) {
      return [[this.eventWithOrganizer()], []];
    }

    if (q.includes("select email from athletes") && q.includes("where id = ?") && q.includes("deleted_at is null")) {
      const athleteId = Number(params[0]);
      if (athleteId === SCENARIO.athleteId) {
        return [[{ email: "athlete@test.local" }], []];
      }
      return [[], []];
    }

    if (
      q.includes("select id, public_uuid, email, first_name, last_name, stripe_customer_id") &&
      q.includes("from athletes")
    ) {
      const athleteId = Number(params[0]);
      if (athleteId !== SCENARIO.athleteId) return [[], []];
      return [
        [
          {
            id: SCENARIO.athleteId,
            public_uuid: "athlete-uuid-1001",
            email: "athlete@test.local",
            first_name: "Test",
            last_name: "Athlete",
            stripe_customer_id: this.athleteStripeCustomerId,
          },
        ],
        [],
      ];
    }

    if (q.startsWith("update athletes set stripe_customer_id")) {
      this.athleteStripeCustomerId = String(params[0]);
      return [header(0, 1), []];
    }

    if (q.includes("from organizers o") && q.includes("where o.id = ?") && q.includes("deleted_at is null")) {
      const organizerId = Number(params[0]);
      if (organizerId !== SCENARIO.organizerId) return [[], []];
      return [[{ ...this.organizer }], []];
    }

    if (q.includes("select stripe_connect_status from organizers") && q.includes("deleted_at is null")) {
      const organizerId = Number(params[0]);
      if (organizerId !== SCENARIO.organizerId) return [[], []];
      return [[{ stripe_connect_status: this.organizer.stripe_connect_status }], []];
    }

    if (q.startsWith("update organizers set stripe_connect_last_synced_at")) {
      this.organizer.stripe_connect_last_synced_at = new Date().toISOString();
      return [header(0, 1), []];
    }

    if (q.startsWith("update organizers set") && q.includes("stripe_connect_status")) {
      this.organizer.stripe_account_id = String(params[0]);
      this.organizer.stripe_onboarding_complete = Number(params[1]);
      this.organizer.stripe_connect_status = String(params[2]);
      this.organizer.stripe_charges_enabled = Number(params[3]);
      this.organizer.stripe_payouts_enabled = Number(params[4]);
      this.organizer.stripe_details_submitted = Number(params[5]);
      if (Number(params[6]) === 1 && !this.organizer.stripe_connect_onboarded_at) {
        this.organizer.stripe_connect_onboarded_at = new Date().toISOString();
      }
      this.organizer.stripe_connect_last_synced_at = new Date().toISOString();
      if (params[7] != null) {
        this.organizer.stripe_connect_onboarding_mode = params[7];
      }
      return [header(0, 1), []];
    }

    if (q.includes("select requires_waiver from events")) {
      return [[{ requires_waiver: this.requiresWaiver ? 1 : 0 }], []];
    }

    if (q.startsWith("update payments set status = 'failed'") && q.includes("failure_code")) {
      const message = String(params[0]);
      const payId = Number(params[1]);
      const pay = this.payments.find((p) => p.id === payId);
      if (pay) {
        pay.status = "failed";
        (pay as PaymentRow & { failure_code?: string; failure_message?: string }).failure_code =
          "pi_create_failed";
        (pay as PaymentRow & { failure_message?: string }).failure_message = message;
      }
      return [header(0, pay ? 1 : 0), []];
    }

    if (q.includes("insert into stripe_webhook_events")) {
      const eventId = String(params[0]);
      if (this.webhookEvents.has(eventId)) {
        const err = new Error("Duplicate entry") as Error & { code?: string };
        err.code = "ER_DUP_ENTRY";
        throw err;
      }
      this.webhookEvents.set(eventId, {
        status: "processing",
        event_type: String(params[1]),
        error_message: null,
      });
      return [header(this.webhookEvents.size, 1), []];
    }

    if (q.includes("select status from stripe_webhook_events")) {
      const eventId = String(params[0]);
      const row = this.webhookEvents.get(eventId);
      return [row ? [{ status: row.status }] : [], []];
    }

    if (q.includes("update stripe_webhook_events") && q.includes("status = 'processing'")) {
      const eventId = String(params[0]);
      const row = this.webhookEvents.get(eventId);
      if (row) {
        row.status = "processing";
        row.error_message = null;
      }
      return [header(0, row ? 1 : 0), []];
    }

    if (q.includes("update stripe_webhook_events") && q.includes("status = 'processed'")) {
      const eventId = String(params[0]);
      const row = this.webhookEvents.get(eventId);
      if (row) row.status = "processed";
      return [header(0, row ? 1 : 0), []];
    }

    if (q.includes("update stripe_webhook_events") && q.includes("status = 'ignored'")) {
      const eventId = String(params[0]);
      const row = this.webhookEvents.get(eventId);
      if (row) row.status = "ignored";
      return [header(0, row ? 1 : 0), []];
    }

    if (q.includes("update stripe_webhook_events") && q.includes("status = 'failed'")) {
      const eventId = String(params[1]);
      const row = this.webhookEvents.get(eventId);
      if (row) {
        row.status = "failed";
        row.error_message = String(params[0]);
      }
      return [header(0, row ? 1 : 0), []];
    }

    if (q.startsWith("update payments set stripe_payment_intent_id")) {
      const piId = String(params[0]);
      const payId = Number(params[1]);
      const pay = this.payments.find((p) => p.id === payId);
      if (pay) {
        pay.stripe_payment_intent_id = piId;
        pay.status = "processing";
      }
      return [header(0, pay ? 1 : 0), []];
    }

    if (q.includes("select date_of_birth, gender from athletes")) {
      const athleteId = Number(params[0]);
      if (athleteId === SCENARIO.athleteId) {
        return [[{ ...this.athleteProfile }], []];
      }
      return [[], []];
    }

    if (q.includes("select id from events where slug")) {
      return [[{ id: SCENARIO.eventId }], []];
    }

    if (
      q.includes("select id from registrations") &&
      q.includes("status = 'confirmed'") &&
      q.includes("deleted_at is null")
    ) {
      const eventId = Number(params[0]);
      const athleteId = Number(params[1]);
      const hit = this.registrations.find(
        (r) =>
          r.event_id === eventId &&
          r.athlete_id === athleteId &&
          r.status === "confirmed" &&
          !r.deleted_at,
      );
      return [hit ? [{ id: hit.id }] : [], []];
    }

    if (q.includes("from event_categories") && q.includes("is_active = 1")) {
      const catId = Number(params[0]);
      const eventId = Number(params[1]);
      if (catId !== SCENARIO.categoryId || eventId !== SCENARIO.eventId) {
        return [[], []];
      }
      const row = this.categoryRow();
      if (q.includes("price_cents, currency")) {
        return [[{ id: row.id, price_cents: row.price_cents, currency: row.currency }], []];
      }
      return [[row], []];
    }

    if (q.includes("from discount_codes")) {
      const code = String(params[0] ?? "").toUpperCase();
      const eventId = Number(params[1]);
      const organizerId = Number(params[2]);
      const hit = this.discountCodes.find(
        (d) =>
          d.code.toUpperCase() === code &&
          d.is_active === 1 &&
          (d.event_id === eventId ||
            (d.event_id == null && d.organizer_id === organizerId)),
      );
      if (!hit) return [[], []];
      return [
        [
          {
            id: hit.id,
            code: hit.code,
            discount_type: hit.discount_type,
            discount_value: hit.discount_value,
            applies_to: hit.applies_to,
            min_purchase_cents: hit.min_purchase_cents,
            max_uses: hit.max_uses,
            used_count: hit.used_count ?? 0,
          },
        ],
        [],
      ];
    }

    if (q.includes("from event_registration_fields")) {
      return [this.fields.map((f) => ({ ...f })), []];
    }

    if (q.includes("from event_waivers") && q.includes("is_active = 1")) {
      return [this.waivers.map((w) => ({ ...w })), []];
    }

    if (q.includes("select version from event_waivers where id")) {
      const waiverId = Number(params[0]);
      const w = this.waivers.find((x) => x.id === waiverId);
      return [w ? [{ version: w.version }] : [], []];
    }

    if (q.includes("from waitlist_entries") && q.includes("status = 'offered'")) {
      const entryId = Number(params[0]);
      const athleteId = Number(params[1]);
      const eventId = Number(params[2]);
      const categoryId = Number(params[3]);
      const row = this.waitlist.find(
        (w) =>
          w.id === entryId &&
          w.athlete_id === athleteId &&
          w.event_id === eventId &&
          w.event_category_id === categoryId &&
          w.status === "offered",
      );
      return [row ? [{ id: row.id }] : [], []];
    }

    if (q.includes("from payments") && q.includes("idempotency_key")) {
      const key = String(params[0]);
      const athleteId = Number(params[1]);
      const hit = this.payments.find(
        (p) =>
          p.idempotency_key === key &&
          p.athlete_id === athleteId &&
          p.registration_id == null &&
          ["pending", "processing", "succeeded"].includes(p.status),
      );
      return [hit ? [{ public_uuid: hit.public_uuid }] : [], []];
    }

    if (q.startsWith("update payments set metadata_json")) {
      const metadata = String(params[0]);
      const amountCents = Number(params[1]);
      const registrationAmountCents = Number(params[2]);
      const serviceFeeCents = Number(params[3]);
      const uuid = String(params[4]);
      const pay = this.findPaymentByUuid(uuid);
      if (pay) {
        pay.metadata_json = metadata;
        pay.amount_cents = amountCents;
        pay.registration_amount_cents = registrationAmountCents;
        pay.service_fee_cents = serviceFeeCents;
      }
      return [header(0, pay ? 1 : 0), []];
    }

    if (q.includes("update discount_codes set used_count = used_count + 1")) {
      const id = Number(params[0]);
      const row = this.discountCodes.find((d) => d.id === id);
      if (row && (row.max_uses == null || (row.used_count ?? 0) < row.max_uses)) {
        row.used_count = (row.used_count ?? 0) + 1;
        return [header(0, 1), []];
      }
      return [header(0, 0), []];
    }

    if (q.startsWith("insert into payments")) {
      const pay: PaymentRow = {
        id: this.nextPaymentId++,
        public_uuid: String(params[0]),
        idempotency_key: String(params[1]),
        registration_id: params[2] as number | null,
        athlete_id: Number(params[3]),
        organizer_id: Number(params[4]),
        event_id: Number(params[5]),
        amount_cents: Number(params[6]),
        registration_amount_cents: Number(params[7]),
        service_fee_cents: Number(params[8]),
        currency: String(params[9]),
        status: String(params[10]),
        provider: String(params[11]),
        metadata_json: String(params[12]),
        stripe_payment_intent_id: null,
        stripe_charge_id: null,
        stripe_transfer_id: null,
        stripe_application_fee_id: null,
        paid_at: q.includes("paid_at") ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
      } as PaymentRow;
      this.payments.push(pay);
      return [header(pay.id, 1), []];
    }

    if (
      q.includes("select stripe_payment_intent_id, amount_cents from payments") &&
      q.includes("public_uuid")
    ) {
      const uuid = String(params[0]);
      const pay = this.findPaymentByUuid(uuid);
      return [
        pay
          ? [
              {
                stripe_payment_intent_id: pay.stripe_payment_intent_id,
                amount_cents: pay.amount_cents,
              },
            ]
          : [],
        [],
      ];
    }

    if (q.includes("select p.id, p.registration_id") && q.includes("public_uuid")) {
      const uuid = String(params[0]);
      const athleteId = Number(params[1]);
      const pay = this.payments.find((p) => p.public_uuid === uuid && p.athlete_id === athleteId);
      return [
        pay
          ? [
              {
                id: pay.id,
                registration_id: pay.registration_id,
                stripe_payment_intent_id: pay.stripe_payment_intent_id,
                provider: pay.provider,
                status: pay.status,
                amount_cents: pay.amount_cents,
              },
            ]
          : [],
        [],
      ];
    }

    if (q.includes("select provider, amount_cents from payments")) {
      const uuid = String(params[0]);
      const athleteId = Number(params[1]);
      const pay = this.payments.find((p) => p.public_uuid === uuid && p.athlete_id === athleteId);
      return [pay ? [{ provider: pay.provider, amount_cents: pay.amount_cents }] : [], []];
    }

    if (q.includes("from payments p") && q.includes("join events e") && q.includes("where p.public_uuid = ? and p.athlete_id = ? limit 1")) {
      const uuid = String(params[0]);
      const athleteId = Number(params[1]);
      const pay = this.payments.find((p) => p.public_uuid === uuid && p.athlete_id === athleteId);
      if (!pay) return [[], []];
      return [
        [
          {
            ...pay,
            event_title: SCENARIO.eventTitle,
            event_slug: SCENARIO.slug,
          },
        ],
        [],
      ];
    }

    if (
      q.includes("from payments p") &&
      q.includes("join events e") &&
      q.includes("registration_id is null") &&
      q.includes("order by p.created_at desc")
    ) {
      const athleteId = Number(params[0]);
      const slugFilter = q.includes("e.slug = ?") && params.length > 1 ? String(params[1]) : null;
      let rows = this.payments.filter(
        (p) =>
          p.athlete_id === athleteId &&
          p.registration_id == null &&
          ["pending", "processing", "succeeded"].includes(p.status),
      );
      if (slugFilter) {
        rows = rows.filter(() => slugFilter === SCENARIO.slug);
      }
      rows = rows.slice(0, slugFilter ? 1 : 5);
      return [
        rows.map((p) => ({
          public_uuid: p.public_uuid,
          amount_cents: p.amount_cents,
          currency: p.currency,
          status: p.status,
          created_at: p.created_at,
          metadata_json: p.metadata_json,
          event_title: SCENARIO.eventTitle,
          event_slug: SCENARIO.slug,
        })),
        [],
      ];
    }

    if (
      q.includes("from payments p") &&
      q.includes("join events e") &&
      q.includes("where p.public_uuid")
    ) {
      const uuid = String(params[0]);
      if (params.length >= 3) {
        const athleteId = Number(params[1]);
        const eventId = Number(params[2]);
        const pay = this.payments.find(
          (p) =>
            p.public_uuid === uuid &&
            p.athlete_id === athleteId &&
            p.event_id === eventId,
        );
        if (!pay) return [[], []];
        return [
          [
            {
              ...pay,
              event_title: SCENARIO.eventTitle,
              event_slug: SCENARIO.slug,
            },
          ],
          [],
        ];
      }
      if (params.length === 2) {
        const athleteId = Number(params[1]);
        const pay = this.payments.find(
          (p) => p.public_uuid === uuid && p.athlete_id === athleteId,
        );
        if (!pay) return [[], []];
        return [
          [
            {
              ...pay,
              event_title: SCENARIO.eventTitle,
              event_slug: SCENARIO.slug,
            },
          ],
          [],
        ];
      }
    }

    if (
      q.includes("from payments p") &&
      q.includes("join events e") &&
      q.includes("idempotency_key")
    ) {
      const key = String(params[0]);
      const athleteId = Number(params[1]);
      const eventId = Number(params[2]);
      const pay = this.payments
        .filter(
          (p) =>
            p.idempotency_key === key &&
            p.athlete_id === athleteId &&
            p.event_id === eventId &&
            p.registration_id == null,
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (!pay) return [[], []];
      return [
        [
          {
            ...pay,
            event_title: SCENARIO.eventTitle,
            event_slug: SCENARIO.slug,
          },
        ],
        [],
      ];
    }

    if (
      q.includes("from payments p") &&
      q.includes("join events e") &&
      q.includes("join athletes a") &&
      q.includes("for update")
    ) {
      const uuid = String(params[0]);
      const pay = this.findPaymentByUuid(uuid);
      if (!pay) return [[], []];
      return [
        [
          {
            ...pay,
            event_slug: SCENARIO.slug,
            event_title: SCENARIO.eventTitle,
            registration_opens_at: null,
            registration_closes_at: null,
            athlete_email: "athlete@test.local",
            athlete_first_name: "Test",
            athlete_preferred_language: "en",
          },
        ],
        [],
      ];
    }

    if (q.includes("select p.*") && q.includes("for update") && q.includes("public_uuid")) {
      const uuid = String(params[0]);
      const pay = this.findPaymentByUuid(uuid);
      if (!pay) return [[], []];
      return [
        [
          {
            ...pay,
            event_slug: SCENARIO.slug,
            event_title: SCENARIO.eventTitle,
            registration_opens_at: null,
            registration_closes_at: null,
            athlete_email: "athlete@test.local",
            athlete_first_name: "Test",
            athlete_preferred_language: "en",
          },
        ],
        [],
      ];
    }

    if (q.includes("select requires_waiver from events where id")) {
      return [[{ requires_waiver: this.requiresWaiver ? 1 : 0 }], []];
    }

    if (q.includes("select count(*) as c from registrations where event_id")) {
      const eventId = Number(params[0]);
      const count = this.registrations.filter((r) => r.event_id === eventId).length;
      return [[{ c: count }], []];
    }

    if (q.startsWith("insert into registrations")) {
      const reg: RegistrationRow = {
        id: this.nextRegistrationId++,
        public_uuid: String(params[0]),
        event_id: Number(params[1]),
        event_category_id: Number(params[2]),
        athlete_id: Number(params[3]),
        registration_number: String(params[4]),
        qr_code_token: String(params[5]),
        status: String(params[6]),
        price_cents: Number(params[7]),
        service_fee_cents: Number(params[8]),
        total_cents: Number(params[9]),
        discount_code_id: params[10] as number | null,
        currency: String(params[11]),
        source: String(params[12]),
        payment_id: Number(params[13]),
        deleted_at: null,
        waiver_signed_at: null,
      } as RegistrationRow;
      this.registrations.push(reg);
      return [header(reg.id, 1), []];
    }

    if (q.startsWith("insert into registration_field_values")) {
      return [header(this.nextFieldValueId++, 1), []];
    }

    if (q.includes("insert into registration_waiver_signatures")) {
      return [header(1, 1), []];
    }

    if (q.startsWith("update registrations set waiver_signed_at")) {
      const regId = Number(params[0]);
      const reg = this.registrations.find((r) => r.id === regId);
      if (reg) reg.waiver_signed_at = new Date().toISOString();
      return [header(0, reg ? 1 : 0), []];
    }

    if (q.startsWith("update payments set status = 'succeeded'")) {
      const regId = Number(params[0]);
      const chargeId = params[1] != null ? String(params[1]) : null;
      const piId = params[2] != null ? String(params[2]) : null;
      const transferId = params[3] != null ? String(params[3]) : null;
      const appFeeId = params[4] != null ? String(params[4]) : null;
      const payId = Number(params[5] ?? params[3]);
      const pay = this.payments.find((p) => p.id === payId);
      if (pay) {
        pay.status = "succeeded";
        pay.registration_id = regId;
        pay.paid_at = new Date().toISOString();
        if (chargeId) pay.stripe_charge_id = chargeId;
        if (piId) pay.stripe_payment_intent_id = piId;
        if (transferId) pay.stripe_transfer_id = transferId;
        if (appFeeId) pay.stripe_application_fee_id = appFeeId;
      }
      return [header(0, 1), []];
    }

    if (q.includes("update event_categories set sold_count = sold_count + 1")) {
      return [header(0, 1), []];
    }

    if (q.includes("update waitlist_entries") && q.includes("converted")) {
      const regId = Number(params[0]);
      const entryId = Number(params[1]);
      const athleteId = Number(params[2]);
      const row = this.waitlist.find(
        (w) => w.id === entryId && w.athlete_id === athleteId && w.status === "offered",
      );
      if (row) {
        row.status = "converted";
        row.converted_registration_id = regId;
      }
      return [header(0, row ? 1 : 0), []];
    }

    if (q.includes("update events set registration_count")) {
      return [header(0, 1), []];
    }

    if (
      q.includes("from registrations r") &&
      q.includes("join event_categories ec") &&
      q.includes("join events e")
    ) {
      const regId = Number(params[0]);
      const reg = this.registrations.find((r) => r.id === regId && !r.deleted_at);
      if (!reg) return [[], []];
      return [
        [
          {
            public_uuid: reg.public_uuid,
            registration_number: reg.registration_number,
            qr_code_token: reg.qr_code_token,
            status: reg.status,
            total_cents: reg.total_cents,
            category_name: this.category.name,
            event_title: SCENARIO.eventTitle,
            event_slug: SCENARIO.slug,
          },
        ],
        [],
      ];
    }

    if (
      q.includes("select id, stripe_payment_intent_id, provider, status") &&
      q.includes("idempotency_key <>")
    ) {
      return [[], []];
    }

    if (q.includes("from payments") && q.includes("registration_id is null") && q.includes("cancel")) {
      return [[], []];
    }

    if (
      q.startsWith("update payments set status = 'failed'") &&
      q.includes("superseded")
    ) {
      return [header(0, 0), []];
    }

    if (q.startsWith("update payments set status = 'cancelled'")) {
      return [header(0, 0), []];
    }

    throw new Error(`[ScenarioDb] Unhandled SQL: ${sql.slice(0, 160)}…`);
  };

  getConnection = async (): Promise<PoolConnection> => {
    const self = this;
    return {
      query: self.query,
      beginTransaction: async () => {
        self.txSnapshot = JSON.stringify({
          payments: self.payments,
          registrations: self.registrations,
          waitlist: self.waitlist,
        });
      },
      commit: async () => {
        self.txSnapshot = null;
      },
      rollback: async () => {
        if (self.txSnapshot) {
          const snap = JSON.parse(self.txSnapshot) as {
            payments: PaymentRow[];
            registrations: RegistrationRow[];
            waitlist: WaitlistRow[];
          };
          self.payments.length = 0;
          self.payments.push(...snap.payments);
          self.registrations.length = 0;
          self.registrations.push(...snap.registrations);
          self.waitlist.length = 0;
          self.waitlist.push(...snap.waitlist);
          self.txSnapshot = null;
        }
      },
      release: async () => {},
    } as unknown as PoolConnection;
  };

  asPool(): Pool {
    return {
      query: this.query,
      getConnection: this.getConnection,
    } as unknown as Pool;
  }

  /** Seed a paid Stripe checkout awaiting confirmation (resume → checkout state). */
  seedPendingStripeCheckout(opts: {
    publicUuid: string;
    idempotencyKey: string;
    amountCents?: number;
    metadata?: Record<string, unknown>;
  }): void {
    this.payments.push({
      id: this.nextPaymentId++,
      public_uuid: opts.publicUuid,
      idempotency_key: opts.idempotencyKey,
      registration_id: null,
      athlete_id: SCENARIO.athleteId,
      organizer_id: SCENARIO.organizerId,
      event_id: SCENARIO.eventId,
      amount_cents: opts.amountCents ?? 85000,
      registration_amount_cents: 80000,
      service_fee_cents: 5000,
      currency: "MXN",
      status: "processing",
      provider: "stripe",
      metadata_json: JSON.stringify(
        opts.metadata ?? {
          categoryId: SCENARIO.categoryId,
          categoryName: "10K Elite",
          fieldValues: {},
        },
      ),
      stripe_payment_intent_id: "pi_mock_processing",
      paid_at: null,
      created_at: new Date().toISOString(),
    } as PaymentRow);
  }
}

export function defaultWaiverSignatures() {
  return [
    { waiverId: 1, signature: WAIVER_ACCEPTANCE_SIGNATURE, waiverVersion: 2 },
    { waiverId: 2, signature: WAIVER_ACCEPTANCE_SIGNATURE, waiverVersion: 1 },
  ];
}

export const seeds = {
  freeOpen: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 100 },
  }),
  freeWithWaiver: (): ScenarioSeed => ({
    requiresWaiver: true,
    category: { price_cents: 0, capacity: 100 },
    waivers: [
      { id: 1, title: "General", version: 2 },
      { id: 2, title: "Medical", version: 1 },
    ],
  }),
  alreadyRegistered: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0 },
    athleteAlreadyRegistered: true,
  }),
  soldOutWaitlist: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 2, waitlist_enabled: true },
    confirmedRegistrationCount: 2,
  }),
  waitlistClaim: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 0, capacity: 2, waitlist_enabled: true },
    confirmedRegistrationCount: 2,
    waitlistOffer: { id: 501, status: "offered" },
  }),
  paidNoStripe: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 50000, capacity: 100 },
  }),
  paidWithDiscount: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 95000, capacity: 100 },
    discountCodes: [
      {
        id: 5,
        code: "EARLY10",
        discount_type: "percent",
        discount_value: 10,
        applies_to: "total",
      },
    ],
  }),
  freeWithFullDiscount: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 50000, capacity: 100 },
    discountCodes: [
      {
        id: 6,
        code: "FREE100",
        discount_type: "percent",
        discount_value: 100,
        applies_to: "total",
      },
    ],
  }),
  paidConnectReady: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 80_000, capacity: 100 },
    organizer: {
      legal_name: "Trail MX SA",
      rfc: "TRM123456ABC",
      billing_email: "billing@trail.mx",
      payout_terms_accepted_at: "2026-01-01 00:00:00",
      payout_fee_acknowledged_at: "2026-01-01 00:00:00",
      fee_presentation: "pass_through",
      stripe_account_id: "acct_test_ready",
      stripe_onboarding_complete: 1,
      stripe_connect_status: "ready",
      stripe_charges_enabled: 1,
      stripe_payouts_enabled: 1,
      stripe_details_submitted: 1,
      stripe_connect_onboarded_at: "2026-01-01 00:00:00",
    },
  }),
  paidConnectAbsorbAll: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 100_000, capacity: 100 },
    organizer: {
      legal_name: "Trail MX SA",
      rfc: "TRM123456ABC",
      billing_email: "billing@trail.mx",
      payout_terms_accepted_at: "2026-01-01 00:00:00",
      payout_fee_acknowledged_at: "2026-01-01 00:00:00",
      fee_presentation: "absorb_all",
      stripe_account_id: "acct_test_ready",
      stripe_onboarding_complete: 1,
      stripe_connect_status: "ready",
      stripe_charges_enabled: 1,
      stripe_payouts_enabled: 1,
      stripe_details_submitted: 1,
      stripe_connect_onboarded_at: "2026-01-01 00:00:00",
    },
  }),
  paidConnectNotReady: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 50_000, capacity: 100 },
    organizer: {
      stripe_account_id: "acct_test_pending",
      stripe_connect_status: "pending",
      stripe_charges_enabled: 0,
      stripe_payouts_enabled: 0,
    },
  }),
  paidConnectDisabled: (): ScenarioSeed => ({
    requiresWaiver: false,
    category: { price_cents: 50_000, capacity: 100 },
    organizer: {
      legal_name: "Trail MX SA",
      rfc: "TRM123456ABC",
      billing_email: "billing@trail.mx",
      payout_terms_accepted_at: "2026-01-01 00:00:00",
      payout_fee_acknowledged_at: "2026-01-01 00:00:00",
      stripe_account_id: "acct_test_disabled",
      stripe_connect_status: "disabled",
      stripe_charges_enabled: 0,
      stripe_payouts_enabled: 0,
    },
  }),
};