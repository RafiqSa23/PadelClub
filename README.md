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

`/booking` (slot grid → review → HP + OTP → QRIS) → `/tiket/:kode` (no login)
→ `/riwayat` (OTP session). Payment is a **mock driver** by default
(`PAYMENT_DRIVER="mock"`, payload `MOCK-QRIS:ORD-<code>:<amount>`); swap in the
Midtrans driver (ADR 0007) without touching the UI.

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
