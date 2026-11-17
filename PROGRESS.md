# PROGRESS — Implementasi MVP Padel Court Booking

Checklist pemantauan implementasi. Sinkron dengan:
- Fitur: [`docs/03-spesifikasi-fitur.md`](docs/03-spesifikasi-fitur.md) (F1–F11)
- Sitemap: [`docs/02-user-journey.md`](docs/02-user-journey.md) §4–5
- Status slot: [`docs/02-user-journey.md`](docs/02-user-journey.md) §6

**Legend:** ⬜ Belum Dimulai · 🔄 In Progress · ✅ Selesai · — Tidak berlaku

## Setup / Fondasi

| # | Item | Status | Catatan |
|---|---|---|---|
| S1 | Inisialisasi project Next.js (TS, Tailwind, ESLint, App Router) | ✅ | Next 16.3.5, alias `@/*`, src-dir |
| S2 | Keputusan stack (ADR 0005) | ✅ | [docs/06-adr/0005-tech-stack-nextjs-drizzle.md](docs/06-adr/0005-tech-stack-nextjs-drizzle.md) |
| S3 | Drizzle ORM + config + scripts | ✅ | `src/db/`, `drizzle.config.ts`, scripts `db:*` |
| S4 | Schema awal (8 tabel) | ✅ | [src/db/schema.ts](src/db/schema.ts) — fondasi, masih akan di-refine |
| S5 | Migrasi awal di-generate | ✅ | `drizzle/0000_crazy_tenebrous.sql` |
| S6 | Migrasi dijalankan ke Neon | ✅ | 8 tabel + enum terpasang (`npm run db:migrate`) |
| S7 | Landing page (Bahasa Indonesia) + token brand | ✅ | `src/app/(customer)/page.tsx`, `src/app/globals.css` |
| S8 | Endpoint `/api/health` (cek koneksi DB) | ✅ | Koneksi DB terverifikasi (SELECT 1 OK) |
| S9 | Git repo ter-inisialisasi | ✅ | Repo aktif; riwayat commit tersedia |
| S10 | Skema backend lengkap (otp_codes, admins, admin_sessions, kolom expiry/check-in) | ✅ | Migrasi `0001` + `0002` (2026-09-30); `otp_codes` di-drop saat auth pindah ke email+password |
| S11 | Seed data (6 lapangan + jam 7 hari + admin) + `npm run db:seed` | ✅ | Idempotent, bisa diulang (2026-09-30) |
| S12 | Lib backend shared (slots, sesi token+hash, rate-limit, payment mock/midtrans) | ✅ | `src/lib/*.ts` (2026-09-30; sesi pemain token acak + SHA-256 sejak 2026-11-12) |
| S13 | Auth admin backend (scrypt + sesi DB, ganti cookie demo) | ✅ | `POST /api/admin/login|logout`, `GET /api/admin/me` (2026-09-30) |
| S14 | Index hot-path + connection pool DB | ✅ | Migrasi `0003` (11 index: cron, riwayat, grid, OTP, log) + `max: 5` di `src/db/index.ts` (2026-11-10) |
| S15 | Test HTTP otomatis (vitest, serial) | ✅ | `tests/api/*` (6 file, ±80 request), guard DB test + localhost, `npm run test:api` (2026-11-10; file akun 2026-11-15; guard privasi + unit jendela check-in + unit QR 2026-11-17) |
| S16 | Polling jadwal hemat (cache + versi + delta 304) | ✅ | `src/lib/slot-status.ts`, `GET /api/slots/status`, `getDaySchedule` 1 roundtrip, strip minggu 1 request (2026-11-10) |
| S17 | Auth pemain email + password (ganti OTP) | ✅ | [ADR 0009](docs/06-adr/0009-akun-email-password.md): `/api/auth/register|login|logout|me`, `user_sessions` (token opaque + SHA-256), halaman `/login` + `/daftar`, sesi `padel_session` berbasis `userId` (2026-11-12) |
| S18 | User bayangan walk-in + cron anonimisasi 7 hari | ✅ | [ADR 0011](docs/06-adr/0011-user-bayangan-walkin.md): `users.isGuest`, `anonymizedAt`, `/api/cron/anonymize`, dedupe guest by HP (2026-11-12) |
| S19 | Pensiunkan notifikasi WhatsApp/Email | ✅ | [ADR 0010](docs/06-adr/0010-mvp-tanpa-notifikasi.md): panggilan notifikasi dihapus (webhook, cron expire), `/api/cron/reminders` + `/api/admin/notifications` dihapus, migrasi `0004` drop `notification_logs` (2026-11-12) |
| S20 | Halaman `/daftar` + guard sesi `/booking` & `/riwayat` | ✅ | `/daftar` + guard `goCheckout()` dan 401 API (2026-11-12) |
| S21 | Ganti password mandiri + halaman `/akun` | ✅ | [ADR 0012](docs/06-adr/0012-ganti-password-mandiri.md): `POST /api/auth/change-password`, `/akun`, sesi lain dicabut (2026-11-15) |
| S22 | Halaman admin akun pemain + reset password | ✅ | `/admin/users`, `GET /api/admin/users?q=`, `POST /api/admin/users/:id/reset-password` (2026-11-15) |
| S23 | Rate-limit persisten lintas-instance | ✅ | [ADR 0013](docs/06-adr/0013-rate-limit-cron-produksi.md): tabel `rate_limits`, migrasi `0005`, `src/lib/rate-limit-db.ts`; endpoint sensitif memakainya (2026-11-15) |
| S24 | Jadwal cron produksi + CI | ✅ | `vercel.json` (`/api/cron/expire` tiap 5 mnt, `/api/cron/anonymize` harian 03:00 UTC), `.github/workflows/ci.yml` (2026-11-15) |
| S25 | QR tiket asli + scanner kamera gate | ✅ | `qrcode.react` di `QRBox` (payload token bertanda tangan sejak S27); `jsqr` mendekode frame kamera di `/admin/scanner` (~8 fps, dedupe 8 dtk, pilih kamera, fallback manual) (2026-11-17) |
| S26 | Jendela check-in hari-H + bunyi gate | ✅ | `src/lib/checkin-window.ts` (WIB, buka H-30 mnt, tutup saat sesi berakhir) dipakai `POST /api/admin/checkin` (409); scanner menampilkan pesan spesifik + tone sukses/gagal (bisa dimatikan) (2026-11-17) |
| S27 | QR bertanda tangan + log pemindaian gate | ✅ | [ADR 0014](docs/06-adr/0014-qr-tiket-bertanda-tangan.md): HMAC-SHA256 TTL 5 mnt (`TICKET_QR_SECRET`), verifikasi `?qr=` (403), tabel `scan_logs` + `GET /api/admin/scans`, migrasi `0006` (2026-11-17) |

## Fitur MVP — Sisi Customer

> Dua kolom status: **Frontend** ✅ = antarmuka & interaksi sudah tersedia (masih data mock); **Backend** ✅ = acceptance criteria [`docs/03-spesifikasi-fitur.md`](docs/03-spesifikasi-fitur.md) terpenuhi (data real, endpoint aktif). Frontend ✅ **bukan** berarti fitur selesai — tidak ada fitur yang boleh ditandai selesai sebelum kolom Backend ✅.

| Fitur | Deskripsi | Frontend | Backend | Ref |
|---|---|---|---|---|
| F1 | Pencarian slot (tanggal → lapangan → jam) | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f1--pencarian-slot) |
| F2 | Keranjang booking multi-jam | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f2--keranjang-booking-multi-jam) |
| F3 | Checkout (akun email + password) | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f3--checkout-akun-email--password) |
| F4 | Pembayaran via Midtrans Snap popup (semua metode) | ✅¹ | ✅ | [03](docs/03-spesifikasi-fitur.md#f4--pembayaran-otomatis-qris--snap) |
| F5 | Tiket/bukti booking digital | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f5--tiket--bukti-booking-digital) |
| ~~F6~~ | ~~Pengingat otomatis (WhatsApp + Email)~~ | —³ | —³ | **Dibatalkan 2026-11-12** ([ADR 0010](docs/06-adr/0010-mvp-tanpa-notifikasi.md)) → v2.0 |

> ¹ Snap popup (ADR 0008, 2026-10-01) menggantikan QR Core API: charge mengembalikan `snapToken`, tombol "Bayar Sekarang" + fallback link tab baru; sukses → auto-redirect ke tiket. Driver mock tetap jalur QR dekoratif (`MOCK-QRIS:…`) + simulasi-bayar untuk lokal. ³ F6 dibatalkan 2026-11-12 ([ADR 0010](docs/06-adr/0010-mvp-tanpa-notifikasi.md)) — tidak ada kanal notifikasi di MVP.

## Fitur MVP — Sisi Admin

| Fitur | Deskripsi | Frontend | Backend | Ref |
|---|---|---|---|---|
| F7 | Dashboard jadwal harian | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f7--dashboard-jadwal-harian) |
| F8 | Booking manual (walk-in / telepon) | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f8--booking-manual-walk-in--telepon) |
| F9 | Tutup lapangan (maintenance) | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f9--tutup-lapangan-maintenance) |
| F10 | Konfirmasi & monitoring pembayaran | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f10--konfirmasi--monitoring-pembayaran) |
| F11 | Riwayat & laporan | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f11--riwayat--laporan) |

## Halaman (Sitemap) — Customer

> Status ✅ di tabel Halaman berarti halaman sudah bisa diakses (frontend). Fitur backend-nya masih ⬜ di kolom **Backend** tabel F — acceptance criteria (`03-spesifikasi-fitur.md`) belum terpenuhi.

| Halaman | Deskripsi | Status | Catatan |
|---|---|---|---|
| `/` | Landing page | ✅ | UI + token brand |
| `/booking` | Wizard booking multi-step | ✅ | Snap popup + countdown expiry server + polling 5 dtk + auto-redirect ke tiket; wajib sesi sebelum checkout (guard `goCheckout()` + API 401) |
| `/login` | Masuk akun (email + password) | ✅ | UI email + password, tanpa OTP; `safeNextPath()`; lupa password reset via admin ([ADR 0009](docs/06-adr/0009-akun-email-password.md)) |
| `/daftar` | Daftar akun (nama, email, password, HP) | ✅ | Halaman baru, ak langsung aktif, buat cookie `padel_session` ([ADR 0009](docs/06-adr/0009-akun-email-password.md)) |
| `/tiket/:kode` | Tiket/bukti digital (wajib login & milik pemilik) | ✅ | Real: `GET /api/tickets/:kode` butuh `padel_session`; pelanggan hanya lihat `booking.userId` miliknya (selain itu 403); admin lewat sesi admin boleh semua; tidak login → 401 diarahkan `/login?next=...` |
| `/akun` | Pengaturan akun + ganti password | ✅ | Real: `GET /api/auth/me` + `POST /api/auth/change-password`; lupa password tetap via admin ([ADR 0012](docs/06-adr/0012-ganti-password-mandiri.md)) |
| `/riwayat` | Riwayat booking pemain | ✅ | Real: `GET /api/me/bookings` (+ `/api/courts` sidebar); wajib sesi akun, ada CTA login |

> **Infra halaman (2026-09-28):** `loading.tsx` (customer + panel admin), `error.tsx` (root + panel), `not-found.tsx` global tersedia; metadata SEO per segmen (`(customer)/*`) + judul & `noindex` untuk `/admin/*`. Baca localStorage dipindah ke `useEffect` (hindari hydration mismatch).

## Halaman (Sitemap) — Admin

> Dilindungi `src/proxy.ts` (Next 16) via cookie demo `padelclub_admin`: tanpa cookie, `/admin/*` di-redirect ke `/admin`. Ini guard antarmuka, **bukan** autentikasi sesungguhnya — diganti saat fase backend. Struktur shell admin dirapikan (2026-09-28): `AdminShell` per-halaman tunggal, offset `lg:pl-72`, padding diatur oleh shell.

| Halaman | Deskripsi | Status | Catatan |
|---|---|---|---|
| `/admin` | Login admin | ✅ | Real: `POST /api/admin/login` (scrypt + sesi DB); akun seed `admin/admin123` |
| `/admin/dashboard` | Ringkasan harian | ✅ | Real: KPI + antrean + matriks dari `/api/admin/overview` + `/schedule` (refresh 15 dtk) |
| `/admin/jadwal` | Grid jadwal semua lapangan | ✅ | Real: `GET /api/admin/schedule` + modal detail + tutup-slot dari grid (refresh 15 dtk) |
| `/admin/booking` | Daftar booking + aksi | ✅ | Real: filter/cari + confirm/cancel via API + badge hampir-kedaluwarsa |
| `/admin/booking/baru` | Form booking manual | ✅ | Real: `POST /api/admin/bookings` (validasi konflik server, 409) |
| `/admin/lapangan` | Kelola lapangan, harga, jam, maintenance | ✅ | Real: CRUD courts + closures via API |
| `/admin/users` | Akun pemain + reset password | ✅ | Real: `GET /api/admin/users?q=` (cari nama/email/HP) + `POST /api/admin/users/:id/reset-password`; user bayangan ditandai |
| `/admin/laporan` | Rekap pendapatan & okupansi | ✅ | Real: `GET /api/admin/reports` (JSON ringkasan + per lapangan) + unduh CSV server-side |
| `/admin/papan-jadwal` | Papan jadwal publik (mode TV/lobi) | ✅ | Real read-only: `GET /api/admin/schedule` + refresh 15 dtk + nama tersamar; tanpa aksi · di luar sitemap PRD |
| `/admin/monitoring` | Monitoring web publik + banner siaran | ✅ | Demo statis (`src/lib/mock-data`) — log notifikasi sudah dihapus karena ADR 0010; panel demo dilabeli jelas · di luar sitemap PRD |
| `/admin/scanner` | Scanner tiket di gate (kamera/manual) | ✅ | Real: kamera `getUserMedia` + decode QR `jsqr` (otomatis validasi) via `GET /api/tickets/:kode` + check-in `POST /api/admin/checkin`; pilih kamera asli; fallback input manual; log shift in-memory · di luar sitemap PRD |

## Sisa Pekerjaan (Belum Dikerjakan)

Daftar gap yang teridentifikasi setelah perapian frontend (2026-09-28), diperbarui 2026-11-15 setelah akun/operasional (ADR 0012–0013).

### Revisi scope 2026-11-12 (ADR 0009–0011) — sudah diimplementasikan
- **F3 berubah:** akun email + password tanpa OTP, wajib sesi sebelum checkout ([ADR 0009](docs/06-adr/0009-akun-email-password.md)). Selesai 2026-11-12.
- **F6 dibatalkan:** tidak ada notifikasi WhatsApp/Email di MVP ([ADR 0010](docs/06-adr/0010-mvp-tanpa-notifikasi.md)).
- **User bayangan walk-in:** dedupe by HP, anonimisasi otomatis 7 hari, booking historis tetap ([ADR 0011](docs/06-adr/0011-user-bayangan-walkin.md)).

### Backend / data (fase berikutnya)
- Endpoint aktif: `/api/health`, `/api/courts`, `/api/slots`, `/api/slots/status`, `/api/auth/*` (termasuk `change-password`), `/api/bookings/*`, `/api/me/bookings`, `/api/payments/*`, `/api/webhooks/payment`, `/api/cron/*`, `/api/tickets/*`, `/api/admin/*` (termasuk `/admin/users`). `/api/otp/*`, `/api/cron/reminders`, `/api/admin/notifications` sudah dihapus (v1.1-auth).
- ✅ Selesai Batch 1 (2026-09-30): F1 read-path real + F9 penuh + read-model F7 + auth admin backend.
- ✅ Selesai Batch 2 (2026-09-30): F1–F3 + F8 penuh (OTP mock-driver, transaksi anti-overbooking, walk-in) + wiring `/booking`, `/login`, `/admin/booking/baru`. Docs API v1.0-batch2 (17 endpoint).
- ✅ Selesai Batch 3 (2026-09-30): F7 + F10 penuh (list/filter/cari, confirm/cancel, overview KPI, tutup-dari-grid, refresh 15 dtk) + wiring `/admin/booking`, `/admin/dashboard`, `/admin/jadwal`. Docs API v1.0-batch3 (19 paths / 21 operasi).
- ✅ Selesai Batch 4 (2026-09-30): F4 penuh (charge idempoten, polling status, webhook PAID → `terkonfirmasi` + tiket, cron expire 15 mnt + log `kadaluarsa`) + wiring `/booking` (QR payload mock + polling 5 dtk + simulasi-bayar + state kedaluwarsa). Docs API v1.0-batch4 (23 paths / 25 operasi). Uji: charge → webhook → tiket + expiry paksa → cron → slot `kosong`.
- ✅ Selesai Batch 7 (2026-09-30): F11 penuh (JSON ringkasan + per lapangan, CSV server-side) + wiring `/admin/laporan`. Docs API v1.0-batch7 final (28 paths / 30 operasi). **Seluruh F1–F11 Backend ✅.**

### Gap terbuka (2026-11-15) — belum dikerjakan

**P1 — sebelum produksi**
- **Midtrans sandbox e2e belum diuji.** Butuh `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` sandbox, `APP_PUBLIC_URL` publik (ngrok), dan webhook yang bisa menjangkau URL tersebut.
- **Vercel Cron belum diverifikasi di deployment.** Set `CRON_SECRET` di Vercel; pastikan paket mengizinkan `*/5 * * * *` untuk `/api/cron/expire` (Hobby membatasi jadwal → expire bisa tertunda). Lokal hanya diuji lewat pemanggilan langsung.
- **CI `api-tests` belum pernah jalan.** Job digerbangi `API_TESTS_ENABLED=1` + secret `TEST_DATABASE_URL`; belum diset di repo GitHub. Job `quality` (lint/typecheck/build) juga belum diverifikasi di runner.

**P2 — setelah MVP stabil**
- `/admin/monitoring` masih demo statis (`src/lib/mock-data`); belum ada feed monitoring real (di luar sitemap PRD).
- **Reset lupa password mandiri** dan verifikasi email belum ada (PRD Q7). Reset tetap via `/admin/users`; ganti password hanya saat sudah login (ADR 0012).
- Rate-limit DB: belum ada test lintas-instance; pembersihan baris `rate_limits` hanya menumpang `/api/cron/expire`.

**Selesai 2026-11-17:**
- `GET /api/bookings/{code}` dikunci: wajib sesi, pemain hanya boleh membuka booking miliknya (403 bila bukan pemilik), admin boleh semua. Docs §5b.2 + OpenAPI ikut diperbarui.
- Test guard privasi: booking tanpa sesi 401, pemain lain 403, tiket tanpa sesi 401, reset password user bayangan 409.
- QR tiket asli (`qrcode.react`) + scanner kamera gate (`jsqr`) dengan dedupe, pilih kamera, dan fallback manual. Verifikasi izin/stream kamera tetap butuh uji manual di browser (tidak bisa diuji headless); `lint`/`typecheck`/`build` hijau.
- Jendela check-in gate: hari-H, buka 30 menit sebelum jam pertama, tutup saat sesi terakhir berakhir (WIB); API menolak 409 dengan pesan spesifik. Bunyi gate sukses/gagal bisa diaktifkan/dimatikan.

## Uji Revisi Scope Auth & Notifikasi (2026-11-12)

Dijalankan terhadap `npm run dev:test` (port 3100) + DB uji terpisah setelah migrasi `0004_auth_user_sessions`. **44 test lulus (3 file).** `lint`, `typecheck`, `build` hijau.

- **F3 auth:** registrasi email+password 201 + cookie `padel_session`; email duplikat 409; `/api/auth/me` mengembalikan akun; email invalid 400; login password salah 401; booking tanpa sesi 401.
- **F8 walk-in:** booking tunai admin membuat/memakai user bayangan (`isGuest`) dan langsung `terkonfirmasi`.
- **F10/F11:** cancel walk-in mengembalikan slot; laporan JSON tetap memuat booking walk-in.
- **Cron:** `/api/cron/expire` tanpa secret 401; `/api/cron/anonymize?secret=…` 200 (ADR 0011). Endpoint pensiunan (`/api/admin/notifications`) membalas 404.
- **Temuan & perbaikan:** query anonimisasi memakai nama kolom snake_case (`user_id`, `booking_date`, `created_at`) padahal schema Drizzle memakai identifier quoted camelCase → diperbaiki; parameter `Date` diganti ekspresi SQL `now() - interval '7 days'`. Rate-limit registrasi in-memory menumpuk antar-run → helper test mengirim `x-forwarded-for` unik per klien. DB uji lama (`ep-purple-dew…`) sudah mati; diganti database `padelclub_test` di instance Neon yang sama dengan dev (host berbeda tidak dipakai).

## Uji Akun & Operasional (2026-11-15)

Dijalankan terhadap `npm run dev:test` (port 3100) + DB uji terpisah setelah migrasi `0005_powerful_jack_flag` (`rate_limits`). **53 test lulus (4 file).** `lint`, `typecheck`, `build` hijau.

- **Ganti password (ADR 0012):** password lama salah 401; password baru < 8 karakter 400; ganti berhasil 200 + sesi berjalan tetap aktif; password lama tidak bisa login lagi (401); password baru bisa login (200).
- **Admin akun:** `GET /api/admin/users?q=` menemukan akun; `POST /api/admin/users/:id/reset-password` 200 dan mencabut sesi user (sesi lama `/api/auth/me` → 401); user bayangan ditolak 409 (implementasi).
- **Rate-limit:** endpoint sensitif memakai `rateLimitDb` (tabel `rate_limits`); endpoint jadwal tetap in-memory; migrasi diterapkan ke DB dev + test.
- **Cron:** jadwal `vercel.json` belum diuji di Vercel (lokal memakai pemanggilan langsung dengan `CRON_SECRET`).

## Uji Privasi Booking (2026-11-17)

Dijalankan terhadap `npm run dev:test` (port 3100) + DB uji. **57 test lulus (4 file).** `lint`, `typecheck`, `build` hijau.

- **`GET /api/bookings/{code}`:** pemilik 200 (nomor HP tetap ternormalisasi); tanpa sesi 401; akun pemain lain 403 (`Anda bukan pemilik booking ini`); admin tetap bisa semua.
- **Tiket:** tanpa sesi 401 (sebelum lookup kode); kode asing via sesi admin tetap 404.
- **Admin users:** reset password user bayangan (`isGuest`) 409; alur walk-in membuat user bayangan seperti sebelumnya.
- **Anggaran request:** naik dari ±60 ke ±80 per run (file `03-guards` 15, `04-account` 18, QR tiket +2).

## Uji QR & Scanner Kamera (2026-11-17)

- **QR tiket:** `QRBox` memakai `qrcode.react` (`QRCodeCanvas`, level M, margin 2 modul) dengan payload kode booking — QR bisa dipindai aplikasi kamera biasa. `MOCK-QRIS:*` di `/booking` ikut jadi QR valid secara teknis (payload mock, bukan QRIS asli).
- **Scanner gate:** `jsqr` mendekode frame `<video>` tiap ±120 ms (maks 640 px), auto-validasi ke `GET /api/tickets/:kode` lalu `POST /api/admin/checkin`; kode sama diabaikan 8 detik; pilih kamera via `enumerateDevices`; pesan jelas untuk izin ditolak / tanpa kamera / non-HTTPS.
- **Batas uji:** izin & stream kamera tidak bisa diuji headless — perlu uji manual di browser (HTTPS atau `localhost`). Gate otomatis: `lint`, `typecheck`, `build` hijau.

## Uji Jendela Check-in (2026-11-17)

Dijalankan terhadap `npm run dev:test` (port 3100) + DB uji. **67 test lulus (5 file).** `lint`, `typecheck`, `build` hijau.

- **Unit (`05-checkin-window`, 8 test):** buka tepat H-30 menit; tolak 1 detik sebelum buka; terima saat sesi berjalan; tolak tepat saat sesi berakhir; tolak tanggal lain (`hari-H` / `sudah berakhir`); perhitungan WIB (10:00 UTC = 17:00 WIB belum dibuka); jam kosong/tanggal invalid; jam tidak berurutan memakai min/max.
- **HTTP (`02-admin-flow`):** check-in booking +45 hari → 409 `hari-H`; walk-in hari ini pada slot kosong yang belum lewat → 200 + `checkedInBy`; check-in ganda → `already: true`. Jalur sukses dilewati otomatis bila tes dijalankan di luar jam operasional WIB.
- **Scanner:** pesan 409 API diteruskan sebagai "Di luar jadwal check-in"; bunyi gate dua nada (lolos) / nada rendah (ditolak) dengan tombol aktif/nonaktif.

## Uji QR Bertanda Tangan & Log Gate (2026-11-17)

Dijalankan terhadap `npm run dev:test` (port 3100) + DB uji. **79 test lulus (6 file).** `lint`, `typecheck`, `build` hijau.

- **Unit (`06-ticket-qr`, 9 test):** sign/verify valid; kode lowercase dinormalisasi; signature diubah → `signature`; kode lain → `code`; token kedaluwarsa → `expired`; secret berbeda → `signature`; payload sampah/versi salah → `format`; parse kode+expiry; extract kode dari token/URL/kode polos.
- **HTTP (`01-customer-flow`):** respons tiket memuat `qrPayload`/`qrExpiresAt`; `?qr=` valid → 200; expiry digeser tanpa tanda tangan ulang → 403 `tidak valid`.
- **HTTP (`02-admin-flow`):** check-in +45 hari dan check-in sukses menulis `scan_logs`; `GET /api/admin/scans?limit=5` mengembalikan log dengan outcome valid.
- **UI:** halaman tiket merotasi QR tiap ±4 menit + saat tab aktif; scanner kamera hanya menerima token bertanda tangan, sedangkan input manual tetap kode polos; riwayat dimuat dari server dan bertahan setelah reload.
- **Batas uji:** scan kamera fisik & screenshot tetap perlu uji manual di browser. Screenshot masih berlaku sampai TTL 5 menit (lihat ADR 0014).

## Uji Akhir Batch 4–7 (sekaligus)

Dilaksanakan 2026-09-30 terhadap dev server + Neon (pola Batch 1–3: contoh respons di `07-api-backend.md` adalah hasil panggilan asli). `build` hijau (seluruh route Batch 4–7 terdaftar).

- **B4 pembayaran:** OTP → booking → charge (`MOCK-QRIS:…`) → webhook `PAID`/`settlement` → `terkonfirmasi` + log `tiket`; webhook ganda `already:true`; charge booking lunas 409; order asing 404; body rusak 400; expiry paksa → cron → `dibatalkan` + payment `expired` + slot `kosong` + log `kadaluarsa`; cron tanpa/salah secret 401.
- **B5 tiket:** `GET /api/tickets/:kode` publik OK; kode asing 404; check-in: tanpa sesi 401, OK + `checkedInBy: admin`, ganda `already:true`, booking menunggu 409.
- **B6 pengingat:** cron di jendela H-2 & H-1 mengirim `pengingat_h2` + `pengingat_h1` via WA; run ulang idempoten (tanpa dobel); `/api/admin/notifications` tampilkan seluruh log audit; `/api/me/bookings` alimentasi `/riwayat`.
- **B7 laporan:** JSON ringkasan + per lapangan OK; CSV terunduh (`attachment`, header BOM); filter `courtId` OK; 401 tanpa sesi; 400 tanggal invalid. **Temuan & perbaikan:** `addDaysIso` memakai aritmetika tanggal lokal → di WIB selalu kembalikan 366 hari (error palsu); diganti UTC murni + `todayLocal()` (juga di cron reminders).

### UI / produk yang masih demo
- Driver mock pembayaran dipertahankan untuk lokal (QR dekoratif + simulasi-bayar); kunci Midtrans hanya di `.env` (gitignored) — tidak pernah di-commit. (→ sandbox/produksi)
- `src/lib/mock.ts` dipertahankan untuk landing, header publik, seed, dan simulator monitoring (sudah tak dipakai alur operasional).

### Teknis
- Gambar eksternal memakai `unoptimized`; `next.config.ts` belum memiliki `remotePatterns`.
- `EmptyState` dipakai untuk kondisi kosong kartu/tabel; pengecualian disengaja: papan TV (`papan-jadwal`, tema gelap), empty-state kamera scanner (ikon QR), dan not-found tiket (punya dua aksi).
- Repo: riwayat commit tersedia (`613dc9e` = revisi auth/notifikasi 2026-11-12); perubahan ganti-password, admin users, rate-limit, cron, CI, dan sinkron docs dikerjakan 2026-11-15.
- `npm run lint` + `typecheck` + `build` hijau; perbaikan `set-state-in-effect` di `/booking` memakai `useSyncExternalStore` (`src/lib/use-snap.ts`).

### Performa jadwal (`/api/slots`)
- `getDaySchedule` kini **satu roundtrip** (4 CTE + `json_agg`) — sebelumnya 4 query paralel yang menghabiskan 4 koneksi pool sekaligus.
- Cache per tanggal 5 detik (`SLOTS_CACHE_TTL_MS`) + versi per tanggal; penulis (booking, webhook, admin confirm/cancel, closure, cron expire) memanggil `bumpSlotsVersion()`.
- `GET /api/slots/status?date=&v=` membalas **304** bila tidak ada perubahan — polling 10 detik tidak menyentuh DB.
- Strip 7 tanggal memakai `GET /api/slots?from=&to=` (satu query), bukan 7 request.
- Slot `menunggu_pembayaran` membawa `expiresAt`; klien mengubahnya jadi kosong sendiri saat kedaluwarsa.
- Polling berhenti saat tab tidak terlihat (`visibilitychange`).

### Uji otomatis
- Jalankan: `cp .env.test.example .env.test` → `npm run db:migrate:test && npm run db:seed:test` → `npm run dev:test` (terminal 1) → `npm run test:api` (terminal 2).
- Serial (1 worker), ±80 request per run, tanpa load/stress test. Cleanup hanya menghapus baris nomor HP test + closure `TEST-*` + `scan_logs` milik booking test.
- Guard: tolak `TEST_BASE_URL` non-lokal, tolak DB yang sama dengan `.env`, dan butuh nama DB ber-`test` atau `TEST_DB_CONFIRMED="1"`.

### Kesiapan produksi (belum selesai)
- Notifikasi WhatsApp/Email & pengingat F6 ditunda ke v2.0 (PRD Q5) — tidak ada integrasi nyata di MVP.
- Cron F4 (expire) & cron anonimisasi walk-in dijadwalkan `vercel.json` ([ADR 0013](docs/06-adr/0013-rate-limit-cron-produksi.md)); host non-Vercel perlu scheduler eksternal dengan jadwal sama.
- Verifikasi email & **reset lupa password** mandiri belum ada (PRD Q7); reset via admin `/admin/users`, ganti password saat login lewat `/akun` ([ADR 0012](docs/06-adr/0012-ganti-password-mandiri.md)).
- Kredensial Midtrans: isi hanya di `.env`; key yang pernah tertulis di `.env.example` wajib di-rotate di dashboard Midtrans.
- Alur bayar Midtrans sandbox belum diuji end-to-end (butuh URL publik + key valid).

## Cara Memperbarui

1. Selesaikan satu tugas, lalu ubah status ⬜/🔄 menjadi ✅ (atau 🔄 saat dikerjakan).
2. Tambahkan tanggal penyelesaian di kolom **Catatan** bila relevan.
3. Jangan tandai ✅ jika acceptance criteria di `docs/03-spesifikasi-fitur.md` belum terpenuhi.
4. Pada tabel Fitur, kolom **Frontend** ✅ hanya untuk ketersediaan UI (data mock); **fitur dianggap selesai hanya bila kolom Backend ✅**.

## Catatan Operasional

- **DB:** isi `DATABASE_URL` (Neon) di `.env` terlebih dahulu. Jangan commit `.env`.
- Perintah: `npm run dev` · `npm run lint` · `npm run typecheck` · `npm run build` · `npm run db:generate` · `npm run db:migrate` · `npm run db:studio`.
- Koridor keputusan: baca `docs/06-adr/` sebelum mengubah area yang sudah dikunci.
- Visual: seluruh halaman mengikuti desain sistem yang disetujui; token warna/tipografi di `src/app/globals.css` (ringkas di [`docs/DESIGN.md`](docs/DESIGN.md)).