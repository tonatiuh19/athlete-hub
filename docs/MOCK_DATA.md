# Mock Data & Test Accounts

Seed data is applied via `database/migrations/20260531_120001_seed_mock_data.sql`.

## Test accounts (OTP login)

| Role | Email | Notes |
|------|-------|-------|
| Admin | `alex@disruptinglabs.com` | **Primary** super admin (Alex Gomez) |
| Admin | `admin@athletehub.test` | Super admin dashboard (seed) |
| Organizer | `owner@runmexico.test` | Run Mexico — owner |
| Organizer | `ops@runmexico.test` | Run Mexico — operations |
| Organizer | `owner@pacificendurance.test` | Pacific Endurance |
| Athlete | `felix.gomez@example.com` | Has Maratón CDMX registration |
| Athlete | `maria.lopez@example.com` | Has 10K Polanco registration |
| Athlete | `carlos.ruiz@example.com` | Has Trail Nevado registration |
| Athlete | `ana.torres@example.com` | Hyrox 2025 + results |
| Athlete | `diego.martinez@example.com` | Hyrox 2025 Pro + results |
| Athlete | `lucia.herrera@example.com` | Pending triathlon registration |

OTP codes are sent via Resend (email) or logged to console in dry-run mode.

## Sample events (API slugs)

| Slug | Status | Featured |
|------|--------|----------|
| `maraton-cdmx-2026` | published | yes |
| `trail-nevado-toluca-2026` | published | yes |
| `triatlon-acapulco-2026` | published | no |
| `carrera-10k-polanco-2026` | published | no |
| `hyrox-mexico-city-2025` | completed | no (has results) |

All published mock events with `requires_waiver = 1` must have at least one active row in `event_waivers`. The seed migration inserts waivers for every such event; migration `20260604_200000_seed_missing_event_waivers.sql` backfills older databases. Smoke test: `tests/smoke/seed-waiver-integrity.spec.ts`.

**Paid registration in dev:** mock categories use real prices ($650–$2,200 MXN). Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` in `.env` to test paid checkout locally.

## API smoke tests

```bash
curl http://localhost:8080/api/events
curl http://localhost:8080/api/events/maraton-cdmx-2026
curl "http://localhost:8080/api/events?sport=running&city=Ciudad"
curl http://localhost:8080/api/sport-types
```

## Discount codes

- `EARLY2026` — 15% off Maratón CDMX inscription
- `POLANCO10` — $100 MXN off 10K Polanco
