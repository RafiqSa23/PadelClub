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
| S9 | Git repo ter-inisialisasi | ✅ | Belum ada commit |
| S10 | Skema backend lengkap (otp_codes, admins, admin_sessions, kolom expiry/check-in) | ✅ | Migrasi `0001` + `0002` (2026-09-30) |
| S11 | Seed data (6 lapangan + jam 7 hari + admin) + `npm run db:seed` | ✅ | Idempotent, bisa diulang (2026-09-30) |
| S12 | Lib backend shared (slots, session HMAC, rate-limit, payment/notify mock driver) | ✅ | `src/lib/*.ts` (2026-09-30) |
| S13 | Auth admin backend (scrypt + sesi DB, ganti cookie demo) | ✅ | `POST /api/admin/login|logout`, `GET /api/admin/me` (2026-09-30) |

## Fitur MVP — Sisi Customer

> Dua kolom status: **Frontend** ✅ = antarmuka & interaksi sudah tersedia (masih data mock); **Backend** ✅ = acceptance criteria [`docs/03-spesifikasi-fitur.md`](docs/03-spesifikasi-fitur.md) terpenuhi (data real, endpoint aktif). Frontend ✅ **bukan** berarti fitur selesai — tidak ada fitur yang boleh ditandai selesai sebelum kolom Backend ✅.

| Fitur | Deskripsi | Frontend | Backend | Ref |
|---|---|---|---|---|
| F1 | Pencarian slot (tanggal → lapangan → jam) | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f1--pencarian-slot) |
| F2 | Keranjang booking multi-jam | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f2--keranjang-booking-multi-jam) |
| F3 | Checkout cepat (nomor HP + OTP) | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f3--checkout-cepat-nomor-hp--otp) |
| F4 | Pembayaran QRIS otomatis | ✅¹ | ✅ | [03](docs/03-spesifikasi-fitur.md#f4--pembayaran-qris-otomatis) |
| F5 | Tiket/bukti booking digital | ✅ | ✅ | [03](docs/03-spesifikasi-fitur.md#f5--tiket--bukti-booking-digital) |
| F6 | Pengingat otomatis (WhatsApp + Email) | —³ | ✅ | [03](docs/03-spesifikasi-fitur.md#f6--pengingat-otomatis-whatsapp--email) |

> ¹ Visual QR masih render dekoratif dari payload string asli (`MOCK-QRIS:…`, belum QR valid terpindai — menunggu driver Midtrans). ³ F6 berjalan latar belakang (cron + notifikasi) — tidak ada antarmuka pengguna.

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
| `/booking` | Wizard booking multi-step | ✅ | Charge QR mock + countdown expiry server + polling 5 dtk + simulasi-bayar + state kedaluwarsa (`/api/payments/*`, `/api/webhooks/payment`); QR valid menunggu Midtrans |
| `/login` | Login/registrasi nomor HP + OTP | ✅ | Real OTP + sesi `padel_session` (mode dev tampilkan kode) |
| `/tiket/:kode` | Tiket/bukti digital (tanpa login) | ✅ | Real: `GET /api/tickets/:kode` + notice Batal/Tutup + status check-in; toggle publik dihapus (check-in khusus admin) |
| `/riwayat` | Riwayat booking pemain | ✅ | Real: `GET /api/me/bookings` (+ `/api/courts` sidebar); butuh sesi OTP, ada CTA login |

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
| `/admin/laporan` | Rekap pendapatan & okupansi | ✅ | Real: `GET /api/admin/reports` (JSON ringkasan + per lapangan) + unduh CSV server-side |
| `/admin/papan-jadwal` | Papan jadwal publik (mode TV/lobi) | ✅ | Real read-only: `GET /api/admin/schedule` + refresh 15 dtk + nama tersamar; tanpa aksi · di luar sitemap PRD |
| `/admin/monitoring` | Monitoring web publik + banner siaran | ✅ | Log notifikasi real (20 terbaru via `/api/admin/notifications`); toggle maintenance palsu dinonaktifkan + seluruh panel demo dilabeli jelas · di luar sitemap PRD |
| `/admin/scanner` | Scanner tiket di gate (kamera/manual) | ✅ | Real: validasi via `GET /api/tickets/:kode` + check-in via `POST /api/admin/checkin`; kamera hanya pratinjau (validasi via input manual); log shift in-memory · di luar sitemap PRD |

## Sisa Pekerjaan (Belum Dikerjakan)

Daftar gap yang teridentifikasi setelah perapian frontend (2026-09-28). Kolom **Backend** pada tabel Fitur F1–F11 tetap ⬜ karena acceptance criteria [`docs/03-spesifikasi-fitur.md`](docs/03-spesifikasi-fitur.md) belum terpenuhi; kolom Frontend ✅ hanya berarti antarmuka sudah ada.

### Backend / data (fase berikutnya)
- Endpoint aktif: `/api/health`, `/api/courts`, `/api/slots`, `/api/otp/*`, `/api/bookings/*`, `/api/me/bookings`, `/api/payments/*`, `/api/webhooks/payment`, `/api/cron/*`, `/api/tickets/*`, `/api/admin/*` (Batch 1–7, final).
- ✅ Selesai Batch 1 (2026-09-30): F1 read-path real + F9 penuh + read-model F7 + auth admin backend.
- ✅ Selesai Batch 2 (2026-09-30): F1–F3 + F8 penuh (OTP mock-driver, transaksi anti-overbooking, walk-in) + wiring `/booking`, `/login`, `/admin/booking/baru`. Docs API v1.0-batch2 (17 endpoint).
- ✅ Selesai Batch 3 (2026-09-30): F7 + F10 penuh (list/filter/cari, confirm/cancel, overview KPI, tutup-dari-grid, refresh 15 dtk) + wiring `/admin/booking`, `/admin/dashboard`, `/admin/jadwal`. Docs API v1.0-batch3 (19 paths / 21 operasi).
- ✅ Selesai Batch 4 (2026-09-30): F4 penuh (charge idempoten, polling status, webhook PAID → `terkonfirmasi` + tiket, cron expire 15 mnt + log `kadaluarsa`) + wiring `/booking` (QR payload mock + polling 5 dtk + simulasi-bayar + state kedaluwarsa). Docs API v1.0-batch4 (23 paths / 25 operasi). Uji: charge → webhook → tiket + expiry paksa → cron → slot `kosong`.
- ✅ Selesai Batch 7 (2026-09-30): F11 penuh (JSON ringkasan + per lapangan, CSV server-side) + wiring `/admin/laporan`. Docs API v1.0-batch7 final (28 paths / 30 operasi). **Seluruh F1–F11 Backend ✅.**

## Uji Akhir Batch 4–7 (sekaligus)

Dilaksanakan 2026-09-30 terhadap dev server + Neon (pola Batch 1–3: contoh respons di `07-api-backend.md` adalah hasil panggilan asli). `build` hijau (seluruh route Batch 4–7 terdaftar).

- **B4 pembayaran:** OTP → booking → charge (`MOCK-QRIS:…`) → webhook `PAID`/`settlement` → `terkonfirmasi` + log `tiket`; webhook ganda `already:true`; charge booking lunas 409; order asing 404; body rusak 400; expiry paksa → cron → `dibatalkan` + payment `expired` + slot `kosong` + log `kadaluarsa`; cron tanpa/salah secret 401.
- **B5 tiket:** `GET /api/tickets/:kode` publik OK; kode asing 404; check-in: tanpa sesi 401, OK + `checkedInBy: admin`, ganda `already:true`, booking menunggu 409.
- **B6 pengingat:** cron di jendela H-2 & H-1 mengirim `pengingat_h2` + `pengingat_h1` via WA; run ulang idempoten (tanpa dobel); `/api/admin/notifications` tampilkan seluruh log audit; `/api/me/bookings` alimentasi `/riwayat`.
- **B7 laporan:** JSON ringkasan + per lapangan OK; CSV terunduh (`attachment`, header BOM); filter `courtId` OK; 401 tanpa sesi; 400 tanggal invalid. **Temuan & perbaikan:** `addDaysIso` memakai aritmetika tanggal lokal → di WIB selalu kembalikan 366 hari (error palsu); diganti UTC murni + `todayLocal()` (juga di cron reminders).

### UI / produk yang masih demo
- QR valid terpindai menunggu driver Midtrans (payload mock sudah real, visual masih dekoratif). (→ pasca-MVP/sandbox)
- `src/lib/mock.ts` dipertahankan untuk landing, header publik, seed, dan simulator monitoring (sudah tak dipakai alur operasional).

### Teknis
- Gambar eksternal memakai `unoptimized`; `next.config.ts` belum memiliki `remotePatterns`.
- `EmptyState` dipakai untuk kondisi kosong kartu/tabel; pengecualian disengaja: papan TV (`papan-jadwal`, tema gelap), empty-state kamera scanner (ikon QR), dan not-found tiket (punya dua aksi).
- Repo: hampir semua kerja frontend belum di-commit (repo masih 1 commit awal).

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