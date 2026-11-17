# ADR 0015 — Header Keamanan Global & Retensi Audit Gate

- **Status:** Accepted
- **Tanggal:** 2026-11-17
- **Pemilik:** Tech Lead

## Konteks
Dua celah produksi tersisa setelah P2:

1. Aplikasi tidak mengirim header keamanan apa pun. Browser bebas menempelkan halaman di iframe pihak lain (clickjacking), menebak tipe konten, atau mengirim referrer penuh ke situs luar. `X-Powered-By: Next.js` juga membocorkan stack.
2. `scan_logs` bertambah setiap check-in dan belum punya kebijakan retensi ([ADR 0014](0014-qr-tiket-bertanda-tangan.md) mencatatnya sebagai konsekuensi terbuka). Tanpa pembersihan, tabel audit tumbuh tanpa batas meski data lama tidak lagi dipakai operasional.

## Keputusan
### Header keamanan
- Dipasang **global untuk semua path** lewat `next.config.ts` → `headers()`, sumber tunggal `src/lib/security-headers.ts`:
  - `Content-Security-Policy: base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` (cadangan untuk browser lama)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(self), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` **hanya saat `NODE_ENV=production`**
- `poweredByHeader: false` menghapus `X-Powered-By`.
- **CSP sengaja tanpa `default-src`/`script-src` penuh.** Midtrans Snap memuat `snap.js` dan iframe dari `app.midtrans.com`/`app.sandbox.midtrans.com`; mengunci script sekarang berisiko mematahkan pembayaran yang belum diuji e2e. CSP penuh butuh nonce per request dan akan dibahas terpisah.
- Kamera diizinkan untuk origin sendiri karena scanner gate memakai `getUserMedia`; mikrofon dan geolokasi diblokir.

### Retensi audit
- `scan_logs` disimpan **90 hari** (default), diatur `SCAN_LOG_RETENTION_DAYS` dan dijepit ke **7–365 hari** agar salah konfigurasi tidak menghapus audit terlalu cepat.
- Pembersihan menumpang **cron anonimisasi harian** (`GET /api/cron/anonymize`, 03:00 UTC) — bukan cron expire tiap 5 menit — dan mengembalikan `scanLogsDeleted` + `scanLogRetentionDays`.
- Helper murni `src/lib/scan-log-retention.ts` (parse env + cutoff) dan `cleanupScanLogs()` di `src/lib/scan-log.ts` (best-effort; gagal → 0 + log server, cron lain tetap jalan).

## Alasan
- Header global murah, tidak butuh dependensi, dan menutup kelas serangan umum tanpa mengubah UI.
- Retensi harian cukup untuk volume MVP dan menghindari query hapus yang sering.
- Menjepit nilai env mencegah dua mode kegagalan: audit hilang dalam hitungan jam atau tabel tumbuh selamanya karena nilai tidak valid.
- Audit tetap tersedia lebih dari satu kuartal — cukup untuk sengketa check-in dan evaluasi operasional.

## Konsekuensi
- **Baik:** clickjacking/plugin embedding diblokir; referrer tidak bocor penuh; stack tidak diumumkan; tabel audit tidak tumbuh tanpa batas.
- **Perlu diwaspadai:**
  - HSTS belum diuji di domain produksi. Setelah domain final dan HTTPS stabil, pertimbangkan `preload` (permanen — jangan sebelum yakin).
  - CSP belum membatasi `script-src`/`connect-src`; XSS yang lolos tetap bisa memuat script luar. Perketat dengan nonce saat jalur Midtrans sudah diuji e2e.
  - Log yang lebih tua dari retensi hilang permanen; ekspor dulu bila dibutuhkan untuk audit jangka panjang.
  - Cron anonimisasi wajib berjalan di produksi; tanpa scheduler, retensi tidak pernah dieksekusi.

## Alternatif yang Ditolak
- **CSP ketat sekarang (`default-src 'self'`):** memblokir `snap.js`/iframe Midtrans dan berpotensi mematahkan pembayaran.
- **Nonce CSP via `proxy.ts`:** lebih kuat, tetapi memaksa render dinamis pada halaman yang sekarang statis dan menambah kompleksitas; ditunda sampai pembayaran tervalidasi.
- **Retensi di cron expire (5 menit):** query hapus terlalu sering untuk manfaat yang sama.
- **Tanpa batas bawah env:** nilai `0`/`1` bisa menghapus audit yang masih dibutuhkan.
- **Hapus `scan_logs` saat booking dihapus:** bertentangan dengan ADR 0014 (log tetap ada via `code`, `bookingId` nullable).

## Referensi
- [ADR 0013 — Rate-limit Lintas-instance & Cron Produksi](0013-rate-limit-cron-produksi.md)
- [ADR 0014 — QR Tiket Bertanda Tangan & Log Pemindaian Gate](0014-qr-tiket-bertanda-tangan.md)
- [Dokumentasi API — §7c](../07-api-backend.md#7c-endpoint-admin--cron-anonimisasi-notifikasi-dipensiunkan)
- [`PROGRESS.md` — Kesiapan produksi](../../PROGRESS.md)
