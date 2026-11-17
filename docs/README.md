# Dokumentasi — Sistem Penyewaan Lapangan Padel

Dokumen resmi untuk produk **Sistem Penyewaan Lapangan Padel (Padel Court Booking)**.
Seluruh dokumen berbahasa Indonesia. Keputusan teknis dikunci di [`06-adr/`](06-adr/); status implementasi dipantau di [`../PROGRESS.md`](../PROGRESS.md).

## Status Proyek

| Tahap | Status |
|---|---|
| Konsep Produk | ✅ Selesai |
| User Journey | ✅ Selesai |
| Spesifikasi Fitur | ✅ Selesai |
| PRD | ✅ Selesai |
| Keputusan Arsitektur (ADR) | ✅ Selesai (14 keputusan) |
| Spesifikasi Teknis | ⏳ Sebagian (PRD §4 + ADR 0005 & 0007) |
| Design System (DESIGN.md) | ✅ Diadopsi (token di `src/app/globals.css`) |
| Dokumentasi Backend API (07) | ✅ `1.5-qr` (34 paths / 36 operasi) |

## Indeks Dokumen

| Dokumen | Deskripsi | Prioritas Baca |
|---|---|---|
| [`01-konsep-produk.md`](01-konsep-produk.md) | Visi produk, masalah, persona, fitur utama, non-goals | 1 |
| [`02-user-journey.md`](02-user-journey.md) | Alur pengguna Customer & Admin, sitemap, prinsip UX | 2 |
| [`03-spesifikasi-fitur.md`](03-spesifikasi-fitur.md) | Detail tiap fitur + kriteria terima yang terukur | 3 |
| [`04-PRD.md`](04-PRD.md) | Product Requirements Document (dokumen master) | 4 |
| [`05-glossary.md`](05-glossary.md) | Istilah domain yang dipakai konsisten di semua dokumen | Referensi |
| [`06-adr/0001-qris-pihak-ketiga.md`](06-adr/0001-qris-pihak-ketiga.md) | Keputusan: QRIS via payment gateway pihak ketiga | Referensi |
| [`06-adr/0002-akun-nomor-hp.md`](06-adr/0002-akun-nomor-hp.md) | Keputusan: akun cukup nomor HP + OTP — **digantikan ADR 0009** | Referensi |
| [`06-adr/0003-notifikasi.md`](06-adr/0003-notifikasi.md) | Keputusan: notifikasi WhatsApp + Email otomatis — **digantikan ADR 0010** | Referensi |
| [`06-adr/0004-lapangan-configurable.md`](06-adr/0004-lapangan-configurable.md) | Keputusan: jumlah & jam lapangan configurable via admin | Referensi |
| [`06-adr/0005-tech-stack-nextjs-drizzle.md`](06-adr/0005-tech-stack-nextjs-drizzle.md) | Keputusan: stack Next.js + Drizzle ORM + Neon PostgreSQL | Referensi |
| [`06-adr/0006-batas-waktu-pembayaran-qris.md`](06-adr/0006-batas-waktu-pembayaran-qris.md) | Keputusan: batas pembayaran QRIS & pelepasan slot 15 menit | Referensi |
| [`06-adr/0007-payment-gateway-midtrans.md`](06-adr/0007-payment-gateway-midtrans.md) | Keputusan: payment gateway Midtrans (QRIS Core API — digantikan ADR 0008) | Referensi |
| [`06-adr/0008-snap-popup-pengganti-core-api.md`](06-adr/0008-snap-popup-pengganti-core-api.md) | Keputusan: Midtrans Snap popup semua metode (pengganti ADR 0007 + pengecualian non-goal QRIS) | Referensi |
| [`06-adr/0009-akun-email-password.md`](06-adr/0009-akun-email-password.md) | Keputusan: akun email + password tanpa OTP, wajib login sebelum checkout | Referensi |
| [`06-adr/0010-mvp-tanpa-notifikasi.md`](06-adr/0010-mvp-tanpa-notifikasi.md) | Keputusan: MVP tanpa notifikasi WhatsApp/Email; F6 dibatalkan | Referensi |
| [`06-adr/0011-user-bayangan-walkin.md`](06-adr/0011-user-bayangan-walkin.md) | Keputusan: user bayangan walk-in + anonimisasi 7 hari | Referensi |
| [`06-adr/0012-ganti-password-mandiri.md`](06-adr/0012-ganti-password-mandiri.md) | Keputusan: ganti password mandiri saat login (sesi lain dicabut) | Referensi |
| [`06-adr/0013-rate-limit-cron-produksi.md`](06-adr/0013-rate-limit-cron-produksi.md) | Keputusan: rate-limit Postgres lintas-instance + Vercel Cron | Referensi |
| [`06-adr/0014-qr-tiket-bertanda-tangan.md`](06-adr/0014-qr-tiket-bertanda-tangan.md) | Keputusan: QR tiket HMAC + rotasi 5 menit + log pemindaian gate | Referensi |
| [`DESIGN.md`](DESIGN.md) | Design system (diadopsi, status slot + arah visual) | Referensi |
| [`07-api-backend.md`](07-api-backend.md) | Dokumentasi backend API + contoh curl (versi per batch) | Referensi |
| [`07-api-backend.openapi.yaml`](07-api-backend.openapi.yaml) | Spesifikasi OpenAPI 3.1 (impor Postman/Swagger UI) | Referensi |

## Saran Alur Baca

1. Baca `01-konsep-produk.md` untuk memahami **mengapa** produk ini dibangun.
2. Lanjut `02-user-journey.md` untuk memahami **bagaimana** pengguna mengalaminya.
3. Baca `03-spesifikasi-fitur.md` sebagai detail operasional tiap fitur.
4. `04-PRD.md` adalah satu-satunya "source of truth" — ringkas seluruh hal di atas + bagian teknis (§4).
5. Gunakan `05-glossary.md` saat menemukan istilah yang ambigu.
6. Baca `06-adr/` saat akan merevisi keputusan yang sudah dikunci.
7. Baca `07-api-backend.md` (+ `.openapi.yaml`) untuk kontrak endpoint backend per batch.

## Keputusan Produk yang Sudah Dikunci

1. Pembayaran menggunakan **QRIS otomatis** melalui payment gateway pihak ketiga.
2. Akun pengguna: **email + password**, wajib login sebelum checkout, **tanpa OTP** ([ADR 0009](06-adr/0009-akun-email-password.md); menggantikan ADR 0002).
3. **Tidak ada notifikasi WhatsApp/Email di MVP**; tiket diakses di akun/tautan ([ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md); menggantikan ADR 0003).
4. Jumlah lapangan 5-10 dengan **jam operasional configurable** oleh admin.
5. Batas waktu pembayaran QRIS & pelepasan slot `Menunggu Pembayaran` = **15 menit**.
6. Payment gateway: **Midtrans** (**Snap popup**, semua metode — [ADR 0008](06-adr/0008-snap-popup-pengganti-core-api.md); sebelumnya QRIS Core API, ADR 0007).
7. Booking walk-in memakai **user bayangan**, dianonimisasi otomatis setelah **7 hari** ([ADR 0011](06-adr/0011-user-bayangan-walkin.md)).
8. **Ganti password mandiri** saat sudah login di `/akun`; reset lupa password tetap lewat admin ([ADR 0012](06-adr/0012-ganti-password-mandiri.md)).
9. Rate-limit endpoint sensitif **persisten di Postgres** + cron produksi via **Vercel Cron** ([ADR 0013](06-adr/0013-rate-limit-cron-produksi.md)).
10. QR tiket **bertanda tangan HMAC** dengan rotasi 5 menit; log pemindaian gate disimpan di `scan_logs` ([ADR 0014](06-adr/0014-qr-tiket-bertanda-tangan.md)).

## Changelog

| Tanggal | Perubahan |
|---|---|
| 2026-09-22 | Pembuatan awal seluruh dokumen |
| 2026-09-22 | Tambah dokumen design system (proposal) — `DESIGN.md` |
| 2026-09-22 | Tambah ADR 0005 (tech stack Next.js + Drizzle + Neon); mulai skelleton project |
| 2026-09-24 | Frontend-only build semua halaman sitemap (customer + admin) dengan data mock; `typecheck`/`lint`/`build` hijau. Backend (F1–F11) masih menunggu |
| 2026-09-26 | Restyle seluruh halaman mengikuti desain sistem Stitch; `DESIGN.md` naik ke status Diadopsi (token di `src/app/globals.css`); tambah 3 halaman admin demo (papan jadwal, monitoring, scanner) |
| 2026-09-28 | Tambah ADR 0006 (batas pembayaran QRIS 15 menit — menjawab PRD Q2 & Q3); seragamkan copy/countdown UI ke 15 menit |
| 2026-09-28 | Perapian frontend: struktur shell admin (shell tunggal + offset sidebar), guard `/admin` via `proxy.ts` (cookie demo), `loading`/`error`/`not-found`, metadata per halaman; daftar sisa kerja dicatat di `PROGRESS.md` |
| 2026-09-28 | `PROGRESS.md`: tabel F1–F11 memakai kolom Frontend/Backend (UI ✅, backend ⬜); ADR 0007 (payment gateway **Midtrans**, Core API QRIS — menjawab PRD Q1); PRD §4 diisi dari ADR; sinkron 02 (15 menit + sitemap demo), 03 (SHA-512, ekspor CSV), DESIGN v0.3 (token warna/font diadopsi) |
| 2026-09-30 | Backend Batch 1: API slot/closure/auth admin + wiring UI (`/booking`, `/admin/jadwal`, `/admin/lapangan`, login); F9 Backend ✅, F1/F7 Backend 🔄 |
| 2026-09-30 | Tambah `07-api-backend.md` + `07-api-backend.openapi.yaml` v1.0-batch1 (11 endpoint + contoh real + stub Batch 2–7) |
| 2026-09-30 | Backend Batch 2: OTP + booking online + walk-in + wiring UI (`/booking`, `/login`, `/admin/booking/baru`); F1/F2/F3/F8 Backend ✅; docs API v1.0-batch2 (17 endpoint) |
| 2026-09-30 | Backend Batch 3: monitoring admin (list/filter/confirm/cancel/overview) + wiring (`/admin/booking`, `/admin/dashboard`, tutup-dari-grid); F7/F10 Backend ✅; docs API v1.0-batch3 |
| 2026-09-30 | Backend Batch 4: pembayaran QRIS mock + expiry (charge/status/webhook/cron) + wiring `/booking` (QR payload + polling + simulasi-bayar); F4 Backend ✅; docs API v1.0-batch4 |
| 2026-09-30 | Backend Batch 5: tiket publik + check-in admin + wiring (`/tiket/:kode`, `/riwayat`, modal `/admin/booking`); F5 Backend ✅; docs API v1.0-batch5 |
| 2026-09-30 | Backend Batch 6: pengingat H-1/H-2jam + audit log + seksi log di `/admin/monitoring`; F6 Backend ✅; docs API v1.0-batch6 |
| 2026-09-30 | Backend Batch 7: laporan JSON + CSV server-side + wiring `/admin/laporan`; F11 Backend ✅; docs API v1.0-batch7 (final, seluruh F1–F11 Backend ✅) |
| 2026-10-01 | P1 Midtrans sandbox: driver `midtrans` (charge QRIS Core API + SHA-512) + QR asli + auto-redirect ke tiket setelah lunas |
| 2026-10-01 | ADR 0008: pembayaran pindah ke **Midtrans Snap popup** (semua metode, gantikan Core API QRIS) + pengecualian non-goal QRIS di PRD; charge kembalikan `snapToken`, webhook per-transaksi via `X-Override-Notification` |
| 2026-11-10 | Hardening: migrasi `0003` (11 index hot-path) + connection pool `max: 5`; fix lint `/booking` (`useSyncExternalStore` untuk snap.js); `.env.example` dibersihkan (kredensial Midtrans wajib di `.env` lokal); test HTTP vitest serial (`tests/api/*`, `npm run test:api`) |
| 2026-11-10 | Jadwal hemat: `getDaySchedule` satu roundtrip, cache + versi per tanggal, `GET /api/slots/status` balas 304 saat tidak ada perubahan, strip minggu satu request, `expiresAt` per slot agar klien membuka slot kedaluwarsa sendiri |
| 2026-11-12 | **Revisi scope:** ADR 0009 akun **email + password tanpa OTP** (menggantikan ADR 0002), ADR 0010 **MVP tanpa notifikasi WhatsApp/Email** + F6 dibatalkan (menggantikan ADR 0003), ADR 0011 **user bayangan walk-in + anonimisasi 7 hari**. Sinkron PRD v1.1 (KPI-3, US-04/05/06/08, non-goals, Q5/Q7/Q8), 01/02/03/05, PROGRESS |
| 2026-11-13 | Hardening auth: tiket `/tiket/:kode` **wajib login + pemilik** (API 401/403, halaman redirect `/login`), hapus tautan Admin Portal dari navbar publik, sesi pemain **token acak + hash SHA-256** (bukan HMAC), halaman `/akun` + ganti password. |
| 2026-11-15 | ADR 0012 ganti password mandiri; ADR 0013 rate-limit Postgres + Vercel Cron; halaman `/admin/users` (cari akun + reset password); migrasi `0005` tabel `rate_limits`; `vercel.json` cron expire/anonymize; CI GitHub Actions; docs API `1.2-akun` + OpenAPI disinkronkan. |
| 2026-11-17 | Privasi booking: `GET /api/bookings/:code` wajib sesi + pemilik (401/403, admin boleh semua); test guard tiket 401/booking 403/guest reset 409; docs API `1.3-privasi` + OpenAPI disinkronkan. |
| 2026-11-17 | QR tiket asli (`qrcode.react`) + scanner kamera gate (`jsqr`, dedupe 8 dtk, pilih kamera, fallback manual); F5 AC diperbarui. |
| 2026-11-17 | Jendela check-in gate hari-H (WIB, H-30 mnt s/d sesi berakhir) di API + pesan scanner; bunyi gate sukses/gagal; docs API `1.4-checkin`. 67 test lulus (5 file). |
| 2026-11-17 | ADR 0014: QR tiket bertanda tangan HMAC (TTL 5 mnt, `TICKET_QR_SECRET`) + verifikasi `?qr=` + log pemindaian persist (`scan_logs`, `GET /api/admin/scans`); migrasi `0006`; docs API `1.5-qr`. |