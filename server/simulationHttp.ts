import type { Express, Response } from "express";
import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  CATEGORY_SOLD_COUNT_UNALIASED_SQL,
  WAVE_REGISTERED_COUNT_SQL,
} from "./registrationCounts.js";
import {
  cleanupExpiredSimulations,
  resolveSimulationByToken,
} from "./simulation.js";
import {
  SIMULATION_MAX_REGS_PER_EVENT,
  SIMULATION_TTL_DAYS,
  STRIPE_TEST_CARDS,
} from "../shared/simulation.js";
import {
  computeCheckoutBreakdown,
  resolveFeePresentation,
  resolveServiceFeePercent,
} from "../shared/checkoutBreakdown.js";
import { fetchActiveRegistrationFieldsForEvent } from "./registrationFields.js";
import { fetchActiveEventWaiversPublic } from "./eventWaivers.js";
import { fetchEventExtras } from "./eventExtras.js";

type AuthedRequest = import("express").Request & {
  auth?: { actor: string; id: number; organizerId?: number };
};

function formatMxn(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`;
}

export function registerSimulationPublicRoutes(
  app: Express,
  deps: {
    pool: Pool;
    optionalAthleteAuth: import("express").RequestHandler;
    getStripeTestPublishableKey: () => string;
    isStripeTestConfigured: () => boolean;
    getStripeTestClient: () => import("stripe").default | null;
    cronSecret: string;
  },
): void {
  const {
    pool,
    optionalAthleteAuth,
    getStripeTestPublishableKey,
    isStripeTestConfigured,
    getStripeTestClient,
    cronSecret,
  } = deps;

  app.get(
    "/api/sim/:token",
    optionalAthleteAuth,
    async (req: AuthedRequest, res: Response) => {
      const token = String(req.params.token ?? "").trim();
      const event = await resolveSimulationByToken(pool, token);
      if (!event) {
        return res.status(404).json({ error: "Simulation not found", code: "simulation_not_found" });
      }

      const expired =
        event.simulation_expires_at != null &&
        new Date(String(event.simulation_expires_at)).getTime() < Date.now();

      const [categories] = await pool.query<RowDataPacket[]>(
        `SELECT id, public_uuid, name, description, distance_km, difficulty, capacity,
                ${CATEGORY_SOLD_COUNT_UNALIASED_SQL} AS sold_count,
                price_cents, currency, gender_restriction, min_age, max_age, waitlist_enabled, sort_order
         FROM event_categories
         WHERE event_id = ? AND is_active = 1
         ORDER BY sort_order ASC`,
        [event.id],
      );

      const fields = await fetchActiveRegistrationFieldsForEvent(pool, Number(event.id));
      const feePercent = resolveServiceFeePercent(
        event.service_fee_percent as number | string | null,
        event.org_service_fee_percent as number | string | null,
      );
      const feePresentation = resolveFeePresentation(
        event.fee_presentation as string | null,
        event.org_fee_presentation as string | null,
      );
      const categoriesWithFees = categories.map((cat) => {
        const priceCents = Number(cat.price_cents);
        const breakdown = computeCheckoutBreakdown({
          listPriceCents: priceCents,
          serviceFeePercent: feePercent,
          feePresentation,
        });
        return {
          ...cat,
          service_fee_cents: breakdown.serviceFeeCents,
          total_cents: breakdown.athleteTotalCents,
          display_iva_cents: breakdown.displayIvaCents,
          organizer_fiscal_net_cents: breakdown.organizerFiscalNetCents,
          price_formatted: formatMxn(priceCents),
          service_fee_formatted: formatMxn(breakdown.serviceFeeCents),
          total_formatted: formatMxn(breakdown.athleteTotalCents),
        };
      });

      const [waves] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, starts_at, capacity,
                ${WAVE_REGISTERED_COUNT_SQL} AS registered_count, sort_order
         FROM event_schedule_waves WHERE event_id = ? ORDER BY sort_order ASC`,
        [event.id],
      );

      const waivers = await fetchActiveEventWaiversPublic(pool, Number(event.id));
      const extras = await fetchEventExtras(pool, Number(event.id));

      res.json({
        event: {
          ...event,
          is_simulation: true,
          simulation_expired: expired,
          simulation_ttl_days: SIMULATION_TTL_DAYS,
          simulation_max_regs: SIMULATION_MAX_REGS_PER_EVENT,
          payments_available: isStripeTestConfigured(),
          has_paid_categories: categoriesWithFees.some(
            (c) => Number((c as RowDataPacket).price_cents) > 0,
          ),
          service_fee_percent: feePercent,
          fee_presentation: feePresentation,
        },
        categories: categoriesWithFees,
        fields,
        extras,
        waivers,
        waves,
        sponsors: [],
        tags: [],
        course: null,
        simulation: {
          access_token: token,
          expires_at: event.simulation_expires_at,
          last_activity_at: event.simulation_last_activity_at,
          test_cards: STRIPE_TEST_CARDS,
          do_not_share: true,
          future_paid_feature: true,
        },
      });
    },
  );

  app.get("/api/sim/:token/stripe-config", async (req, res) => {
    const token = String(req.params.token ?? "").trim();
    const event = await resolveSimulationByToken(pool, token);
    if (!event) {
      return res.status(404).json({ error: "Simulation not found" });
    }
    if (!isStripeTestConfigured()) {
      return res.status(503).json({
        error: "Stripe test kit is not configured",
        code: "stripe_test_not_configured",
      });
    }
    res.json({
      mode: "simulation",
      publishableKey: getStripeTestPublishableKey(),
      currency: "mxn",
      test_cards: STRIPE_TEST_CARDS,
    });
  });

  app.post("/api/cron/cleanup-simulations", async (req, res) => {
    const auth = String(req.headers.authorization ?? "");
    const headerSecret = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const querySecret = String(req.query.secret ?? "").trim();
    const provided = headerSecret || querySecret;
    if (!cronSecret || provided !== cronSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const stripe = getStripeTestClient();
    const result = await cleanupExpiredSimulations(pool, {
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
    res.json({ ok: true, cleaned_events: result.events, details: result.details });
  });
}
