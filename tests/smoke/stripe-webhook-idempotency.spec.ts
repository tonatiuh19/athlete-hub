import { describe, it, expect } from "vitest";
import type { Pool } from "mysql2/promise";
import type Stripe from "stripe";
import {
  claimStripeWebhookEvent,
  markStripeWebhookEventProcessed,
} from "../../server/stripeWebhook";

function mockWebhookPool() {
  const rows = new Map<string, { status: string }>();

  return {
    rows,
    pool: {
      query: async (sql: string, params: unknown[] = []) => {
        const q = sql.replace(/\s+/g, " ").trim().toLowerCase();
        if (q.includes("insert into stripe_webhook_events")) {
          const id = String(params[0]);
          if (rows.has(id)) {
            const err = new Error("dup") as Error & { code?: string };
            err.code = "ER_DUP_ENTRY";
            throw err;
          }
          rows.set(id, { status: "processing" });
          return [{ insertId: 1, affectedRows: 1 }, []];
        }
        if (q.includes("select status from stripe_webhook_events")) {
          const id = String(params[0]);
          const row = rows.get(id);
          return [row ? [{ status: row.status }] : [], []];
        }
        if (q.includes("status = 'processing'") && q.includes("update stripe_webhook_events")) {
          const id = String(params[0]);
          const row = rows.get(id);
          if (row) row.status = "processing";
          return [{ affectedRows: row ? 1 : 0 }, []];
        }
        if (q.includes("status = 'processed'")) {
          const id = String(params[0]);
          const row = rows.get(id);
          if (row) row.status = "processed";
          return [{ affectedRows: row ? 1 : 0 }, []];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    } as unknown as Pool,
  };
}

function stripeEvent(id: string): Stripe.Event {
  return {
    id,
    type: "payment_intent.succeeded",
    created: Date.now() / 1000,
    livemode: false,
  } as Stripe.Event;
}

describe("stripe webhook idempotency", () => {
  it("claims a new event for processing", async () => {
    const { pool } = mockWebhookPool();
    const claim = await claimStripeWebhookEvent(pool, stripeEvent("evt_new"));
    expect(claim.action).toBe("process");
  });

  it("skips already processed duplicates", async () => {
    const { pool, rows } = mockWebhookPool();
    rows.set("evt_done", { status: "processed" });
    const claim = await claimStripeWebhookEvent(pool, stripeEvent("evt_done"));
    expect(claim).toEqual({ action: "skip", reason: "duplicate_processed" });
  });

  it("re-claims failed events for retry", async () => {
    const { pool, rows } = mockWebhookPool();
    rows.set("evt_retry", { status: "failed" });
    const claim = await claimStripeWebhookEvent(pool, stripeEvent("evt_retry"));
    expect(claim.action).toBe("process");
    expect(rows.get("evt_retry")?.status).toBe("processing");
  });

  it("marks events processed", async () => {
    const { pool, rows } = mockWebhookPool();
    await claimStripeWebhookEvent(pool, stripeEvent("evt_mark"));
    await markStripeWebhookEventProcessed(pool, "evt_mark");
    expect(rows.get("evt_mark")?.status).toBe("processed");
  });
});

describe("Connect refund parameters", () => {
  it("uses reverse_transfer and refund_application_fee for destination charges", async () => {
    const refundCalls: Array<Record<string, unknown>> = [];
    const mockStripe = {
      refunds: {
        create: async (params: Record<string, unknown>) => {
          refundCalls.push(params);
          return { id: "re_test" };
        },
      },
    };

    await mockStripe.refunds.create({
      payment_intent: "pi_test",
      reverse_transfer: true,
      refund_application_fee: true,
    });

    expect(refundCalls[0]).toEqual({
      payment_intent: "pi_test",
      reverse_transfer: true,
      refund_application_fee: true,
    });
  });
});
