# ADR 0006 — Batas Waktu Pembayaran QRIS 15 Menit

- **Status:** Accepted
- **Tanggal:** 2026-09-28
- **Pemilik:** Product Owner

## Konteks
Saat invoice dibuat, slot ditahan dengan status `Menunggu Pembayaran` sampai pelanggan membayar atau batas waktu habis. PRD sebelumnya membiarkan ini sebagai open question (Q2: batas pembayaran QRIS; Q3: kapan slot dilepas kembali), dengan rentang indikatif 15–30 menit mengikuti batas umum payment gateway. Di UI, angka ini sempat tidak konsisten (10 menit di legenda status, 15 menit di teks, 30 menit di countdown), sehingga perlu satu angka resmi yang dipakai seragam.

## Keputusan
Batas waktu pembayaran QRIS adalah **15 menit** sejak invoice dibuat.

- Slot berstatus `Menunggu Pembayaran` **maksimal 15 menit**; lewat batas, booking kedaluwarsa dan slot otomatis kembali `Kosong`.
- Angka yang sama berlaku seragam di seluruh antarmuka (legenda status, countdown pembayaran, teks konfirmasi) maupun pada implementasi backend nanti (timer server-side).
- Menjawab sekaligus [PRD](../04-PRD.md#6-open-questions-belum-terjawab) **Q2** (batas pembayaran QRIS) dan **Q3** (pelepasan slot `Menunggu Pembayaran`).

## Alasan
- **Konsistensi:** satu angka untuk semua UI dan lapisan backend menghindari kebingungan pelanggan.
- **Cukup untuk pembayaran normal:** scan QRIS dari e-wallet/m-banking umumnya selesai dalam hitungan detik; 15 menit memberi ruang untuk pengguna lambat tanpa menahan slot terlalu lama.
- **Okupansi lapangan:** slot yang terkunci 30 menit menurunkan peluang terjualnya jam tersebut pada jam sibuk.
- **Sesuai prinsip produk "3 klik & 2 menit":** jangan menambah waktu tunggu yang tidak perlu.

## Konsekuensi
- **Baik:** perilaku dapat diprediksi; implementasi mudah disamakan antara frontend dan backend; keputusan Q2/Q3 tertutup.
- **Perlu diwaspadai:**
  - Saat backend, timer harus dihitung **server-side** (bukan countdown browser) agar slot dilepas andal.
  - Perlu mekanisme pembayaran terlambat (mis. admin override / bayar setelah batas dengan konfirmasi) — belum dirancang, dapat ditinjau ulang bila data menunjukkan banyak pembayaran melewati 15 menit.
  - Gateway terpilih nanti (Q1) harus mendukung ekspirasi 15 menit atau disesuaikan via parameter invoice.

## Alternatif yang Ditolak
- **30 menit** — slot terkunci dua kali lebih lama, menurunkan okupansi pada prime time.
- **10 menit** — terlalu sempit untuk pelanggan yang harus memasukkan PIN / membuka aplikasi bank.
- **Fleksibel per booking/admin** — menambah kompleksitas dan membuat pengalaman tidak konsisten.

## Referensi
- [04 — PRD, Open Questions Q2 & Q3](../04-PRD.md#6-open-questions-belum-terjawab)
- [Spesifikasi Fitur F4 — Pembayaran QRIS](../03-spesifikasi-fitur.md#f4--pembayaran-qris-otomatis)
- [ADR 0001 — QRIS via pihak ketiga](0001-qris-pihak-ketiga.md)
