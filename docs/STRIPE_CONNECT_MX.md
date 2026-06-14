# Stripe Connect MX — Triboo

## Overview

Paid registrations use **Stripe Connect Express (Mexico)** with **destination charges** when the organizer is payout-ready.

If Connect onboarding is incomplete, checkout **falls back to a Triboo platform charge** (legacy path) so athletes on already-published paid events are not blocked. Staff still see payout alerts until Connect is complete.

When Connect is active (destination charges):

- Athlete pays inscription + platform service fee (IVA included in displayed amounts).
- Organizer receives `registration_amount_cents` on their Connect account.
- Triboo retains `service_fee_cents` as `application_fee_amount`.

Free ($0) events skip Connect and use the existing mock checkout path.

## Organizer flow

1. Admin creates organizer with `service_fee_percent` (default 11%).
2. Organizer completes **Triboo profile** + accepts terms at `/staff/payouts`.
3. Organizer clicks **Continue with Stripe** → Stripe-hosted onboarding.
4. Webhook `account.updated` syncs status to `organizers.stripe_connect_status`.
5. When `payoutReady`, new paid publishes use destination charges; checkout on existing events also switches to Connect automatically.

**Published event safeguards:** Adding or updating paid categories on a published event requires `payoutReady`. Event list/detail responses include `has_paid_categories` and `payments_available` for staff alerts.

## Admin assisted onboarding

Admins can start/resend Stripe links, sync status, link existing `acct_` IDs, or disable payouts.
**Stripe KYC/bank steps cannot be skipped** — admin assists, does not bypass.

## Testing (Stripe test mode)

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

stripe listen --forward-to localhost:8080/api/webhooks/stripe
```

1. Create organizer with fee calculator in admin UI.
2. Complete `/staff/payouts` as organizer owner.
3. Publish paid event → checkout with card `4242 4242 4242 4242`.
4. Verify Connect transfer + application fee in Stripe Dashboard (test mode).

## Migration

Apply `database/migrations/20260612_120000_stripe_connect_mx.sql` and update `schema.sql`.

## Webhook idempotency

Stripe events are recorded in `stripe_webhook_events` before processing. Duplicate `stripe_event_id` values return `200` with `{ duplicate: true }` without re-running handlers.
