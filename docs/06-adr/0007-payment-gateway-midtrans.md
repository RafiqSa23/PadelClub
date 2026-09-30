# ADR 0007 — Payment Gateway: Midtrans (QRIS via Core API)

- **Status:** Accepted
- **Tanggal:** 2026-09-28
- **Pemilik:** Product Owner (pemilihan penyedia) & Tech Lead (detail integrasi)

## Konteks
[ADR 0001](0001-qris-pihak-ketiga.md) memutuskan pembayaran QRIS melalui payment gateway pihak ketiga, tetapi menunda pemilihan penyedia (PRD **Q1**: Midtrans / Xendit / Duitku) sampai sesi engineering. Fase implementasi backend pembayaran (F4) kini dimulai, sehingga satu penyedia harus dipilih agar driver pembayaran, webhook, dan pengujian sandbox dapat dibangun.

Kebutuhan teknis: QRIS dinamis yang tampil di halaman `/booking` (alur F4), webhook status dengan verifikasi signature, tersedia sandbox gratis untuk pengujian, dan dokumentasi/API yang matang untuk klien Node.js.

## Keputusan
Menggunakan **Midtrans** dengan integrasi **Core API QRIS**:

- Alur: server memanggil charge API (`payment_type: qris`) → Midtrans mengembalikan QR string/URL gambar QR → aplikasi menampilkan QR di halaman (bukan redirect ke halaman checkout Midtrans/Snap), mengikuti desain wizard single-page.
- Integrasi ditempatkan di belakang interface `PaymentDriver` (`createQrisCharge`, `getStatus`, `verifyWebhook`) dengan dua driver: **`midtrans`** (default) dan **`mock`** (fallback saat kredensial kosong / pengembangan lokal), dipilih lewat env `PAYMENT_DRIVER`.
- Konfirmasi pembayaran memakai **webhook** dengan verifikasi signature **SHA-512** (`order_id`, `gross_amount`, `status_code`, server key) dan handler **idempoten**; **polling status via cron** menjadi fallback bila webhook tidak sampai (mitigasi risiko [PRD](../04-PRD.md#52-technical-risks)).
- Masa berlaku QRIS tetap **15 menit** mengikuti [ADR 0006](0006-batas-waktu-pembayaran-qris.md).
- Pengujian memakai **akun sandbox MAP** (kunci `SB-Mid-…`) + Payment Simulator Midtrans; webhook diuji lokal lewat tunnel (ngrok/cloudflared) atau simulasi payload bertanda tangan.
- Keputusan ini **menjawab PRD Q1**.

## Alasan
- **MDR QRIS 0,7%** (merchant reguler) berlaku sama di semua gateway — harga bukan pembeda; pemilihan berdasarkan pengalaman pengembang dan ekosistem.
- **Ekosistem & alat uji:** bagian dari GoTo/GoPay, dokumentasi lengkap, Payment Simulator resmi untuk sandbox, dan klien resmi Node.js (`midtrans-nodejs-client`) bila diperlukan.
- **Core API (bukan Snap)** menjaga QR tampil di halaman sendiri — konsisten dengan UX "3 klik & 2 menit" dan desain `/booking`.
- **Adapter + driver mock** membuat F4/F3/F6 tetap dapat dijalankan end-to-end sebelum kredensial produksi tersedia, tanpa mengubah halaman UI.

## Konsekuensi
- **Baik:** F4 dapat diimplementasi end-to-end di sandbox; webhook idempoten + polling fallback memenuhi mitigasi risiko PRD; mengganti gateway kelak cukup mengganti driver.
- **Perlu diwaspadai:**
  - Butuh akun MAP (sandbox → produksi); kunci API hanya di `.env` (gitignored), tidak pernah di-commit.
  - Biaya MDR 0,7% per transaksi sukses.
  - Webhook butuh URL HTTPS publik (produksi: domain sendiri; lokal: tunnel/simulasi).
  - Sandbox tidak selalu mereproduksi edge case produksi — wajib smoke test uang nyata sebelum launch.
  - Vendor lock-in ringan tetap ada (lihat ADR 0001).

## Alternatif yang Ditolak
- **Xendit** — dokumentasi API bersih, namun MDR QRIS sama (0,7%) dan tidak ada keunggulan khusus untuk kebutuhan MVP kami; tetap kandidat bila Midtrans bermasalah (cukup ganti driver).
- **Duitku** — ekosistem & materi integrasi lebih terbatas dibanding Midtrans/Xendit.
- **Snap (Midtrans)** — checkout hosted di domain Midtrans; menggeser pengguna keluar dari alur wizard single-page kita.
- **Tetap driver mock sampai rilis** — menunda penutupan Q1, pengujian webhook nyata, dan integrasi sandbox.

## Referensi
- [04 — PRD, Open Questions Q1](../04-PRD.md#6-open-questions-belum-terjawab)
- [ADR 0001 — QRIS via pihak ketiga](0001-qris-pihak-ketiga.md)
- [ADR 0006 — Batas pembayaran QRIS 15 menit](0006-batas-waktu-pembayaran-qris.md)
- [Spesifikasi Fitur F4 — Pembayaran QRIS](../03-spesifikasi-fitur.md#f4--pembayaran-qris-otomatis)
- Dokumentasi Midtrans: QRIS Core API & payment notification (docs.midtrans.com)
