# AGENTS.md

## What this repo is
Padel Court Booking — product specs in `docs/` (Bahasa Indonesia) plus a Next.js web app (MVP development). Product-spec phase is done; engineering has started.

## Language
- Documents in `docs/` are written in **Bahasa Indonesia** — write and edit docs in Indonesian, matching the existing tone.
- Code identifiers/comments follow normal engineering conventions; UI copy is Bahasa Indonesia.

## Document structure
- Docs live in `docs/`, numbered `NN-nama.md`, plus `06-adr/000N-keputusan.md`.
- `docs/README.md` is the index: keep the **status table** and **changelog** in sync when you add/change docs.
- `docs/04-PRD.md` is the single source of truth. Do not introduce features, statuses, or acceptance criteria in other files that contradict it.
- Use terms consistently; add/check ambiguous domain terms in `docs/05-glossary.md` (e.g. "Booking Hantu", "Maintenance").
- Cross-link related docs with relative Markdown links (existing docs do this with section anchors like `../04-PRD.md#6-open-questions-belum-terjawab`).

## Locked decisions (ADR rules)
- Accepted decisions are locked in `docs/06-adr/`. Read the relevant ADR before revising anything they cover (QRIS via third-party gateway, HP+OTP auth, WhatsApp+Email notifications, configurable courts/hours, Next.js + Drizzle + Neon stack).
- New decisions get a new numbered file `06-adr/000N-...md` in the same template.
- Open questions are tracked in PRD section 6; ADRs reference them — do not silently resolve open questions without an ADR.
- MVP non-goals (`01-konsep-produk.md` §5, PRD §2.3) are hard constraints; flag if work implies violating them.

## Progress tracking
`PROGRESS.md` at root maps implementation status (Setup + MVP F1–F11 + sitemap pages). Flip a line to ✅ only when the acceptance criteria in `docs/03-spesifikasi-fitur.md` are met; keep it in sync with the feature specs.

## App (Next.js 16 + Drizzle ORM + Neon PostgreSQL)
- Stack decision: `docs/06-adr/0005-tech-stack-nextjs-drizzle.md`.
- Commands:
  - `npm run dev` — dev server
  - `npm run lint` — ESLint (Next 16; `next lint` is deprecated, use `eslint`)
  - `npm run typecheck` — `tsc --noEmit`
  - `npm run build` / `npm run start`
  - `npm run db:generate` / `npm run db:migrate` / `npm run db:studio` (Drizzle Kit)
- DB: Neon PostgreSQL. `DATABASE_URL` lives in `.env` (gitignored; template in `.env.example`). Do not commit real credentials.
- Drizzle schema: `src/db/schema.ts` (single source for tables/enums/relations), client in `src/db/index.ts`, config in `drizzle.config.ts`, migrations in `drizzle/`.
- Source is under `src/app` (App Router, `@/*` alias); reusable code should go in `src/lib`, `src/components`, `src/db`.
- DB schema maps to product domain statuses (e.g. booking `menunggu_pembayaran`/`terkonfirmasi`/`dibatalkan`) — keep in sync with slot status matrix (`02-user-journey.md` §6) and glossary.