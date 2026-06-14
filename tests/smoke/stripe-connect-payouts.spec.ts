import { describe, it, expect } from "vitest";
import type { Pool } from "mysql2/promise";
import type Stripe from "stripe";
import { computeCheckoutBreakdown, calcServiceFeeCents } from "@shared/checkoutBreakdown";
import {
  buildTribooPayoutChecklist,
  deriveStripeConnectStatusFromCapabilities,
  isOrganizerPayoutReady,
} from "@shared/stripeConnect";
import {
  persistOrganizerConnectFromStripeAccount,
  resolveCheckoutConnectMode,
} from "../../server/stripeConnect";

describe("checkout breakdown", () => {
  it("computes 11% service fee with IVA-inclusive totals", () => {
    const b = computeCheckoutBreakdown({ inscriptionCents: 100_000, serviceFeePercent: 11 });
    expect(b.serviceFeeCents).toBe(11_000);
    expect(b.totalCents).toBe(111_000);
    expect(b.organizerReceivesCents).toBe(100_000);
    expect(b.platformFeeCents).toBe(11_000);
  });

  it("calcServiceFeeCents matches breakdown helper", () => {
    expect(calcServiceFeeCents(80_000, 11)).toBe(8_800);
  });

  it("handles zero inscription without fee", () => {
    const b = computeCheckoutBreakdown({ inscriptionCents: 0, serviceFeePercent: 11 });
    expect(b.totalCents).toBe(0);
    expect(b.serviceFeeCents).toBe(0);
  });
});

describe("deriveStripeConnectStatusFromCapabilities", () => {
  it("maps fully enabled account to ready", () => {
    expect(
      deriveStripeConnectStatusFromCapabilities({
        disabled: false,
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        currently_due: [],
        disabled_reason: null,
        has_account: true,
      }),
    ).toBe("ready");
  });

  it("maps admin disabled to disabled regardless of capabilities", () => {
    expect(
      deriveStripeConnectStatusFromCapabilities({
        disabled: true,
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        currently_due: [],
        disabled_reason: null,
        has_account: true,
      }),
    ).toBe("disabled");
  });

  it("maps outstanding requirements to action_required", () => {
    expect(
      deriveStripeConnectStatusFromCapabilities({
        disabled: false,
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        currently_due: ["individual.verification.document"],
        disabled_reason: null,
        has_account: true,
      }),
    ).toBe("action_required");
  });
});

describe("payout readiness", () => {
  it("requires triboo profile and stripe ready", () => {
    const profile = {
      legal_name: "Trail MX SA",
      rfc: "TRM123456ABC",
      billing_email: "billing@trail.mx",
      payout_terms_accepted_at: "2026-01-01",
      payout_fee_acknowledged_at: "2026-01-01",
    };
    expect(buildTribooPayoutChecklist(profile).complete).toBe(true);
    expect(
      isOrganizerPayoutReady({
        stripe_connect_status: "ready",
        stripe_account_id: "acct_test",
        stripe_charges_enabled: true,
        stripe_payouts_enabled: true,
        requirements_currently_due: [],
        triboo_profile_complete: true,
      }),
    ).toBe(true);
    expect(
      isOrganizerPayoutReady({
        stripe_connect_status: "pending",
        stripe_account_id: "acct_test",
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
        triboo_profile_complete: true,
      }),
    ).toBe(false);
  });

  it("rejects ready stripe when triboo checklist incomplete", () => {
    expect(
      isOrganizerPayoutReady({
        stripe_connect_status: "ready",
        stripe_account_id: "acct_test",
        stripe_charges_enabled: true,
        stripe_payouts_enabled: true,
        requirements_currently_due: [],
        triboo_profile_complete: false,
      }),
    ).toBe(false);
  });

  it("rejects restricted or disabled connect status even when capabilities look fine", () => {
    expect(
      isOrganizerPayoutReady({
        stripe_connect_status: "restricted",
        stripe_account_id: "acct_test",
        stripe_charges_enabled: true,
        stripe_payouts_enabled: true,
        requirements_currently_due: [],
        triboo_profile_complete: true,
      }),
    ).toBe(false);
  });
});

describe("paid category mutation gate", () => {
  it("blocks paid category changes on published events when payout is not ready", async () => {
    const pool = {
      query: async (sql: string, params?: unknown[]) => {
        const q = sql.replace(/\s+/g, " ").trim().toLowerCase();
        if (q.includes("select status, organizer_id from events")) {
          return [[{ status: "published", organizer_id: 7 }], []];
        }
        if (q.includes("from organizers o") && q.includes("where o.id = ?")) {
          return [
            [
              {
                organizer_id: 7,
                email: "org@test.com",
                legal_name: null,
                billing_email: null,
                rfc: null,
                tax_regime: null,
                service_fee_percent: 11,
                stripe_account_id: null,
                stripe_onboarding_complete: 0,
                stripe_connect_status: "not_started",
                stripe_charges_enabled: 0,
                stripe_payouts_enabled: 0,
                stripe_details_submitted: 0,
                stripe_connect_onboarded_at: null,
                stripe_connect_last_synced_at: null,
                stripe_connect_onboarding_mode: null,
                payout_terms_accepted_at: null,
                payout_fee_acknowledged_at: null,
                status: "active",
              },
            ],
            [],
          ];
        }
        throw new Error(`unexpected query: ${q} ${JSON.stringify(params)}`);
      },
    };

    const { assertPaidCategoryMutationAllowed } = await import("../../server/stripeConnect.js");
    const err = await assertPaidCategoryMutationAllowed(
      pool as never,
      42,
      150000,
      null,
    );
    expect(err?.status).toBe(403);
    expect(err?.code).toBe("organizer_payouts_not_ready");
  });

  it("allows paid category changes on draft events without payout", async () => {
    const pool = {
      query: async (sql: string) => {
        const q = sql.replace(/\s+/g, " ").trim().toLowerCase();
        if (q.includes("select status, organizer_id from events")) {
          return [[{ status: "draft", organizer_id: 7 }], []];
        }
        throw new Error(`unexpected query: ${q}`);
      },
    };

    const { assertPaidCategoryMutationAllowed } = await import("../../server/stripeConnect.js");
    const err = await assertPaidCategoryMutationAllowed(pool as never, 42, 150000, null);
    expect(err).toBeNull();
  });
});

describe("resolveCheckoutConnectMode", () => {
  it("blocks checkout when organizer payout is not ready", async () => {
    const pool = {
      query: async (sql: string) => {
        const q = sql.replace(/\s+/g, " ").trim().toLowerCase();
        if (q.includes("from organizers o") && q.includes("where o.id = ?")) {
          return [
            [
              {
                organizer_id: 7,
                email: "org@test.com",
                legal_name: "Trail MX",
                billing_email: "billing@trail.mx",
                rfc: "TRM123456ABC",
                tax_regime: null,
                service_fee_percent: 11,
                stripe_account_id: null,
                stripe_onboarding_complete: 0,
                stripe_connect_status: "not_started",
                stripe_charges_enabled: 0,
                stripe_payouts_enabled: 0,
                stripe_details_submitted: 0,
                stripe_connect_onboarded_at: null,
                stripe_connect_last_synced_at: null,
                stripe_connect_onboarding_mode: null,
                payout_terms_accepted_at: "2026-01-01",
                payout_fee_acknowledged_at: "2026-01-01",
                status: "active",
              },
            ],
            [],
          ];
        }
        throw new Error(`unexpected query: ${q}`);
      },
    };

    const mode = await resolveCheckoutConnectMode(pool as never, 7, null);
    expect(mode).toEqual({
      mode: "blocked",
      code: "organizer_payouts_not_ready",
      message: "Organizer payout setup is not complete",
    });
  });
});

describe("persistOrganizerConnectFromStripeAccount", () => {
  it("skips capability overwrite when organizer is admin-disabled", async () => {
    const calls: string[] = [];
    const pool = {
      query: async (sql: string) => {
        const q = sql.replace(/\s+/g, " ").trim().toLowerCase();
        calls.push(q);
        if (q.includes("select stripe_connect_status")) {
          return [[{ stripe_connect_status: "disabled" }], []];
        }
        if (
          q.startsWith("update organizers set stripe_connect_last_synced_at") &&
          !q.includes("stripe_account_id")
        ) {
          return [{ affectedRows: 1 }, []];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    } as unknown as Pool;

    await persistOrganizerConnectFromStripeAccount(
      pool,
      7,
      {
        id: "acct_disabled",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: { currently_due: [], disabled_reason: null },
      } as Stripe.Account,
    );

    expect(calls.some((c) => c.includes("last_synced_at"))).toBe(true);
    expect(calls.some((c) => c.includes("stripe_connect_status ="))).toBe(false);
  });
});
