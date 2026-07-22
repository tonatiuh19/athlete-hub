# Triboo Sandbox Environment

- **IMPORTANT: This needs to be ignored for NOW**

## What this is (and is not)

**Sandbox** is a **second production deployment** of the same Triboo codebase — not a pre-production gate and not a throwaway preview.

|              | Production                                 | Sandbox                                              |
| ------------ | ------------------------------------------ | ---------------------------------------------------- |
| **Purpose**  | Real athletes, real money, real operations | Experiment, demo, QA, training — **same real stack** |
| **URL**      | `https://www.triboosport.com`              | `https://sandbox.triboosport.com`                    |
| **Database** | TiDB (shared)                              | **Same TiDB** (by design)                            |
| **Code**     | `main` (or release branch)                 | Same branch or `sandbox` — your choice               |
| **Stripe**   | Live keys (`sk_live_`)                     | **Test keys only** (`sk_test_`)                      |
| **Emails**   | Normal Triboo templates                    | Same templates + **Sandbox badge** + subject prefix  |
| **Audience** | Public                                     | Team + invited testers                               |

Because the database is shared, sandbox actions **can affect production records**. The strategy below minimizes confusion and makes test activity **visually and operationally obvious** — especially on payment confirmations and transactional email.

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │           TiDB Cloud (shared)        │
                    │  athletes · events · registrations   │
                    │  payments · organizers · settings    │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
   www.triboosport.com                      sandbox.triboosport.com
   Vercel Production env                    Vercel Sandbox env
   APP_ENV=production                        APP_ENV=sandbox
   Stripe LIVE                               Stripe TEST
   Clerk LIVE (pk_live_)                     Clerk DEV or LIVE*
   Resend LIVE                               Resend LIVE + sandbox badge
   JWT_SECRET (prod)                         JWT_SECRET (sandbox) **

   * Clerk: use a separate Development application on sandbox, OR the same
     Production Clerk app with sandbox URLs in Dashboard Paths (simpler SSO
     testing with real Google prod OAuth — pick one consciously).

   ** Always use a different JWT_SECRET per hostname so sessions never
      cross between www and sandbox.
```

---

## Core principle: `APP_ENV`

Introduce one server + build-time flag as the single source of truth:

```bash
APP_ENV=sandbox          # server (api/index.ts, staffPortal, emails)
VITE_APP_ENV=sandbox     # client banner, footer label (build-time on Vercel)
```

Allowed values: `production` | `sandbox` | `development` (local default).

**Detection fallback (client):** if `VITE_APP_ENV` unset, treat hostname `sandbox.triboosport.com` as sandbox.

Everything sandbox-specific flows from `APP_ENV`:

- Email subject prefix: `[Sandbox] `
- Email HTML badge (all templates via `emailShell`)
- Site-wide UI banner: “Sandbox — test environment, shared data”
- `/api/config/app` exposes `{ environment: "sandbox" }` for diagnostics
- Stripe webhook handler tags `livemode: false` payments (already logged today)

**Never set `ATHLETE_HUB_TEST_MODE=1` on Vercel** — that bypasses auth (Vitest only).

---

## Vercel setup

### 1. Project link

Fix local `.vercel/project.json` to the team that owns Triboo, then configure **two hostname targets** on the same project (or two projects pointing at the same repo — one project is simpler).

### 2. Domains

| Hostname                  | Vercel environment |
| ------------------------- | ------------------ |
| `www.triboosport.com`     | Production         |
| `sandbox.triboosport.com` | Production\*       |

\* Deploy sandbox with `vercel --prod` **scoped to sandbox env vars**, aliased to `sandbox.triboosport.com`. It is “production build” quality, not a ephemeral preview URL.

DNS:

```
sandbox.triboosport.com  CNAME  cname.vercel-dns.com
```

### 3. Environment variables

Copy Production → Sandbox scope, then **override** these:

| Variable                      | Sandbox value                                          |
| ----------------------------- | ------------------------------------------------------ |
| `APP_ENV`                     | `sandbox`                                              |
| `VITE_APP_ENV`                | `sandbox`                                              |
| `PUBLIC_APP_URL`              | `https://sandbox.triboosport.com`                      |
| `VITE_PUBLIC_APP_URL`         | `https://sandbox.triboosport.com`                      |
| `JWT_SECRET`                  | **Unique** (not prod secret)                           |
| `STRIPE_SECRET_KEY`           | `sk_test_...`                                          |
| `STRIPE_PUBLISHABLE_KEY`      | `pk_test_...`                                          |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...`                                          |
| `STRIPE_WEBHOOK_SECRET`       | Separate webhook endpoint secret for sandbox URL       |
| `CLERK_SECRET_KEY`            | `sk_test_...` (recommended) or live with sandbox Paths |
| `VITE_CLERK_PUBLISHABLE_KEY`  | matching publishable key                               |
| `CLERK_AUTHORIZED_PARTIES`    | `https://sandbox.triboosport.com`                      |

**Keep the same** `DB_*` credentials as production (shared database).

Optional sandbox-only toggles:

| Variable                   | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `SANDBOX_EMAIL_BADGE=1`    | Force badge even if `APP_ENV` mis-set (belt + suspenders) |
| `SANDBOX_SUBJECT_PREFIX=1` | Prefix all outbound email subjects                        |

### 4. Stripe webhook (sandbox)

Create a **second** webhook in Stripe Dashboard (test mode):

```
https://sandbox.triboosport.com/api/webhooks/stripe
```

Events: `payment_intent.succeeded`, `account.updated`, etc. (mirror production list).

Use the sandbox-only `STRIPE_WEBHOOK_SECRET` in Vercel Sandbox scope.

### 5. Clerk (sandbox)

**Recommended:** Clerk **Development** instance on sandbox.

- Sign-in URL: `https://sandbox.triboosport.com/login`
- Sign-up URL: `https://sandbox.triboosport.com/login`
- Allowed redirect: `https://sandbox.triboosport.com/sso-callback`

**Alternative:** Same Clerk Production app + sandbox Paths (shared user pool with www — only if you accept that).

### 6. Deploy script (future)

Add `npm run deploy:sandbox` mirroring `deploy-prod.ts`:

- `vercel --prod` with sandbox alias
- **Do not** overwrite production `app_version` in `system_settings` — use a separate key `app_version_sandbox` or rely on `VITE_APP_VERSION` build label only

---

## Shared database: safety rules

Sharing TiDB is allowed but requires discipline.

### Do

- Use **Stripe test mode only** on sandbox (no real charges; Stripe sets `livemode: false` on webhooks).
- Use **separate JWT_SECRET** so a token from sandbox never works on www.
- Prefix sandbox **email subjects** and show the **Sandbox badge** on every transactional email.
- Run QA on events titled **`(Sandbox)`** or **`(Test Event)`** when possible.
- Use **`scripts/reset-test-athlete.mjs`** only against known test emails — never `--force` on prod accounts.
- Check **`GET /api/config/auth`** on sandbox — should show test Clerk mode, correct `publicAppUrl`.

### Don’t

- Point sandbox at **live Stripe keys** (real money + polluted `payments` rows).
- Share **JWT_SECRET** between www and sandbox (session bleed).
- Assume sandbox registrations are “fake” — they are **real rows** in the shared DB.
- Run destructive SQL or bulk deletes without verifying environment.

### Optional Phase 2 (DB metadata)

If finance/reporting noise becomes a problem, add migration:

```sql
ALTER TABLE payments ADD COLUMN origin_env ENUM('production','sandbox') NOT NULL DEFAULT 'production';
```

Set `origin_env = 'sandbox'` when `APP_ENV=sandbox` or Stripe `livemode === false`. Staff payments panel can badge/filter accordingly.

Same pattern for `registrations.metadata_json` if you need folio-level tracing without a column.

---

## Email: Sandbox badge on confirmations (and all mail)

All Triboo emails go through `emailShell()` in `api/index.ts`. **One change badges every template** — registration confirmed, OTP, password reset, staff welcome, event approval, etc.

### Subject line

When `APP_ENV=sandbox`:

```
[Sandbox] Registration confirmed! — Triboo Sport
```

Prepend in `sendEmail()` so callers stay unchanged.

### HTML badge (inside `emailShell`, below logo)

Insert a prominent, on-brand banner:

```html
<!-- Sandbox badge — email clients safe table layout -->
<tr>
  <td align="center" style="padding:0 32px 16px;">
    <table
      role="presentation"
      cellspacing="0"
      cellpadding="0"
      border="0"
      width="100%"
    >
      <tr>
        <td
          align="center"
          style="padding:10px 16px;background:linear-gradient(135deg,#FF6B00 0%,#E63946 100%);border-radius:10px;border:1px solid #FF8533;"
        >
          <span
            style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#FFFFFF;"
          >
            &#9888; Sandbox
          </span>
          <span
            style="display:block;margin-top:4px;font-size:12px;font-weight:500;color:#FFE8D6;line-height:1.4;"
          >
            Test environment · Shared database · No real charges
          </span>
        </td>
      </tr>
    </table>
  </td>
</tr>
```

Spanish copy (when `locale === 'es'`):

```
Entorno de pruebas · Base de datos compartida · Sin cargos reales
```

### Registration confirmation specifically

`buildRegistrationConfirmedEmail` already shows event, category, and folio. On sandbox, optionally add a second callout under the detail table:

> This confirmation was generated from **sandbox.triboosport.com**. Your registration is stored in the shared Triboo database. Payment was processed in **Stripe test mode** — no real charge.

Plain-text part should include:

```
--- SANDBOX ---
This email was sent from the Triboo Sandbox environment.
```

### Resend

Keep **Resend enabled** on sandbox if you want real inbox testing — the badge + subject prefix make mis-sent mail obvious. For OTP-only QA without inbox noise, omit `RESEND_API_KEY` on sandbox (dry-run logs to Vercel function logs).

---

## UI: Sandbox banner (client)

When `VITE_APP_ENV=sandbox` or hostname is `sandbox.triboosport.com`:

- Sticky top banner (all public + portal + staff layouts):  
  **“Sandbox — Triboo play environment. Shared data with production. Test payments only.”**
- Footer: `v1.1.30-sandbox` or `Sandbox · v1.1.30`
- Staff finance rows: badge **Test payment** when Stripe `livemode` false (Phase 2)

Use design tokens only: `primary`, `accent`, `destructive`, `muted` — no arbitrary Tailwind colors.

---

## What you can test on sandbox (full prod stack)

| Flow                         | Sandbox behavior                                                       |
| ---------------------------- | ---------------------------------------------------------------------- |
| Athlete email/password login | Real DB users                                                          |
| Google SSO                   | Clerk dev app + sandbox URLs                                           |
| Event marketplace            | Same published events as www                                           |
| Registration wizard          | Full flow                                                              |
| Paid checkout                | Stripe test card `4242…` — **real registration row**, test payment row |
| Connect payouts UI           | Stripe Connect test accounts                                           |
| Staff console                | Same organizers/admins (JWT isolated by secret)                        |
| Confirmation email           | **Badge + [Sandbox] subject**                                          |
| Webhooks                     | Sandbox endpoint + test mode                                           |

---

## Deployment checklist

- [ ] DNS: `sandbox.triboosport.com` → Vercel
- [ ] Vercel Sandbox env vars set (see table above)
- [ ] `JWT_SECRET` ≠ production
- [ ] Stripe test webhook → sandbox URL
- [ ] Clerk Development app paths → sandbox URLs
- [ ] `GET https://sandbox.triboosport.com/api/health` → OK
- [ ] `GET https://sandbox.triboosport.com/api/config/auth` → test keys, `publicAppUrl` = sandbox
- [ ] Register test athlete → email has **Sandbox badge** and `[Sandbox]` subject
- [ ] Paid checkout with `4242` → confirmation email badged; Stripe Dashboard shows test payment
- [ ] Login on www with sandbox JWT **fails** (different `JWT_SECRET`)

---

## Implementation phases (code)

### Phase 1 — Minimum viable sandbox (recommended first)

1. `server/appEnvironment.ts` — `resolveAppEnvironment()`, `isSandbox()`, `sandboxEmailSubject()`
2. Wire `APP_ENV` in `.env.example`
3. `emailShell()` — sandbox badge block + localized strings
4. `sendEmail()` — subject prefix when sandbox
5. `GET /api/config/app` — `{ environment, publicAppUrl, version }`
6. Client `SandboxBanner.tsx` + mount in `App.tsx`
7. `npm run deploy:sandbox` script
8. This document

### Phase 2 — Shared-DB hygiene

1. `payments.origin_env` column + set on insert/webhook
2. Staff payment detail: “Sandbox / test” chip
3. Guard `reset-test-athlete.mjs` — refuse prod deploy URL unless `--force`
4. Optional: `system_settings.app_version_sandbox`

### Phase 3 — Polish

1. Sandbox-only feature flag in staff Settings (e.g. show experimental UI)
2. Audit log entries tagged `origin_env`
3. i18n for banner + email badge strings in `client/i18n/locales/`

---

## Mental model

```
Local dev     →  mock/dry-run, localhost, optional test keys
Sandbox       →  production build, shared DB, test money, badged emails, play freely
Production    →  www, live money, no badges, athlete-facing
```

Sandbox is **production infrastructure with training wheels** — not a step before prod, but a **parallel playground** wired to the same data plane.

---

## Related docs

- [MOCK_DATA.md](./MOCK_DATA.md) — seed accounts and test events
- [STRIPE_CONNECT_MX.md](./STRIPE_CONNECT_MX.md) — Connect + Stripe test mode
- [APP_CONTEXT.md](./APP_CONTEXT.md) — platform overview
