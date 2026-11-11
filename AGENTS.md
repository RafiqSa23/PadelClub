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
- Accepted decisions are locked in `docs/06-adr/`. Read the relevant ADR before revising anything they cover (QRIS via third-party gateway, email+password accounts (ADR 0009), no WhatsApp/Email notifications in MVP (ADR 0010), guest walk-in users (ADR 0011), configurable courts/hours, Next.js + Drizzle + Neon stack).
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

## Catatan perubahan terbaru (Bahasa Indonesia)

- Navbar publik (`src/components/layout/PublicHeader.tsx`): tautan "Admin Portal" (`/admin`) dihapus dari `NAV` sehingga tidak terlihat oleh user biasa. Admin tetap bisa mengakses `/admin` langsung jika tahu URL (dilindungi middleware `src/proxy.ts` + sesi admin).
- Cek tiket (`GET /api/tickets/[kode]`): sekarang wajib login (`padel_session`). Pelanggan hanya bisa melihat tiket miliknya sendiri (`booking.userId` cocok dengan `user.id` sesi); selain itu balas 403. Admin (scanner gate) melalui sesi admin boleh melihat semua tiket. Tidak login → 401.
- Halaman `/tiket/[kode]`: 401 diarahkan ke `/login?next=/tiket/[kode]`; 403 menampilkan "Anda bukan pemilik tiket ini". Salinan di `/tiket` dan `/tiket/[kode]` diperbaharui (tidak lagi "buka tanpa login").
- Akun dummy: user dibuat lewat `/daftar` (email + password); admin via seed (`admin` / `admin123`, lihat `SEED_ADMIN_USER`/`SEED_ADMIN_PASSWORD` di `.env.test`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
