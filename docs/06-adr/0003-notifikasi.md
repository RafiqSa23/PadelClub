# ADR 0003 — Notifikasi Otomatis Melalui WhatsApp + Email

- **Status:** Accepted
- **Tanggal:** 2026-09-22
- **Pemilik:** Product Owner & Tech Lead

## Konteks
Produk perlu memberitahu pelanggan tentang: (a) OTP, (b) konfirmasi booking + tiket, (c) reminder H-1 dan H+2 jam sebelum jadwal. Pelanggan segmen ini paling aktif di WhatsApp; email sebagai kanal cadangan.

## Keputusan
Notifikasi otomatis dikirim melalui **WhatsApp (kanal utama) dan Email (kanal pendukung)**.

- **WhatsApp:** digunakan untuk OTP, konfirmasi booking, tiket, dan reminder.
- **Email:** digunakan untuk tanda terima riwayat dan reminder (bila email tersedia).
- **Fallback:** jika WhatsApp gagal, sistem mengirim via Email (bila tersedia) dan mencatat log pengiriman untuk retry.

## Alasan
- **Tingkat keterbukaan:** pelanggan selalu mengecek WhatsApp — reminder lebih efektif.
- **Bukti terdokumentasi:** email berfungsi sebagai arsip resmi transaksi.
- **Dua kanal** → mitigasi kegagalan satu kanal.
- **Retry & audit:** log pengiriman sebagai dasar validasi KPI-3 (≥ 80% sukses).

## Konsekuensi
- **Baik:** jangkauan luas, pengingat akurat, tiket bisa dibagikan ke grup.
- **Perlu diwaspadai:**
  - Biaya per pesan (WhatsApp Business API / gateway).
  - Kepatuhan template pesan investasi (WhatsApp Business API mewajibkan template yang disetujui).
  - Risiko nomor diblokir / di-spam-report.
  - Email wajib tervalidasi agar tidak masuk spam.
- **Keputusan lanjutan:** penyedia WhatsApp Business API dan model biaya → Open Question Q5 di PRD.

## Alternatif yang Ditolak
- Hanya notifikasi dalam aplikasi (di luar ekosistem web bookmarkable) — mudah terlewat.
- SMS sebagai kanal utama — biaya lebih tinggi per pesan, keterbatasan multimedia.

## Referensi
- [PRD — KPI-3](../04-PRD.md#13-success-criteria-kpi)
- [Spesifikasi Fitur F6 — Pengingat](../03-spesifikasi-fitur.md#f6--pengingat-otomatis-whatsapp--email)