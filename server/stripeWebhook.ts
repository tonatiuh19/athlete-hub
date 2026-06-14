import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type Stripe from "stripe";

export type StripeWebhookClaimResult =
  | { action: "process" }
  | { action: "skip"; reason: "duplicate_processed" | "duplicate_in_flight" };

export async function claimStripeWebhookEvent(
  pool: Pool,
  event: Stripe.Event,
): Promise<StripeWebhookClaimResult> {
  const payloadJson = JSON.stringify({
    id: event.id,
    type: event.type,
    created: event.created,
    livemode: event.livemode,
  });

  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO stripe_webhook_events (
         stripe_event_id, event_type, payload_json, status
       ) VALUES (?, ?, ?, 'processing')`,
      [event.id, event.type, payloadJson],
    );
    return { action: "process" };
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code)
        : "";
    if (code !== "ER_DUP_ENTRY") {
      throw err;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT status FROM stripe_webhook_events WHERE stripe_event_id = ? LIMIT 1`,
      [event.id],
    );
    const status = rows[0]?.status as string | undefined;
    if (status === "processed") {
      return { action: "skip", reason: "duplicate_processed" };
    }
    if (status === "processing") {
      return { action: "skip", reason: "duplicate_in_flight" };
    }

    await pool.query<ResultSetHeader>(
      `UPDATE stripe_webhook_events
       SET status = 'processing', error_message = NULL, processed_at = NULL
       WHERE stripe_event_id = ?`,
      [event.id],
    );
    return { action: "process" };
  }
}

export async function markStripeWebhookEventProcessed(
  pool: Pool,
  stripeEventId: string,
): Promise<void> {
  await pool.query<ResultSetHeader>(
    `UPDATE stripe_webhook_events
     SET status = 'processed', processed_at = NOW(), error_message = NULL
     WHERE stripe_event_id = ?`,
    [stripeEventId],
  );
}

export async function markStripeWebhookEventFailed(
  pool: Pool,
  stripeEventId: string,
  errorMessage: string,
): Promise<void> {
  await pool.query<ResultSetHeader>(
    `UPDATE stripe_webhook_events
     SET status = 'failed', processed_at = NOW(), error_message = ?
     WHERE stripe_event_id = ?`,
    [errorMessage.slice(0, 2000), stripeEventId],
  );
}
