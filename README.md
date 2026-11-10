# PadelClub — Padel Court Booking (MVP)

Online booking for padel courts: instant slot search, multi-hour cart, OTP checkout,
mock QRIS payment with 15-minute expiry, digital tickets with admin check-in,
scheduled reminders, and admin reports. Built with **Next.js 16 + Drizzle ORM +
Neon PostgreSQL**. All backend features **F1–F11 ✅**, verified end-to-end against
a live database.

> Product docs (Bahasa Indonesia) live in [`docs/`](docs/) — start at
> [`docs/README.md`](docs/README.md). Implementation status: [`PROGRESS.md`](PROGRESS.md).
> API reference: [`docs/07-api-backend.md`](docs/07-api-backend.md) (+
> [`07-api-backend.openapi.yaml`](docs/07-api-backend.openapi.yaml), 28 paths).

## Quick Start

```bash
cp .env.example .env   # then fill in DATABASE_URL (Neon)
npm install
npm run db:migrate     # create tables on Neon
npm run db:seed        # 6 courts + weekly hours + admin (idempotent)
npm run dev            # http://localhost:3000
```

Seed admin: `admin / admin123` — change the password after first login
(`SEED_ADMIN_PASSWORD` in `.env`).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint (Next 16: plain `eslint`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle Kit |
| `npm run db:seed` | Seed courts, hours, admin (`tsx src/db/seed.ts`) |
| `npm test` / `npm run test:api` | HTTP API tests (serial, ≤45 requests) |
| `npm run dev:test` | Dev server on port 3100 against the **test** DB |
| `npm run db:migrate:test` / `db:seed:test` | Migrate/seed the test DB (`.env.test`) |

## Project Structure

| Path | Description |
|---|---|
| `src/app` | App Router — `(customer)/` pages, `admin/(panel)/`, `api/` route handlers |
| `src/db/schema.ts` | Single source of truth for tables/enums/relations |
| `src/db/seed.ts` | Idempotent seed script |
| `src/lib` | Shared backend libs (slots, sessions, rate-limit, payment/notify drivers) |
| `src/components` | Reusable UI (design-system tokens in `src/app/globals.css`) |
| `drizzle/` | Generated SQL migrations (commit these) |
| `docs/` | Product specs, ADRs, API docs (Bahasa Indonesia) |

## Customer Flow

`/booking` (slot grid → review → HP + OTP → Snap popup) → `/tiket/:kode` (no login)
→ `/riwayat` (OTP session). Payment defaults to a **mock driver**
(`PAYMENT_DRIVER="mock"`, payload `MOCK-QRIS:ORD-<code>:<amount>`); switch to Midtrans
Snap popup (ADR 0008) by filling `MIDTRANS_*` in `.env`. The UI is unchanged either way.

## Slot Availability

The booking grid is fetched once (`GET /api/slots?date=…`, one DB roundtrip) and then
polled through `GET /api/slots/status?date=…&v=<version>`, which answers **304** while
nothing changed — so a 10-second refresh costs no query. Writes that free or take a slot
(booking, payment webhook, admin confirm/cancel, closure, cron expire) call
`bumpSlotsVersion()`. Per-date schedule cache is 5 s (`SLOTS_CACHE_TTL_MS`), and the
7-day strip uses one range request (`?from=&to=`). Slots awaiting payment carry
`expiresAt`, so the client unlocks them locally at the right second, and polling pauses
while the tab is hidden.

## Testing

HTTP tests hit a running server — they never start one themselves and never run
in parallel (1 worker, sequential files, ≤45 requests per run) so dev/prod servers
are not hammered.

```bash
cp .env.test.example .env.test   # DATABASE_URL must point at a SEPARATE test DB
npm run db:migrate:test
npm run db:seed:test
npm run dev:test                 # terminal 1 — port 3100, test DB, mock drivers
npm run test:api                 # terminal 2
```

Guards: refuses non-localhost `TEST_BASE_URL` (unless `ALLOW_REMOTE_TESTS=1`), refuses
the same database as `.env` (the real hazard — tests delete rows), and requires a
test-looking DB name. Neon names its default database `neondb`, so either rename it
(`ALTER DATABASE neondb RENAME TO padelclub_test`) or set `TEST_DB_CONFIRMED="1"` in
`.env.test` when that database is dedicated to tests. Escape hatch for a deliberate
one-off: `ALLOW_NON_TEST_DB=1`. Cleanup only deletes rows for the test phone numbers
and closures labelled `TEST-*`. No load/stress tests live in this repo.

| File | Covers |
|---|---|
| `tests/api/01-customer-flow.test.ts` | F1–F5: slots, delta 304, OTP, booking, charge, webhook, ticket, history |
| `tests/api/02-admin-flow.test.ts` | F7–F11: login, dashboard, walk-in, check-in, closures, reports |
| `tests/api/03-guards.test.ts` | Auth guards (401), 404, input validation (400) |

## Scheduled Jobs

Cron endpoints require `CRON_SECRET` (`x-cron-secret` header, `Bearer` token,
or `?secret=` query):

| Endpoint | Schedule | Purpose |
|---|---|---|
| `GET /api/cron/expire` | every minute | Expire `menunggu_pembayaran` older than 15 min (ADR 0006) |
| `GET /api/cron/reminders` | every 5 minutes | H-1 & H-2h reminders for confirmed bookings (F6) |

## Environment

See [`.env.example`](.env.example). Never commit `.env` (gitignored).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `SESSION_SECRET` | HMAC secret for customer sessions (min 32 chars, rotate in prod) |
| `PAYMENT_DRIVER` / `NOTIFY_DRIVER` | `mock` (default, no credentials) |
| `CRON_SECRET` | Auth for `/api/cron/*` |
| `SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD` | Seed admin credentials |

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/) · [Neon](https://neon.tech/)
