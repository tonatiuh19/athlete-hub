# Proposal: Per-event payout destinations (“Cuenta del evento” / “Beneficiario”)

**Status:** Product decisions locked — ready for implementation planning  
**Date:** 2026-07-17  
**Related:** [STRIPE_CONNECT_MX.md](./STRIPE_CONNECT_MX.md), [PAYMENT_CONTEXT.md](./PAYMENT_CONTEXT.md)

---

## 1. Problem

Some organizers act as **promoters**: one Triboo org / staff team runs many events, but **each event may need to pay out to a different bank / legal entity** (the event client / “beneficiario”).

Today Stripe Connect is **organization-scoped only**:

- `organizers.stripe_account_id` is the single destination for all events under that org.
- Events can override **fee % / fee presentation**, not the Connect destination.
- Checkout always resolves: `event.organizer_id` → org Connect account.

**Promoter commission is out of scope for Triboo/Stripe** (handled off-platform by contract). Triboo continues to take only the existing platform service fee.

---

## 2. Goals (v1)

1. Allow an org (when Triboo enables the capability) to define reusable **payment profiles** (“cuentas del evento” / “beneficiarios”), each with its own Stripe Express Connect account.
2. Require every **paid** event under a capability-enabled org to **explicitly assign** a payment profile before publish.
3. Destination charges send inscription money to the **assigned profile’s Connect account**.
4. Triboo always retains `service_fee_cents` as Stripe `application_fee_amount` (unchanged fee model).
5. Support KYC via: staff-assisted fill, **Triboo-branded invite link**, and Triboo admin link of existing `acct_`.
6. Freeze the assigned destination after the first paid registration on that event.
7. Show destination/profile on staff payment lists for promoter visibility.
8. Event clients see **payouts only in Stripe Express Dashboard** (no Triboo beneficiary payments portal in v1).

## 3. Non-goals (v1)

- Promoter commission inside Stripe / application fee.
- Multi-destination splits (event + promoter + Triboo) on one charge.
- True “sub-org” / child organizer entity.
- Triboo login for event clients to view payment ledgers.
- Changing athlete-facing brand / “beneficiario” name on marketplace (TBD later).
- Changing CFDI / fiscal invoice identity per profile (org fiscal remains source of truth for now; profile still **stores** legal name / email / RFC for KYC and ops).
- Mercado Pago / alternate PSPs for this flow (see [MERCADO_PAGO_PROPOSAL.md](./MERCADO_PAGO_PROPOSAL.md) — implement **after** this profiles work).

---

## 4. Locked product decisions

### 4.1 Money model — M1

| Party | Receives |
|-------|----------|
| **Beneficiario** (event-client Connect) | Inscription / registration amount (`stripeOrganizerTransferCents`) |
| **Triboo** | Platform service fee only (`application_fee_amount` = `service_fee_cents`) |
| **Promoter** | No automatic Stripe commission; any promoter fee is **off-platform** |

Fee inheritance stays as today: org `service_fee_percent` / `fee_presentation`, optional per-event overrides. Custom destination **cannot** zero or bypass Triboo fee.

### 4.2 Decision log (Q1–Q23)

| ID | Decision |
|----|----------|
| Q1 | Payment **profiles** under the org, assignable to events |
| Q2 | KYC: staff + invite link + admin link `acct_` |
| Q3 | Triboo admin must enable org capability first |
| Q4 / Q19 / Q23 | When capability is on → every paid event **must explicitly pick** a profile (including org/promoter default) |
| Q5 | Incomplete assigned profile → **block** paid checkout (never silently pay org) |
| Q6 | Owner + new **`promoter`** role can assign profile on events |
| Q7 | Owner + finance + Triboo admin can **create** profiles |
| Q8 | Freeze destination after first paid registration |
| Q9 | Athlete branding TBD (not v1) |
| Q10 | Org Connect must remain payout-ready always |
| Q11 | v1 = profiles + assign + block-if-incomplete + invite KYC |
| Q12 | Event clients see money in **Stripe Express only** |
| Q13 | Profile stores legal name, email, RFC |
| Q14 | Profiles are **reusable** across many events |
| Q15 / Q21 | `promoter` role is for **internal** staff in v1; external clients get **no Triboo login** (KYC invite + Stripe only) |
| Q16 | Invite emails branded as **Triboo** |
| Q17 | Refunds: promoter **owner/finance** in Triboo only |
| Q18 | Payment list shows which profile / destination was paid |
| Q20 | UI copy (ES): **“Cuenta del evento”** / **“Beneficiario”** |
| Q22 | Internal `promoter`: assign profiles, create profiles, view payments with destination; **cannot** refund; **cannot** edit org default Connect / Triboo fee |

---

## 5. Actors & permissions

### 5.1 Roles

| Actor | Triboo access | Payments visibility |
|-------|---------------|---------------------|
| Triboo admin | Enable capability; create/link profiles; support | Full admin |
| Org **owner** | Full org; create/assign profiles; refunds | Staff portal |
| Org **finance** | Create profiles; refunds; payouts | Staff portal |
| Org **`promoter`** (new) | Create profiles; assign to events (pre-freeze); view payments + destination | Staff portal; **no** refunds; **no** org Connect / fee settings |
| Event client / beneficiario | **None** in v1 | Stripe Express Dashboard only |

### 5.2 Capability gate

- Column/flag on `organizers`, e.g. `event_payment_profiles_enabled` (name TBD).
- Only Triboo admin can turn on/off.
- When **off**: behavior = today (all events → org Connect).
- When **on**: paid publish requires `events.payment_profile_id` set to a **payout-ready** profile.

### 5.3 Org default Connect (Q10)

Even with capability on:

- Org must keep its own Connect payout-ready.
- Org Connect is migrated/represented as a **default payment profile** (or a distinguished “org account” profile) that events can explicitly select.
- It is **not** a silent fallback when a custom profile is incomplete.

---

## 6. Target architecture

```text
organizers (capability flag + legacy Connect fields)
  ├── organizer_payment_profiles[]   ← beneficiarios / cuentas del evento
  │     ├── Triboo profile fields (legal_name, email, rfc, …)
  │     └── stripe_account_id + Connect status (same readiness rules as org)
  └── events
        └── payment_profile_id (required when capability on + paid)

Checkout resolve:
  if !capability → destination = org Connect (today)
  if capability → destination = event.payment_profile_id Connect
       if profile missing or !payoutReady → BLOCK paid checkout
  application_fee = service_fee_cents (always)
```

### 6.1 Money flow (pass-through example)

```text
Athlete pays list + Triboo fee
        │
        ▼
Stripe PaymentIntent (destination charge)
        ├── transfer → Beneficiario Connect (inscription)
        └── application_fee → Triboo (service fee)
```

Promoter compensation (if any) is outside this diagram.

### 6.2 Checkout resolution (replace org-only resolve)

Today: `resolveCheckoutConnectMode(pool, organizerId)`.

Target: `resolveCheckoutConnectMode(pool, { organizerId, eventId })`:

1. Load event + org capability + assigned profile (if any).
2. If capability off → existing org readiness path.
3. If capability on → load profile; require payout-ready; destination = `profile.stripe_account_id`.
4. Simulation events keep platform test path (no destination), unchanged in spirit.

Also fix/align **group checkout** to **block** when destination not ready (same as individual), before or as part of this work.

### 6.3 Freeze rule

After first **successful paid** payment/registration for an event:

- `payment_profile_id` becomes immutable (API 409 if change attempted).
- Unlock only via Triboo admin (optional later; not required for v1 if freeze is hard).

---

## 7. Data model (proposed)

> Exact column names to be finalized in migration; always update `database/schema.sql` via migration.

### 7.1 `organizers` (additions)

| Column | Purpose |
|--------|---------|
| `event_payment_profiles_enabled` | TINYINT capability flag (admin-only) |

Keep existing `stripe_*` columns as source of org Connect; backfill creates default profile.

### 7.2 `organizer_payment_profiles` (new)

Suggested fields:

| Column | Purpose |
|--------|---------|
| `id`, `public_uuid` | Identity |
| `organizer_id` | Owning promoter org |
| `label` | Internal name (e.g. “Maratón Puebla 2026 — Club X”) |
| `legal_name`, `email`, `rfc` | Beneficiario identity (Q13) |
| `is_org_default` | Marks migrated org Connect profile (at most one per org) |
| `stripe_account_id` | Express `acct_…` |
| `stripe_connect_status`, charges/payouts flags, requirements JSON, timestamps | Mirror org Connect sync model |
| `invite_token` / `invite_expires_at` | For Triboo-branded KYC invite |
| `created_by_member_id`, timestamps, `deleted_at` | Audit |

Unique: `(organizer_id, stripe_account_id)` where account not null; soft-delete aware.

### 7.3 `events` (additions)

| Column | Purpose |
|--------|---------|
| `payment_profile_id` | FK → `organizer_payment_profiles.id` NULL when capability off |
| `payment_profile_locked_at` | Set on first paid success (freeze) |

### 7.4 `payments` (additions)

| Column | Purpose |
|--------|---------|
| `payment_profile_id` | Snapshot of destination used |
| Optional denormalized `stripe_destination_account_id` | Audit / list UI |

Refunds continue to use stored PI / transfer ids (`server/stripeRefunds.ts`); destination reverse remains PI-scoped.

### 7.5 `organizer_members.role`

Extend ENUM with `'promoter'`.

---

## 8. Readiness rules

Reuse the same conceptual gate as org Connect (`isOrganizerPayoutReady` / Triboo checklist), applied **per profile**:

- Profile Triboo fields complete (legal_name, email, rfc as required by product).
- Stripe Express: status ready, charges + payouts enabled, no `currently_due`.
- Terms: decide whether org-level payout terms cover all profiles, or profile must accept once — **recommendation:** org terms cover destination use; profile still completes Stripe KYC.

Publish / paid-category guards:

- Capability on + event has paid categories → assigned profile payout-ready.
- Capability off → org payout-ready (today).

---

## 9. UX (staff)

### 9.1 Navigation / copy (ES)

- Section: **Cuentas del evento** / **Beneficiarios**
- Event setting: **Cuenta del evento (beneficiario)** — required select when capability on

### 9.2 Flows

1. **Triboo admin** enables capability on organizer.
2. Migration/backfill: org Connect → `is_org_default` profile.
3. Owner / finance / promoter create additional beneficiarios.
4. KYC:
   - Continue with Stripe (staff), or
   - Send Triboo invite email to beneficiario, or
   - Admin links existing `acct_`.
5. On event create/edit: **must** select a profile (including org default).
6. Publish paid event blocked until profile ready.
7. After first paid reg: profile selector locked; badge “Cuenta bloqueada”.
8. Payments list: column **Beneficiario** / profile label.

### 9.3 Event client (beneficiario)

- Receives Triboo-branded invite → Stripe-hosted onboarding.
- Later: Stripe Express login link (from staff or Stripe) to see balances/payouts.
- **No** Triboo staff account in v1.

---

## 10. API surface (sketch)

All under existing staff auth + new permission checks.

| Endpoint (sketch) | Who | Purpose |
|-------------------|-----|---------|
| `GET/POST /api/organizer/payment-profiles` | owner, finance, promoter | List/create |
| `GET/PATCH /api/organizer/payment-profiles/:id` | as above | Update label/identity |
| `POST .../onboard` | as above | Stripe Account Link for profile |
| `POST .../invite` | as above | Create/send KYC invite |
| `POST .../sync` | as above | Pull Stripe status |
| Admin: enable capability, link `acct_` to profile | Triboo admin | Support |
| Event create/update | owner, organizer?, promoter | Set `payment_profile_id` (promoter + owner per Q6; align organizer if needed) |
| Checkout | athlete | Resolve destination via event profile |

Webhook `account.updated`: resolve by `metadata.payment_profile_id` (and/or `stripe_account_id` lookup on profiles), not only `organizer_id`.

---

## 11. Migration plan

1. Add tables/columns via `database/migrations/YYYYMMDD_HHMMSS_event_payment_profiles.sql`.
2. Backfill: for each organizer with `stripe_account_id`, insert `is_org_default` profile; copy Connect status fields.
3. For orgs with capability **off**: leave `events.payment_profile_id` NULL; checkout uses org path.
4. When admin enables capability: require events with paid categories to set profile before next publish / before checkout (existing published events: staff must assign; until then block paid checkout or force assign org-default — **recommendation:** on enable, auto-assign org-default profile to existing events that lack one, then staff can change until freeze).
5. Update `database/schema.sql`, `swagger.yaml` if API changes, staff UI i18n EN+ES.

---

## 12. Edge cases & rules

| Case | Behavior |
|------|----------|
| Capability off | Today’s org-only Connect |
| Capability on, no profile on paid event | Block publish / block checkout |
| Profile assigned but not ready | Block paid checkout; free categories OK |
| Change profile after freeze | Reject |
| Reuse profile on many events | Allowed |
| Same Stripe `acct_` on two orgs | Forbidden (same as today admin link uniqueness) |
| Refund | Owner/finance; Stripe reverse_transfer to original destination |
| Dispute | Handled on the charge’s connected account / platform as Stripe rules dictate |
| Simulation events | Keep test/platform path; profile rules TBD (recommend: skip custom destination or require ready test accounts) |
| Group checkout | Must block when destination not ready (parity with solo) |
| Absorb_all fee presentation | Still works; transfer cents = list − fee; destination = profile |

---

## 13. Implementation phases

### Phase 0 — Preconditions

- Align group checkout “not ready” behavior with individual (block).
- Confirm Stripe Connect Express metadata strategy for profiles.

### Phase 1 — Data + resolve

- Schema + backfill default profiles.
- Capability flag (admin).
- Checkout/publish resolve by `payment_profile_id`.
- Freeze after first paid payment.
- Payments snapshot + staff list column.

### Phase 2 — Staff UX + KYC

- Cuentas del evento CRUD.
- Stripe onboard per profile.
- Triboo-branded invite KYC.
- Admin link `acct_`.
- Event required profile picker.
- Role `promoter` + permissions (Q22B).

### Phase 3 — Hardening

- Smoke/integration tests (Date-safe readiness, freeze, resolve matrix).
- Docs update (`STRIPE_CONNECT_MX.md` section).
- Optional: DESIGN_SYSTEM notes for new staff screens.

### Explicitly later

- Beneficiario Triboo read-only portal.
- Per-profile fiscal/CFDI.
- Athlete-facing beneficiario naming.
- Promoter commission in Stripe (rejected for now).

---

## 14. Test plan (acceptance)

1. Capability off → paid event still pays org Connect; Triboo fee intact.
2. Capability on → cannot publish paid event without profile.
3. Org-default profile selected → money to org `acct_`; fee to Triboo.
4. Second profile ready → money to that `acct_`; fee to Triboo.
5. Profile incomplete → athlete checkout blocked with clear code/message.
6. After first paid reg → profile change API fails.
7. Invite email is Triboo-branded; completing KYC marks profile ready.
8. Admin can link existing Express account to a profile.
9. `promoter` member can create/assign profiles; cannot refund; cannot change org fee/Connect settings.
10. Payments list shows beneficiario label.
11. Refund from owner/finance reverses transfer on the profile destination.
12. Group + solo checkout both block when profile not ready.

---

## 15. Open items (small, do not block spec)

1. Exact English/Spanish i18n keys and staff nav placement.
2. Whether org payout terms acceptance is sufficient for all profiles (recommended yes).
3. Auto-assign org-default on capability enable for existing events (recommended yes).
4. Simulation event behavior with capability on.
5. Whether role `organizer` (non-promoter) can assign profiles — locked as **owner + promoter** only; confirm `finance` assign vs create-only (create = yes; assign = follow Q6 → owner + promoter; finance creates but may need assign for ops — **recommendation:** finance can also assign, consistent with payout ownership).

> **Clarification recommendation:** allow **owner + finance + promoter** to assign profiles on events (finance already trusted for money). Product locked Q6 as owner + promoter; implementers should confirm if finance assign is desired before coding permissions.

---

## 16. Summary

Build **org-scoped payment profiles** (“Cuenta del evento” / “Beneficiario”), assignable per event when Triboo enables the org. Checkout destination becomes the profile’s Connect account; **Triboo fee unchanged**; **no** in-Stripe promoter commission; event clients use **Stripe Express** for money visibility; promoter staff (including new **`promoter`** role) manage profiles and see destination on payment lists inside Triboo.
