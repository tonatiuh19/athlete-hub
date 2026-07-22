# Proposal: Mercado Pago as alternate payout / checkout rail

## Status

**Implemented (v1 foundation)** — see migration `20260718_010000_mercado_pago_rail.sql`, `server/mercadoPago.ts`, rail resolve in `server/stripeConnect.ts`, checkout branch in `api/index.ts`, staff Payouts rail UI, and `MercadoPagoCheckout` brick.

Configure env keys from `.env.example` / `.env` (`MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_PLATFORM_ACCESS_TOKEN`, `MP_PLATFORM_PUBLIC_KEY`, `MP_TOKEN_ENCRYPTION_KEY`).

### Automated edge coverage

See `tests/smoke/mercado-pago-edges.spec.ts` (+ `payout-rail`, checkout readiness, category Date eligibility):

- Rail matrix (preferred / fallback / block)
- Fee 11% vs 13% + absorb/pass_through on $250
- Luis age regression (mysql `Date` objects)
- Token encrypt/decrypt + `organizerMpReady` gates
- Checkout readiness for `provider: mercadopago`

**Still needs live sandbox once MP secrets are filled:** OAuth round-trip, Brick card pay, OXXO pending→webhook, refunds, group checkout rail.

**Status:** Product decisions locked — implement **after** [event payment profiles](./EVENT_PAYMENT_PROFILES_PROPOSAL.md)  
**Date:** 2026-07-17  
**Related:** [STRIPE_CONNECT_MX.md](./STRIPE_CONNECT_MX.md), [PAYMENT_CONTEXT.md](./PAYMENT_CONTEXT.md), [EVENT_PAYMENT_PROFILES_PROPOSAL.md](./EVENT_PAYMENT_PROFILES_PROPOSAL.md)

---

## 1. Problem

Organizers (and athletes) in Mexico often prefer **Mercado Pago** for wallet familiarity and **OXXO** cash. Today Triboo paid checkout is **Stripe Connect only** (plus mock/manual).

We need a second **receive rail**: organizer connects an MP account; athletes pay with a checkout brick that matches Triboo’s look; Triboo keeps a platform fee; inscription lands in the organizer’s MP account.

---

## 2. Locked decisions (Q1–Q11)

| ID | Choice | Meaning |
|----|--------|---------|
| **Q1** | **A** | Fees: Stripe **11%** / MP **13%** (+2). Show settlement timing in UI |
| **Q2** | **A** | Org picks **one** default rail: Stripe **or** MP (for all events) |
| **Q3** | **B** | MP is **org-level** in v1; designed so beneficiario profiles can add MP later (not in v1) |
| **Q4** | **B** | If chosen rail not ready → **fall back** to the other rail **if that one is ready**; else block |
| **Q5** | **B** | Methods: **cards + MP wallet + OXXO** |
| **Q6** | **A** | Settlement preference: **Instant only** (no 14/30 organizer picker) |
| **Q7** | **A** | Shared registration wizard chrome; swap payment brick only (same look & feel) |
| **Q8** | **C** | Full refunds in staff portal for **both** Stripe and MP from day one |
| **Q9** | **B** | Simulations stay Stripe-test / mock; **no MP on sims** |
| **Q10** | **B** | Build order: **event payment profiles first**, then MP |
| **Q11** | **A** | Platform MP application + **OAuth** so each org connects their own MP |

---

## 3. Goals (v1)

1. Org selects default payout/checkout rail: `stripe` | `mercadopago`.
2. Org completes MP OAuth (marketplace / split-ready model) under Triboo’s MP application.
3. Athlete checkout uses the same wizard; payment step embeds **MP Brick** (or equivalent embedded UI) styled to Triboo — not a naked redirect away from the brand (Checkout Pro full redirect is a fallback only if Brick cannot meet UX).
4. Triboo fee on MP path = **13%** (same `pass_through` / `absorb_all` presentation rules as Stripe).
5. Support **card, MP account balance/wallet, OXXO**.
6. Prefer **Instant** release for card/wallet where MP APIs allow configuration at platform/collector level.
7. Staff refunds for MP payments from Triboo (parity with Stripe).
8. Clear UI copy for **how long money takes** to land (see §5).

## 4. Non-goals (v1)

- Per-event MP accounts / MP on beneficiario profiles (schema-ready hooks only; profiles v1 remain **Stripe Connect**).
- Organizer choosing Instant vs 14 vs 30 in Triboo UI.
- PayPal.
- MP on simulation events.
- SPEI / other methods beyond card, wallet, OXXO (unless Brick enables them unavoidably — then document and gate).
- Changing athlete marketplace brand for beneficiario (orthogonal).

---

## 5. How long money takes (settlement timing)

Organizers care about two clocks: **payment confirmation** (athlete is registered) vs **funds available** in the MP account / withdrawable to bank.

### 5.1 What Triboo should show (staff + onboarding)

| Method | Athlete payment confirmed | Funds in MP account (typical MX) | Notes |
|--------|---------------------------|----------------------------------|--------|
| **Card** | Seconds–minutes | **Instant** release (our v1 target) | MP Instant fee tier ~3.49% + $4 + IVA (PSP); Triboo still charges **13%** total platform fee to organizer/athlete per fee presentation |
| **MP wallet / balance** | Seconds–minutes | **Instant** | Same Instant posture |
| **OXXO** | When cash is paid at store (voucher may sit unpaid) | Often **~3 days** after payment (MP cash rules; **not** Instant) | Voucher expiry; unpaid vouchers must **not** confirm registration |

**Bank withdrawal** from MP balance to CLABE is a separate MP user action/timing (often same day / next business day depending on MP account). Triboo should say:

> “El dinero se acredita en tu cuenta de Mercado Pago según el medio de pago. Con tarjeta o saldo MP apuntamos a acreditación **inmediata**. OXXO suele acreditar en unos **3 días** después de que el atleta pague en tienda. Retirar a tu banco lo gestiona Mercado Pago.”

Rates and exact accreditation windows are set by Mercado Pago and can change — UI copy should stay approximate (“inmediata” / “aprox. 3 días”) and link to MP help if needed.

### 5.2 Instant vs OXXO tension (explicit)

- **Q6A** = Instant for the org’s MP money-release preference (cards/wallet).
- **Q5B** = OXXO enabled; OXXO has its **own** longer accreditation (~3 days) and higher PSP fee (~3.79%+$4+IVA).
- Triboo still charges a single **13%** platform fee on the MP rail (no per-method Triboo %).
- **Risk:** OXXO + Instant fee posture may compress margin vs cards. **Monitor** after launch; if needed, later raise MP fee or disable OXXO.

### 5.3 Stripe comparison (for UI)

| Rail | Typical funds to organizer |
|------|----------------------------|
| Stripe Connect | After successful charge; payout to bank per Stripe Express schedule (often 2–7+ days to bank depending on account) |
| MP Instant (card/wallet) | Balance in MP **quickly**; bank cash-out via MP |
| MP OXXO | ~3 days to MP balance after store payment |

Staff “Configuración de cobros” should show a short **timing table** for the selected rail.

---

## 6. Fee model

| Rail | Triboo `service_fee_percent` | Who pays (presentation) |
|------|------------------------------|-------------------------|
| Stripe | **11%** (org/event override as today) | `pass_through` / `absorb_all` |
| Mercado Pago | **13%** when rail is MP | Same presentation modes |

- PSP processing costs (Stripe or MP) are **internal** — athlete sees Triboo fee lines only.
- When org rail = MP, checkout breakdown uses **13%** (unless product later adds org-level MP override; v1 = fixed +2 on MP rail).
- Event `service_fee_percent` override: **recommendation** — if set, it **replaces** the rail default (admin/org still responsible); if null, use 11 or 13 by rail. Confirm at implement time; default proposal = **rail default when event override null**.

---

## 7. Rail selection & fallback (Q2A + Q4B)

```text
organizer.payout_rail = 'stripe' | 'mercadopago'   // preferred
organizer has stripe_ready?  mercadopago_ready?

resolveCheckoutRail(org):
  preferred = org.payout_rail
  if preferred ready → use preferred
  else if other ready → use other (fallback)
  else → BLOCK paid checkout
```

Rules:

- Org **declares** one preferred rail (settings).
- Org may complete **both** Connect and MP OAuth so fallback works.
- Publish paid event: preferred ready **or** fallback ready (at least one).
- Sims: ignore MP; Stripe test / mock only (Q9B).
- Athlete does **not** pick the rail.

---

## 8. Architecture vs current Stripe checkout

### 8.1 Today (Stripe)

```text
WizardCheckoutStep
  → createRegistrationCheckout (api)
  → resolveCheckoutConnectMode(organizer)
  → PaymentIntent + application_fee + transfer_data.destination
  → StripeCheckout / Elements
  → confirm webhook / confirm endpoint
```

### 8.2 Target (dual rail)

```text
WizardCheckoutStep  (same chrome, order summary, discount, fields)
  → createRegistrationCheckout
  → resolveCheckoutRail(org)  // stripe | mercadopago | blocked
  → if stripe: existing Connect PI path (fee 11%)
  → if mp: create MP preference/payment + marketplace split
        fee 13% retained by platform; net to seller MP user
  → render StripeCheckout OR MercadoPagoBrick (same card shell)
  → provider-specific confirm + webhooks
  → unified registrations/payments rows (provider enum includes mercadopago)
```

### 8.3 MP money split (marketplace OAuth)

Target model (align with MP “Marketplace” / split payments for MX):

- Athlete pays **total** (list ± fee presentation).
- **Triboo** (platform) retains marketplace fee ≈ `service_fee_cents` at 13%.
- **Seller** (organizer MP user id from OAuth) receives inscription share.

Exact MP API (Checkout Bricks + `marketplace` / `application_fee` / `sponsor_id` / Order API) to be confirmed against current MP MX docs during spike — **do not invent split fields in code until spike passes**.

If split cannot retain Triboo fee cleanly in Brick v1, stop and re-decide (do not ship “collect on Triboo MP and pay organizers manually”).

### 8.4 Provider enum

Extend `payments.provider` (and refunds) with `'mercadopago'`.

Store MP ids: `mercadopago_payment_id`, `mercadopago_preference_id` / order id (columns or `metadata_json`).

---

## 9. Checkout UX (same look & feel)

- Keep: order summary, discount, legal notice, error codes, waitlist, phase details → payment.
- Payment panel: common header (“Pago”) + **one** provider brick inside the same bordered container.
- Loading / error / retry CTAs shared; map MP errors through `registrationCheckoutErrors` codes.
- OXXO: show voucher instructions **inside** the wizard (not a dead-end external page); registration stays **pending** until MP webhook confirms payment; expiry cancels pending payment (mirror Stripe abandoned PI cleanup patterns).

---

## 10. Refunds (Q8C)

| Provider | Staff portal | Behavior |
|----------|--------------|----------|
| Stripe | Already | reverse_transfer + refund_application_fee when Connect |
| MP | **Required v1** | Call MP refund API; update `refunds` + payment status; only owner/finance (same as Stripe) |

Partial refunds: match whatever Stripe path supports today; if MP partial is harder, full refunds first + document.

---

## 11. Data model (sketch)

### `organizers`

| Column | Purpose |
|--------|---------|
| `payout_rail` | `stripe` \| `mercadopago` preferred |
| `mp_user_id` / `mp_access_token` (encrypted) / refresh | OAuth seller |
| `mp_oauth_status` | not_started \| pending \| ready \| revoked \| … |
| `mp_ready_at`, last sync | Mirror Connect readiness idea |

Tokens: encrypt at rest; never send to client.

### Fee resolution

```text
rail = resolveCheckoutRail(org)
percent = event.service_fee_percent ?? (rail === 'mercadopago' ? 13 : org.service_fee_percent)
```

### Relation to beneficiario profiles

- Profiles v1 = **Stripe destinations only**.
- When org `payout_rail = mercadopago`, beneficiario custom Stripe profiles are **N/A** for checkout (or capability disabled while on MP — product rule TBD at implement).
- **Recommendation:** If preferred rail is MP, event payment profile assignment is ignored for destination; money goes to **org MP**. Stripe profiles remain for when rail is Stripe. Fallback to Stripe uses org Connect / profile rules as already specified.

---

## 12. Staff UX

1. **Configuración de cobros**
   - Rail selector: Cobros Triboo (Stripe) vs Mercado Pago.
   - Timing explainer (§5).
   - Stripe Connect checklist (existing) **and/or** “Conectar Mercado Pago” OAuth.
   - Status: ready / action required; fallback hint if the other rail is ready.
2. Fee calculator: show **11% vs 13%** depending on selected rail.
3. Payments list: provider badge `Stripe` | `Mercado Pago` | …; OXXO pending state.
4. Refund action works for both providers.

---

## 13. Webhooks & reliability

- `POST /api/webhooks/mercadopago` — verify signature; idempotent event log (like `stripe_webhook_events`).
- Handle: payment approved, rejected, refunded, OXXO pending/expired.
- Confirm registration only on **approved** (paid) — never on voucher created.

---

## 14. Build order (Q10B)

```text
Phase A ── Event payment profiles (Stripe beneficiario)     ← FIRST
Phase B ── Mercado Pago rail (this document)               ← SECOND
```

Do **not** start MP implementation until profiles Phase 1+2 are stable enough that checkout destination resolution won’t be rewritten twice—or isolate MP behind `resolveCheckoutRail` so profile resolve only runs when rail = stripe.

### MP implementation phases (after profiles)

| Phase | Work |
|-------|------|
| **MP-0 Spike** | MP MX marketplace OAuth + Brick + fee split in sandbox; OXXO pending lifecycle; prove 13% retain |
| **MP-1 Schema** | `payout_rail`, MP columns, provider enum, migrations |
| **MP-2 API** | OAuth start/callback, readiness, checkout create/confirm, webhooks, refunds |
| **MP-3 Client** | Rail settings UI, timing copy, `MercadoPagoBrick` beside Stripe, shared wizard shell |
| **MP-4 Hardening** | i18n EN/ES, swagger, smoke tests, fee calculator 13%, fallback matrix tests |

---

## 15. Implementation plan (against current Stripe path)

### Touch points (expected)

| Area | Change |
|------|--------|
| `shared/checkoutBreakdown.ts` | Caller passes rail-based percent (13 vs 11) |
| `server/stripeConnect.ts` / new `server/mercadoPago.ts` | OAuth, payment create, refund, webhook |
| `api/index.ts` | Checkout branch on rail; webhook route; refund branch |
| `payments` / `refunds` schema | `mercadopago` provider + MP ids |
| `WizardCheckoutStep.tsx` | Conditional brick; keep summary identical |
| `registrationCheckoutSlice.ts` | Checkout payload may return `provider` + MP public key / preference |
| `client/pages/staff/Payouts.tsx` | Rail + MP connect + timing |
| Sims | Force Stripe/mock; ignore org MP rail |
| Tests | Fallback matrix; OXXO pending; refund MP |

### Acceptance tests

1. Org preferred Stripe, Connect ready → 11%, Stripe brick.
2. Org preferred MP, MP ready → 13%, MP brick.
3. Preferred MP not ready, Stripe ready → fallback Stripe 11%.
4. Preferred Stripe not ready, MP ready → fallback MP 13%.
5. Neither ready → block paid checkout.
6. OXXO: voucher created → reg not confirmed; payment approved webhook → confirmed.
7. OXXO expired → pending cleared; athlete can retry.
8. Full refund from staff for MP payment.
9. Sim event never calls MP.
10. Wizard chrome identical aside from inner brick.
11. Staff sees Instant vs OXXO timing copy.

---

## 16. Risks & open engineering checks (spike)

1. **Marketplace fee retain** on Brick + OXXO in MX — must work or redesign.
2. **OXXO unpaid vouchers** — capacity holds? Recommendation: do **not** consume capacity until paid (or soft-hold with TTL).
3. **Token storage** — encryption, rotation, revoke on disconnect.
4. **PCI / Brick CSP** — allowlist MP scripts in CSP if any.
5. **Fee margin on OXXO** at 13% Instant org posture — monitor.
6. Interaction when **beneficiario profiles** enabled and rail = MP — follow §11 recommendation.

---

## 17. Decision log (raw)

```
Q1A  fees 11/13 + settlement timing UI
Q2A  one org default rail
Q3B  org-level MP; profile-compatible later
Q4B  fallback to other rail if ready
Q5B  cards + wallet + OXXO
Q6A  Instant only (no 14/30 picker)
Q7A  shared wizard; swap brick; same look & feel
Q8C  portal refunds for both
Q9B  sims = Stripe/mock only
Q10B profiles first, then MP
Q11A platform MP app + OAuth per org
```

---

## 18. Summary

Ship **Mercado Pago as an org-level alternate rail** with **13%** Triboo fee, **Instant** posture for card/wallet, **OXXO** with longer accreditation and pending-until-paid, **OAuth marketplace** split, **shared checkout chrome**, and **full portal refunds**. Implement **after** event payment profiles. Show organizers clearly **how long money takes** (immediate vs ~3 days OXXO vs bank cash-out via MP).
