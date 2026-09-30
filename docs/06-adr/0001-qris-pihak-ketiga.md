# ADR 0001 — Pembayaran QRIS via Payment Gateway Pihak Ketiga

- **Status:** Accepted
- **Tanggal:** 2026-09-22
- **Pemilik:** Product Owner & Tech Lead

## Konteks
Pembayaran harus terkonfirmasi otomatis (tanpa admin) sehingga booking bisa langsung sah setelah pelanggan membayar. Ada dua jalur utama:

1. **Integrasi QRIS langsung** (kerjasama dengan bank / BI) — konfirmasi = `PAID` dari bank.
2. **Menggunakan payment gateway pihak ketiga** (mis. Midtrans, Xendit, Duitku) yang sudah menyediakan QRIS dinamis + webhook status.

## Keputusan
Menggunakan **payment gateway pihak ketiga** untuk pembayaran QRIS.

Alternatif penyedia (Midtrans / Xendit / Duitku) **belum dipilih** — keputusan akhir ditangguhkan ke sesi engineering (lihat Open Question Q1 di PRD).

> **Diperbarui:** pemilihan penyedia selesai di [ADR 0007](0007-payment-gateway-midtrans.md) — **Midtrans (Core API QRIS)**, 2026-09-28.

## Alasan
- **Kecepatan rilis MVP:** QRIS dinamis + webhook sudah siap pakai tanpa perlu urusan ke bank.
- **Konfirmasi otomatis:** webhook status `PAID` memungkinkan booking berubah `Terkonfirmasi` ≤ 10 detik.
- **Biaya terukur per transaksi:** jelas, tanpa investasi besar di awal.
- **Fokus MVP:** tim tidak perlu membangun infrastruktur pembayaran sendiri.
- **Perawatan lebih mudah:** compliance, upaya retry, dan settlement ditangani penyedia.

## Konsekuensi
- **Baik:** integrasi jauh lebih cepat; status pembayaran otomatis; tanggung jawab keamanan kartu/transaksi di tangan penyedia.
- **Buruk / perlu diwaspadai:**
  - Biaya fee per transaksi.
  - Ketergantungan pada pihak ketiga (vendor lock-in).
  - Jika webhook gagal, sistem perlu polling / fallback untuk melepas slot `Menunggu Pembayaran`.
  - Wajib memvalidasi signature webhook dan memetakan status `PAID`/`EXPIRED`/`FAILED` secara benar.

## Alternatif yang Ditolak
- Integrasi QRIS langsung ke bank/BI — terlalu lambat untuk MVP, perlu izin & kerja sama khusus, beban kepatuhan tinggi.

## Referensi
- [PRD — Open Questions Q1](../04-PRD.md#6-open-questions-belum-terjawab)
- [Spesifikasi Fitur F4 — Pembayaran QRIS](../03-spesifikasi-fitur.md#f4--pembayaran-qris-otomatis)