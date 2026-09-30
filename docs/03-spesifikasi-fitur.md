# 03 — Spesifikasi Fitur

> Format tiap fitur: Tujuan → Alur → Kriteria Terima (AC) → Batasan.
> Semua jam format 24 jam. Harga contoh Rp35.000/jam/lapangan (final ditetapkan admin).

## Isi Dokumen

- [F1 — Pencarian Slot (Tanggal → Lapangan → Jam)](#f1--pencarian-slot)
- [F2 — Keranjang Booking Multi-Jam](#f2--keranjang-booking-multi-jam)
- [F3 — Checkout Cepat (Nomor HP + OTP)](#f3--checkout-cepat-nomor-hp--otp)
- [F4 — Pembayaran QRIS Otomatis](#f4--pembayaran-qris-otomatis)
- [F5 — Tiket / Bukti Booking Digital](#f5--tiket--bukti-booking-digital)
- [F6 — Pengingat Otomatis (WhatsApp + Email)](#f6--pengingat-otomatis-whatsapp--email)
- [F7 — Dashboard Jadwal Harian](#f7--dashboard-jadwal-harian)
- [F8 — Booking Manual (Walk-in / Telepon)](#f8--booking-manual)
- [F9 — Tutup Lapangan (Maintenance)](#f9--tutup-lapangan-maintenance)
- [F10 — Konfirmasi & Monitoring Pembayaran](#f10--konfirmasi--monitoring-pembayaran)
- [F11 — Riwayat & Laporan](#f11--riwayat--laporan)

---

## F1 — Pencarian Slot

- **Tujuan:** Pelanggan menemukan jam kosong yang tepat tanpa bertanya ke admin.
- **Alur:**
  1. Pilih tanggal pada kalender.
  2. Pilih lapangan (semua lapangan tampil sekaligus dalam grid).
  3. Pilih 1–beberapa slot jam yang kosong.
- **Kriteria Terima (AC):**
  - Grid menampilkan semua lapangan × jam dalam rentang operasional tanggal tersebut.
  - Slot berstatus `Kosong` dapat diklik; `Terkonfirmasi`/`Menunggu Pembayaran`/`Tutup` tidak dapat diklik.
  - Harga per jam tampil di samping setiap lapangan.
  - Slot yang sedang diproses pelanggan lain dikunci real-time (optimistic concurrency).
  - Respons grid berlaku ≤ 1 detik untuk 10 lapangan × 24 jam (data lokal).
- **Batasan:** Minimum durasi 1 jam; sistem membagi jam dalam satuan 1 jam.

---

## F2 — Keranjang Booking Multi-Jam

- **Tujuan:** Pelanggan dapat memesan beberapa jam berurutan dalam satu transaksi.
- **Alur:** Klik slot jam → masuk ke panel ringkasan → subtotal dihitung otomatis → klik "Lanjut ke Pembayaran".
- **Kriteria Terima (AC):**
  - Slot yang dipilih tampil sebagai daftar (misal: Lapangan A: 18:00–20:00, 2 jam).
  - Subtotal = jumlah jam × harga/jam lapangan terpilih.
  - Pelanggan dapat menghapus satu slot sebelum checkout.
  - Hanya slot berurutan dalam lapangan yang sama yang dibolehkan dalam satu booking (konfirmasi saat refinement bila perlu multi-lapangan).
- **Batasan:** Tidak ada diskon otomatis (MVP).

---

## F3 — Checkout Cepat (Nomor HP + OTP)

- **Tujuan:** Identifikasi pelanggan semudah mungkin tanpa password.
- **Alur:**
  1. Input nama + nomor HP.
  2. Sistem mengirim OTP via WhatsApp (fallback SMS).
  3. Input kode OTP → akun terverifikasi → lanjut pembayaran.
- **Kriteria Terima (AC):**
  - OTP terkirim ≤ 30 detik setelah permintaan.
  - OTP berlaku 5 menit dan hanya bisa digunakan sekali.
  - Tombol "Kirim ulang" muncul setelah 60 detik.
  - Nomor HP dianggap terdaftar (create akun otomatis saat pertama kali).
  - Maksimal 5 percobaan verifikasi gagal per nomor sebelum blokir sementara.
- **Keamanan:** Batasi percobaan (rate-limit), data nomor HP disimpan terenkripsi (detail TBD).

---

## F4 — Pembayaran QRIS Otomatis

- **Tujuan:** Konfirmasi pembayaran otomatis tanpa input manual dari admin.
- **Alur:**
  1. Sistem membuat invoice → payment gateway menghasilkan QRIS (dinamis).
  2. Pelanggan pindai QRIS / bayar dari aplikasi e-wallet.
  3. Webhook gateway mengirim status seperti `PAID` → booking otomatis `Terkonfirmasi`.
- **Kriteria Terima (AC):**
  - Booking berstatus `Menunggu Pembayaran` sejak invoice dibuat.
  - QRIS aktif **15 menit** sejak invoice dibuat (keputusan [ADR 0006](06-adr/0006-batas-waktu-pembayaran-qris.md); batas gateway umumnya 15–30 menit).
  - Email & WhatsApp berisi tautan pembayaran ulang jika QRIS kedaluwarsa.
  - Saat `PAID` diterima: status booking berubah `Terkonfirmasi` ≤ 10 detik, tiket dikirim otomatis.
  - Pesanan tidak dibayar setelah batas waktu → slot kembali `Kosong`, pelanggan diberi notifikasi.
- **Batasan:** Hanya QRIS di MVP. Webhook signature diverifikasi **SHA-512** (`order_id`, `gross_amount`, `status_code`, server key) dengan handler idempoten — Midtrans, [ADR 0007](06-adr/0007-payment-gateway-midtrans.md).

---

## F5 — Tiket / Bukti Booking Digital

- **Tujuan:** Bukti valid yang bisa dilihat, dibagikan, dan digunakan untuk check-in.
- **Alur:** Saat `Terkonfirmasi`, sistem menghasilkan tiket → dikirim via WhatsApp + Email → bisa diakses lewat `/tiket/:kode`.
- **Kriteria Terima (AC):**
  - Tiket memuat: kode unik, nama&HP pemesan, lapangan, tanggal, jam, durasi, total harga, status.
  - Tautan tiket dapat dibuka tanpa login (token/kode unik).
  - Admin dapat menandai pelanggan "sudah check-in" dari halaman tiket.
  - Tiket berstatus `Batal`/`Tutup` menampilkan pemberitahuan jelas bila dilihat.
- **Batasan:** Tiket tidak bisa dipindah-tangankan secara langsung (pemindahan hak di luar MVP).

---

## F6 — Pengingat Otomatis (WhatsApp + Email)

- **Tujuan:** Mengurangi lupa jadwal (masalah C6).
- **Alur:**
  1. Setelah `Terkonfirmasi`, jadwalkan dua notifikasi.
  2. Kirim saat H-1 dan H+2 jam sebelum jam mulai.
- **Kriteria Terima (AC):**
  - Pesan dikirim tepat 24 jam dan 2 jam sebelum jadwal (± toleransi 2 menit).
  - Isi pesan: tanggal, jam, lapangan, nama, kode booking.
  - Terkirim ke WhatsApp (% nomor Indonesia) dan email (bila tersedia).
  - Upaya ulang otomatis 3x jika gagal terkirim (interval TBD).
  - Log pengiriman tersimpan untuk audit.
- **Batasan:** Email opsional bila pelanggan tidak mengisinya; WhatsApp wajib.

---

## F7 — Dashboard Jadwal Harian

- **Tujuan:** Admin melihat seluruh jadwal satu layar.
- **Alur:** Login admin → pilih tanggal → grid lapangan × jam.
- **Kriteria Terima (AC):**
  - Grid strip default hari ini.
  - Status warna konsisten dengan matriks status slot (lihat docs 02).
  - Klik slot menampilkan modal detail booking (tanpa pindah halaman).
  - Aksi "Buat Booking Manual" dan "Tutup Lapangan" dapat dipicu dari grid.
  - Data tersegarkan real-time (booking baru muncul tanpa reload manual).

---

## F8 — Booking Manual (Walk-in / Telepon)

- **Tujuan:** Admin menginput booking pelanggan yang datang tanpa booking online.
- **Alur:** Dashboard → "+ Booking Manual" → form → pilih "Tunai/Sudah Bayar" atau "Belum Bayar" → submit → tiket.
- **Kriteria Terima (AC):**
  - Form tervalidasi (nama & HP wajib, slot tidak boleh bentrok).
  - Booking "Sudah Bayar" langsung berstatus `Terkonfirmasi`; "Belum Bayar" berstatus `Menunggu Pembayaran`.
  - Sistem menolak apabila slot yang dipilih sudah `Terkonfirmasi`/`Tutup`.
  - Tiket langsung dapat diakses/dikirim via WhatsApp oleh admin.

---

## F9 — Tutup Lapangan (Maintenance)

- **Tujuan:** Memblokir slot agar tidak bisa dipesan selama perbaikan.
- **Alur:** jadwal → pilih lapangan & rentang → alasan → simpan.
- **Kriteria Terima (AC):**
  - Bisa menutup seluruh hari (satu tanggal) atau rentang jam.
  - Slot tertutup tidak muncul sebagai `Kosong` untuk pelanggan.
  - Admin fleksibel menghapus penutupan sebelum waktunya.
  - Booking yang sudah ada pada rentang tersebut tidak terpengaruh (tidak di-cancel otomatis) — konfirmasi saat refinement.

---

## F10 — Konfirmasi & Monitoring Pembayaran

- **Tujuan:** Admin dapat melihat status pembayaran & menindak pesanan masalah.
- **Alur:** `/admin/booking` → filter status → aksi per baris.
- **Kriteria Terima (AC):**
  - Daftar booking dapat difilter & dicari (nama/HP/kode/lapangan/tanggal).
  - Aksi yang tersedia: lihat detail, konfirmasi manual (jika perlu), batalkan.
  - Pengingat otomatis bagi booking `Menunggu Pembayaran` yang hampir kedaluwarsa.
- **Batasan:** Di MVP, pembayaran QRIS otomatis; konfirmasi manual hanya untuk remediasi / walk-in.

---

## F11 — Riwayat & Laporan

- **Tujuan:** Data penjualan untuk pengambilan keputusan (masalah A5).
- **Alur:** `/admin/laporan` → pilih periode/lapangan → lihat tabel & ringkasan.
- **Kriteria Terima (AC):**
  - Laporan dapat ditampilkan per hari / per bulan / kustom rentang tanggal.
  - Metrik: omzet, total booking, booking dibatalkan, okupansi per lapangan.
  - Dapat diekspor — **CSV** untuk MVP; PDF di luar cakupan MVP.
- **Batasan:** Tidak ada penggabungan multi-venue.

---

*Lanjut ke: [04 — PRD](04-PRD.md) · Kembali ke: [02 — User Journey](02-user-journey.md)*