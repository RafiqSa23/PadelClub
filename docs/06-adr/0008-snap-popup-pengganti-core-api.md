# ADR 0008 — Pembayaran: Midtrans Snap Popup (menggantikan Core API QRIS)

- **Status:** Accepted
- **Tanggal:** 2026-10-01
- **Pemilik:** Product Owner
- **Menggantikan:** [ADR 0007](0007-payment-gateway-midtrans.md) (Core API QRIS)

## Konteks
ADR 0007 memilih Midtrans **Core API QRIS** agar QR tampil di halaman sendiri (wizard single-page) dan menolak Snap karena membawa user keluar dari alur. Saat implementasi (P1), render QR sendiri terbukti menambah kerumitan (gambar QR, simulator, expiry ganda) dan memperlambat pengujian sandbox. Product Owner memutuskan memakai **Snap popup embed** (`snap.pay`) — user tetap di halaman `/booking`, hanya jendela bayar yang di-host Midtrans.

Bersamaan dengan itu, Product Owner membuka **semua metode pembayaran Snap** (kartu, transfer bank, e-wallet, QRIS, gerai retail). Ini adalah **pengecualian terhadap non-goal PRD §2.3** ("pembayaran selain QRIS") yang disetujui eksplisit — dicatat di sini dan di PRD.

## Keputusan
- Integrasi pembayaran memakai **Midtrans Snap popup**: server memanggil `POST {base}/snap/v1/transactions` → menerima `token` + `redirect_url` → frontend membuka `snap.pay(token)` di halaman `/booking`.
- `enabled_payments` **sengaja tidak dikirim** (semua metode aktif). Bila kelak ingin kembali QRIS-only, cukup set `enabled_payments: ["qris"]` — satu baris di driver.
- Expiry transaksi Snap diselaraskan ke sisa waktu booking (maks 60 menit, mengikuti batas 15 menit [ADR 0006](0006-batas-waktu-pembayaran-qris.md)); sumber kebenaran tetap `bookings.expiresAt` server.
- Webhook tidak berubah: notifikasi HTTP Midtrans dengan verifikasi **SHA-512** + handler idempoten (sudah dibangun di P1). URL notifikasi dikirim **per transaksi** via header `X-Override-Notification` (basis `APP_PUBLIC_URL`) sehingga tidak bergantung pada setting dashboard — penting saat URL publik berubah-ubah (ngrok).
- `callbacks.finish` per transaksi mengarah ke `/tiket/:kode` (fallback bila popup diganti redirect).
- Driver `mock` dipertahankan untuk pengembangan lokal tanpa kredensial (jalur QR dekoratif + simulasi-bayar). Keputusan ini **menjawab PRD Q1** (menggantikan jawaban ADR 0007).

## Alasan
- **Operasional:** tidak perlu render/mengunduh QR sendiri; Midtrans menangani seluruh UI bayar + edge case tiap metode.
- **UX:** popup embed menjaga user di halaman booking — kompromi yang diterima atas keberatan ADR 0007 terhadap Snap redirect.
- **Bisnis:** semua metode = konversi lebih tinggi; QRIS tetap tersedia sebagai salah satu opsi.
- **Adapter tetap:** penggantian Core API → Snap hanya menyentuh driver + halaman booking; webhook, polling, tiket, dan laporan tidak berubah.

## Konsekuensi
- **Baik:** pengujian sandbox lebih mudah (test card bawaan Snap, tanpa simulator QRIS); tidak ada setting dashboard wajib per environment.
- **Perlu diwaspadai:**
  - Scope MVP melebar (non-QRIS) — KPI dan teks bantuan/UI disesuaikan (tidak lagi "QRIS saja").
  - Client key diekspos ke browser via `snap.js` (public by design, aman) lewat `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`.
  - Ketergantungan pada ketersediaan `snap.js` — ada fallback link `redirect_url` (buka di tab baru) bila popup diblokir.
  - Kunci API hanya di `.env` (gitignored), tidak pernah di-commit; sandbox (`SB-Mid-…`) vs production dibedakan `MIDTRANS_IS_PRODUCTION`.
  - Biaya mengikuti tiap metode (kartu/VA/gerai berbeda dari MDR QRIS 0,7%).
- **Perubahan dokumen:** PRD §2.3 (cabut larangan non-QRIS) & §4.2 (Core API → Snap), changelog `README.md`, `07-api-backend.md`, `PROGRESS.md`.

## Alternatif yang Ditolak
- **Tetap Core API QRIS (ADR 0007)** — render QR sendiri + uji simulator memperlambat; ditinggalkan, ADR 0007 berstatus digantikan.
- **Snap redirect penuh** — membawa user keluar dari halaman booking; popup mencapai hasil sama dengan UX lebih baik.
- **Batasi `enabled_payments` ke QRIS** — patuh PRD lama, tetapi Product Owner memilih konversi lebih luas; opsi ini tetap tersedia satu baris bila dibutuhkan.

## Referensi
- [ADR 0007 — Midtrans Core API QRIS (digantikan)](0007-payment-gateway-midtrans.md)
- [ADR 0001 — QRIS via pihak ketiga](0001-qris-pihak-ketiga.md)
- [ADR 0006 — Batas pembayaran QRIS 15 menit](0006-batas-waktu-pembayaran-qris.md)
- [04 — PRD §2.3 Non-Goals](../04-PRD.md) · [03 — Spesifikasi Fitur F4](../03-spesifikasi-fitur.md#f4--pembayaran-qris-otomatis)
- Dokumentasi Midtrans: Snap API & HTTP notification (docs.midtrans.com)
