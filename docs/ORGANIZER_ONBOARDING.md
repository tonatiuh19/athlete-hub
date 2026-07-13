# Organizer Onboarding — Product & UX Proposal

## Executive summary

Today, **every new organizer is created by a platform admin** (`StaffCreateOrganizerDialog` → `POST /api/admin/organizers`). Public visitors who click **“Staff access”** in the footer reach `/staff/login`, which **only works if an account already exists** — unknown emails get *“No staff account found.”*

This document proposes a **mobile-first, self-service onboarding** path reachable from the footer, designed so **non-technical users can register without help**, while **keeping Triboo safe** through existing **event approval** (nothing goes public until an admin publishes).

**Your intuition is correct:** organizers can safely build events in the portal; **admin approval is required before marketplace visibility and athlete registration on paid flows.**

---

## Current state (audit)

### How organizers are created today

| Step | Who | Where |
|------|-----|--------|
| 1 | Platform admin logs in | `/staff/login` (OTP) |
| 2 | Admin opens People → Organizers | `/staff/people?tab=organizers` |
| 3 | Admin fills **Add organizer** dialog | `StaffCreateOrganizerDialog.tsx` |
| 4 | API creates org + owner | `POST /api/admin/organizers` |
| 5 | Owner receives welcome email | `sendStaffWelcomeEmail` |
| 6 | Owner logs in | `/staff/login` → `/staff` |

**Admin create sets `organizers.status = 'active'` and `organizer_members.status = 'active'` immediately** (not `pending`).

### Public entry points today

| Location | Link | Problem |
|----------|------|---------|
| `SiteFooter.tsx` | `/staff/login` — “Staff access” | Sounds internal; no signup |
| `HomeNavbar` | Athlete `/login` only | No organizer CTA |
| Public routes | None for organizers | No `/organizers/*` funnel |

### Staff login (`StaffLogin.tsx`)

- Email → 6-digit OTP (no password).
- Lookup order: **admin** first, then **active** `organizer_members`.
- Unknown email → **404** — dead end for new organizers.

### What organizers can do after login

Roles with event access (`owner`, `organizer`, `operations`, `marketing` per `shared/staffRoles.ts`):

| Action | Allowed? |
|--------|----------|
| Create event | ✅ Always saved as **`draft`** |
| Edit event (details, categories, media, waivers) | ✅ |
| Submit for approval | ✅ → `pending_approval` |
| Publish directly | ❌ **403** |
| Public marketplace listing | ❌ Only `published` events |
| Athlete paid checkout | ❌ Until published **and** payout ready (if paid) |

### Event approval workflow (safety net)

```
Organizer creates event     →  draft (server-enforced on POST)
Organizer submits           →  pending_approval (POST .../publish only)
Admin approves              →  published
Public marketplace/checkout →  status = 'published' only
```

**Server guards** (`server/staffPortal.ts`):

- Organizers **cannot** PATCH `status` to `published` or `pending_approval`.
- Paid events require **Stripe Connect payout ready** at submit-for-approval and admin publish.
- Public APIs filter `e.status = 'published'`.

**Verdict:** Self-service organizer signup **does not** create public risk **as long as event approval stays enforced** (already implemented and covered by `tests/smoke/organizer-event-approval.spec.ts`).

### Residual risks (to address in implementation)

| Risk | Severity | Mitigation in proposal |
|------|----------|------------------------|
| Spam / fake organizer accounts | Medium | OTP verification + rate limits + optional admin notification |
| `organizers.status` not checked on event APIs | Low | Allow `active` self-signups; block `suspended`/`inactive` on create |
| Admin PATCH can set `published` without checks | Admin-only | Out of scope; document for admin training |
| Self-service users confused by “Staff access” | UX | Footer rename + dedicated funnel |

---

## Product principles (mobile-first, all skill levels)

Design for a **60-year-old race director on a phone in bright sunlight** — not for a SaaS power user.

1. **One decision per screen** — max 1–2 inputs per step on mobile.
2. **Plain language** — “Your race or club name”, not “Organization slug”.
3. **Large touch targets** — min 48px height; generous spacing (`h-12`+ inputs).
4. **Progress you can feel** — “Step 2 of 5 · Your organization” with a visible bar.
5. **Forgiving validation** — explain errors in one short sentence; never blame the user.
6. **Optional stays optional** — phone, website, first-event date can be skipped.
7. **No dead ends** — every error offers “Try again” or “Contact us”.
8. **Spanish-first copy** — MX primary market; full EN parity.
9. **OTP, not passwords** — reuse proven staff login pattern (no password to forget).
10. **Immediate win** — after signup, land in portal with **one clear next step**: create first event.

---

## Proposed experience

### Footer entry (required)

Replace the ambiguous single link with two clear actions in `SiteFooter.tsx`:

| Label (ES) | Label (EN) | Route | Audience |
|------------|------------|-------|----------|
| **Organiza tu evento** | **Host an event** | `/organizers/start` | New organizers |
| **Acceso organizadores** | **Organizer login** | `/staff/login` | Returning organizers |

Keep admin access subtle (existing `/staff/login` works for admins too) or add “Platform admin” in footer legal row if needed later.

**Mobile footer:** stack links; **“Organiza tu evento”** as a soft CTA button (accent outline) above copyright.

---

### Route map (new public pages)

| Route | Purpose |
|-------|---------|
| `/organizers/start` | Marketing hero + “Start free” → wizard |
| `/organizers/signup` | Multi-step onboarding wizard |
| `/organizers/welcome` | Post-signup success + auto-redirect to portal |
| `/staff/login` | Unchanged — returning users |

All under `PublicSiteLayout` (footer + navbar) until OTP completes, then redirect to `/staff`.

---

### Onboarding wizard — 5 steps (mobile-first)

Use a full-viewport **stepper** component (new `OrganizerSignupWizard.tsx`), Formik + Yup per step, Redux `createOrganizerApplication` thunk.

#### Step 1 — Welcome (no form)

- Headline: **“Publish your race on Triboo”**
- Sub: registrations, payments, check-in — we handle the tech.
- Social proof: “2K+ events · 500K+ registrations” (reuse staff login stats).
- Primary CTA: **“Comenzar” / “Get started”** (large button).
- Secondary: “Already have an account? Sign in” → `/staff/login`.
- Optional 15s muted loop video (reuse brand panel pattern from `AuthBrandPanel`).

#### Step 2 — You (owner)

| Field | Required | UX notes |
|-------|----------|----------|
| First name | ✅ | `autoComplete="given-name"`, large input |
| Last name | ✅ | `autoComplete="family-name"` |
| Email | ✅ | `type="email"`, `autoComplete="email"` — becomes login |
| Phone | Optional | `type="tel"`, MX placeholder `+52 …` |

**Copy:** “This email is how you’ll sign in — we’ll send a code, no password.”

#### Step 3 — Your organization

| Field | Required | UX notes |
|-------|----------|----------|
| Organization name | ✅ | “Club, timing company, or race name” |
| City | ✅ | **`GeoCitySelector`** (catalog only — same validation as admin create) |
| Organization email | Optional | Defaults to owner email if empty |
| Phone | Optional | Org contact |

**Hidden from user (server-generated):** slug (from name), `service_fee_percent` (default 11), country `MX`.

**No RFC, legal name, fee calculator, or Stripe** in signup — those belong in `/staff/payouts` when they add paid categories.

#### Step 4 — First event (optional — skippable)

Soft questions to personalize welcome email and admin queue — **not** creating an event yet.

| Field | Required |
|-------|----------|
| Sport type | Optional (dropdown from active `sport_types`) |
| Rough date | Optional (month picker or “Not sure yet”) |
| Expected size | Optional chips: `<100`, `100–500`, `500+` |

**Skip button:** “Lo decido después / I’ll decide later”.

#### Step 5 — Verify email (OTP)

- Send OTP to owner email (reuse `POST /api/auth/staff/request-otp` **after** account exists, or combined register+OTP endpoint).
- Large `OtpInput` (same as `StaffLogin.tsx`).
- Resend with countdown.
- On verify → create session → redirect `/staff/onboarding` (first-run checklist).

#### Step 6 — Success / portal handoff

Redirect to **`/staff/onboarding`** (new lightweight page, not blocking):

- Confetti-free, calm success: **“You’re in! Let’s create your first event.”**
- Single primary CTA: **“Create event”** → `/staff/events/new`
- Secondary: “Explore dashboard” → `/staff`
- Checklist card (3 items):
  1. ☐ Create event draft
  2. ☐ Add categories & pricing
  3. ☐ Submit for Triboo review

Dismiss forever once first event created (localStorage or `organizer_members` preference).

---

### Wireframe (mobile)

```
┌─────────────────────────┐
│ ●●●○○  Step 3 of 5      │
│ Your organization       │
├─────────────────────────┤
│                         │
│  Organization name      │
│  ┌───────────────────┐  │
│  │ Triatlón Veracruz │  │
│  └───────────────────┘  │
│                         │
│  City                   │
│  ┌───────────────────┐  │
│  │ Veracruz, VER  ▼  │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │     Continue      │  │
│  └───────────────────┘  │
│       Skip for now      │
└─────────────────────────┘
```

---

## Backend proposal

### New public endpoint

```
POST /api/public/organizers/register
```

**Unauthenticated**, rate-limited (reuse `authRateLimit` pattern), body:

```json
{
  "owner_first_name": "…",
  "owner_last_name": "…",
  "owner_email": "…",
  "owner_phone": "…",
  "name": "…",
  "email": "…",
  "phone": "…",
  "city": "…",
  "country": "MX",
  "intake": {
    "sport_type_id": null,
    "rough_date": null,
    "expected_size": null
  },
  "locale": "es"
}
```

**Server behavior** (mirror admin create, simplified):

1. Validate required fields + catalog city (`normalizeOrganizerCity`).
2. Reject duplicate `organizers.email` or existing active member email (409 with friendly message).
3. Transaction:
   - `INSERT organizers` → **`status = 'active'`** (immediate portal access).
   - `INSERT organizer_members` → **`role = 'owner'`, `status = 'active'`**.
   - Optional: `INSERT organizer_applications` or JSON in `organizer_settings` for intake metadata + `self_service_registered_at`.
4. `sendStaffWelcomeEmail` to owner.
5. Optional: notify admins (email or dashboard badge) — “New self-service organizer: {name}”.
6. Return `{ organizer: { id, name, slug }, next: "verify_otp" }`.

**Do not expose:** admin-only fields (fee %, event assignment, Stripe).

### OTP flow after register

Option A (minimal change): Client calls existing `POST /api/auth/staff/request-otp` then `verify-otp` — works once member row exists.

Option B (smoother): Combined register returns short-lived token; verify in one round-trip — better UX, more work.

**Recommend Option A for v1.**

### Post-login gates (optional hardening)

| Gate | Recommendation |
|------|----------------|
| Organizer `suspended` / `inactive` | Block event create/submit (add server check) |
| Email not verified | Already enforced by OTP at signup |
| First event | No gate — draft is safe |

---

## Admin approval model — two layers

Clarify for stakeholders:

| Layer | What | Self-service proposal |
|-------|------|------------------------|
| **Organizer account** | Can access `/staff` portal | **Auto-active** on successful signup + OTP |
| **Event go-live** | Public listing + registration | **Admin approval required** (`pending_approval` → `published`) |

**No admin approval needed to start building** — only to go public.

Admin dashboard already surfaces pending events (`Dashboard.tsx` → `?status=pending_approval`). Optional: add **“New organizers (self-service)”** widget using `self_service_registered_at`.

---

## Returning user paths

| User | Footer action | Flow |
|------|---------------|------|
| New organizer | Organiza tu evento | Wizard → OTP → `/staff/onboarding` |
| Existing organizer | Acceso organizadores | `/staff/login` → OTP → `/staff` |
| Platform admin | Acceso organizadores | Same login (admin resolved first) |

---

## Content & trust (elderly-friendly)

- **Avoid:** slug, API, webhook, Connect, pass-through, MRU.
- **Use:** “Tu carrera en línea”, “Revisamos tu evento antes de publicarlo”, “Pagos seguros con tarjeta”.
- **Help block** on every wizard step (sticky footer):
  - “¿Necesitas ayuda?” → `mailto:soporte@triboosport.com` or WhatsApp (when available).
- **Accessibility:** `aria-live` for errors, focus management on step change, 16px+ base font on wizard.

---

## Implementation phases

### Phase 1 — MVP (footer + signup + portal access)

| Item | Files / work |
|------|----------------|
| Footer CTAs | `SiteFooter.tsx`, `en.json`, `es.json` |
| Public routes | `App.tsx` — `/organizers/start`, `/organizers/signup` |
| Wizard UI | `OrganizerSignupWizard.tsx`, step components |
| Redux slice | `organizerSignupSlice.ts` or extend `staffPortalSlice` |
| API | `POST /api/public/organizers/register` in `staffPortal.ts` or `api/index.ts` |
| Swagger | `api/swagger.yaml` |
| Rate limit | Public endpoint IP + email limits |
| OTP handoff | Reuse `staffAuthSlice` after register |
| First-run page | `/staff/onboarding` checklist |
| Tests | HTTP smoke: register → OTP → create draft event |

### Phase 2 — Polish

- Admin notification email on self-service signup
- Intake answers visible in `StaffOrganizerDetailSheet`
- Analytics events (signup funnel drop-off)
- Homepage hero secondary CTA “Organiza tu evento”
- Clerk/social not needed — OTP is enough for staff

### Phase 3 — Optional

- Application-only mode (`organizers.status = 'pending'`) behind feature flag for stricter markets
- In-app guided tour on first `EventEdit` (tooltips on checklist)
- WhatsApp OTP (Twilio exists but unused today)

---

## Success metrics

| Metric | Target |
|--------|--------|
| Signup completion (start → OTP verified) | > 70% |
| Time to first draft event | < 15 min median |
| Support tickets during signup | < 5% of signups |
| Admin approval turnaround | Track separately (ops KPI) |
| Mobile completion rate | ≥ desktop (proves mobile-first worked) |

---

## FAQ (stakeholder)

**Can organizers go live without us?**  
No. Submit → `pending_approval` → admin publish only.

**Can they charge money before we review?**  
Paid categories on drafts are allowed; **submit for approval** requires payout setup; **checkout** only on **published** events with `payments_available`.

**Why auto-active account instead of pending organizer?**  
Frictionless onboarding; event approval is the real safety gate. Pending org status blocked portal access with no user-visible benefit.

**Same email as athlete account?**  
Allowed — different auth realms (`athlete` vs `staff` JWT). Document in FAQ if same email can be both.

**Footer only?**  
Footer is required entry per spec; Phase 2 adds homepage and communities cross-links.

---

## Key files reference (current codebase)

| Area | Path |
|------|------|
| Footer | `client/components/SiteFooter.tsx` |
| Staff login | `client/pages/auth/StaffLogin.tsx` |
| Admin create organizer | `client/components/staff/StaffCreateOrganizerDialog.tsx` |
| Organizer API | `server/staffPortal.ts` (`POST /api/admin/organizers`) |
| Event create (organizer) | `server/staffPortal.ts` (`POST /api/organizer/events`) |
| Event approval | `server/staffPortal.ts` (publish/reject endpoints) |
| Role gates | `shared/staffRoles.ts` |
| Publish checklist UI | `client/components/staff/StaffEventPublishChecklist.tsx` |
| Event edit UI | `client/pages/staff/EventEdit.tsx` |
| Approval tests | `tests/smoke/organizer-event-approval.spec.ts` |
| Schema | `database/schema.sql` — `organizers`, `organizer_members` |

---

## Related docs

- [STRIPE_CONNECT_MX.md](./STRIPE_CONNECT_MX.md) — payout setup after signup
- [MOCK_DATA.md](./MOCK_DATA.md) — test accounts (dev only)
- [SANDBOX.md](./SANDBOX.md) — sandbox environment for safe QA

---

## Decision summary

| Question | Answer |
|----------|--------|
| Public self-service signup? | **Yes** — new `/organizers/signup` wizard |
| Footer entry? | **Yes** — “Organiza tu evento” + “Acceso organizadores” |
| Immediate portal access? | **Yes** — `active` org + owner on verified OTP |
| Risk to public marketplace? | **Low** — existing event approval + published-only APIs |
| Mobile-first? | **Primary design target** for wizard |
| Admin still in loop? | **For publish only** — not for account creation |

**Recommended next step:** implement Phase 1 (footer CTAs + 5-step wizard + public register API + onboarding handoff page).
