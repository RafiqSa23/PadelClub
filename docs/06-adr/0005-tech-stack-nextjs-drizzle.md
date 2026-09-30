# ADR 0005 — Tech Stack: Next.js + Drizzle ORM + Neon PostgreSQL

- **Status:** Accepted
- **Tanggal:** 2026-09-22
- **Pemilik:** Tech Lead

## Konteks
PRD (bagian 4) menyatakan seluruh keputusan teknis masih `TBD` dan akan diisi pada sesi engineering. Sesi engineering telah dimulai; keputusan stack perlu dikunci agar implementasi MVP konsisten.

## Keputusan
Menggunakan stack berikut untuk MVP:

- **Framework:** Next.js (App Router, TypeScript) — versi stabil terkini via `create-next-app`.
- **Styling:** Tailwind CSS (bawaan create-next-app).
- **ORM:** Drizzle ORM + Drizzle Kit (schema-first, migrasi SQL).
- **Database:** Neon (PostgreSQL hosted), dialect `postgresql`, driver `postgres-js`.
- **Tooling:** ESLint (bawaan), Turbopack (dev/build), npm sebagai package manager.

Lingkungan: Node.js v24, npm 11.

## Alasan
- **Next.js App Router + TypeScript** — sesuai kebutuhan web responsive MVP (non-goal: aplikasi native), SSR/`server components` memudahkan render grid slot, integrasi route handler untuk webhook pembayaran.
- **Drizzle ORM** — ringan, type-safe, SQL-first; cocok untuk model data booking yang banyak query-read grid (lapangan × jam) tanpa lapisan abstraksi berat.
- **Neon PostgreSQL** — PostgreSQL menyediakan transaksi & optimistic locking untuk mencegah overbooking (risiko teknis PRD §5.2), serverless-compatible, branch DB untuk develop, hingga free-tier development.
- **Schema-first + migrasi SQL** — memudahkan kendali skema (dokumen PRD §4.3) direview dan di-migrasi bertahap.

## Konsekuensi
- **Baik:**
  - Skema didorong dari definisi TypeScript tunggal (`schema.ts`) → konsisten dengan dokumentasi produk.
  - Migrasi dibuat sebagai file SQL dan bisa direview sebelum dijalankan.
  - PostgreSQL menunjang transaksi finansial (pembayaran QRIS, webhook) dan kunci slot transaksional.
- **Perlu diwaspadai:**
  - `DATABASE_URL` (kredensial Neon) dikelola via environment variable; `.env` wajib di-gitignore.
  - Perlu kehati-hatian mengelola pooling koneksi di serverless (dipakai satu koneksi/request).
  - Keputusan penyedia lain (payment gateway, WhatsApp) tetap mengikuti ADR 0001 & open question PRD Q1/Q5.
  - Migrasi ke driver/DB lain tetap mungkin karena Drizzle memudahkan swap dialect, tetapi struktur skema diessuaikan.

## Alternatif yang Ditolak
- **Prisma ORM** — lebih berat, codegen kustom; kurang selaras dengan arah schema type-safe yang ringan sesuai kebutuhan MVP.
- **MySQL (managed lain)** — PostgreSQL lebih baik untuk fitur transaksi & locking yang dibutuhkan anti-overbooking.
- **SQLite dalam dev** — disukai untuk prototipe, tetapi transaksi/concurrency booking lebih aman di PostgreSQL sedari awal mengingat sampai tahap produksi.

## Referensi
- [PRD — Technical Specifications](../04-PRD.md#4-technical-specifications)
- [PRD — Technical Risks (overbooking, concurrency)](../04-PRD.md#52-technical-risks)
- [ADR 0004 — Lapangan Configurable](../06-adr/0004-lapangan-configurable.md)