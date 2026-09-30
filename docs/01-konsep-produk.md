# 01 — Konsep Produk

## 1. Visi Produk

**Satu kalimat:** Aplikasi web yang membuat pemain padel bisa memesan lapangan dalam 3 klik & 2 menit, dan membuat pemilik lapangan bisa mengelola jadwal tanpa buku tulis, tanpa WhatsApp manual, dan tanpa overbooking.

**Posisi produk:** Booking padel online-first — transaksi utama selesai di dalam aplikasi, tanpa perlu admin merespons chat.

---

## 2. Masalah Utama

### 2.1 Masalah Pemain (Customer)

| # | Masalah | Dampak Nyata |
|---|---|---|
| C1 | Harus telepon / chat / WhatsApp hanya untuk menanyakan jam kosong | Ribet, antre balasan lama, di luar jam operasional tidak ada yang melayani |
| C2 | Jam yang diklaim kosong ternyata sudah terisi / di-booking pemain lain | Datang ke lapangan tetapi harus pulang, hilang waktu & bensin |
| C3 | Tidak tahu harga pasti + biaya tambahan sejak awal | Kaget saat di lokasi, merasa ditipu, enggan booking ulang |
| C4 | Pembayaran manual (transfer) + kirim bukti chat | Booking baru dianggap sah berjam-jam kemudian, slot bisa kehabisan |
| C5 | Booking tidak tersimpan rapi (chat terhapus, lupa) | Tidak ada riwayat, tidak ada bukti yang bisa diandalkan saat komplain |
| C6 | Tidak ada pengingat jadwal | Lupa bermain, uang booking hilang sia-sia |
| C7 | Tidak bisa booking di luar jam kerja admin (malam hari) | Booking paling sering dicari justru tidak bisa dilakukan |

### 2.2 Masalah Pemilik Lapangan (Admin / Owner)

| # | Masalah | Dampak Nyata |
|---|---|---|
| A1 | Jadwal dicatat manual (buku fisik / Excel) | Sering salah catat, sulit dicek cepat saat ramai |
| A2 | Sulit membedakan pembayaran yang sudah sah | Uang tercecer, muncul booking "hantu" yang menghalangi pelanggan lain |
| A3 | Booking ganda karena salah input (terutama saat telepon masuk) | Komplain pelanggan, reputasi rusak |
| A4 | Admin sibuk menanggapi chat sementara lapangan tidak selalu terisi penuh | Potensi pendapatan hilang |
| A5 | Tidak ada data penjualan per lapangan / per bulan | Sulit menentukan strategi harga, jam sibuk, atau jadwal perbaikan |

---

## 3. Fitur Utama yang Wajib Ada (MVP)

### Sisi Customer

| # | Fitur | Fungsi Utama |
|---|---|---|
| F1 | Pencarian slot (tanggal → lapangan → jam) | Menampilkan grid slot kosong/terisi yang bisa langsung diklik |
| F2 | Keranjang booking multi-jam | Satu booking bisa mencakup beberapa jam berurutan di lapangan yang sama |
| F3 | Checkout cepat | Cukup nomor HP + nama, verifikasi OTP, tanpa password |
| F4 | Pembayaran QRIS otomatis | QRIS dinamis dari payment gateway, konfirmasi otomatis via webhook |
| F5 | Tiket / bukti booking digital | Kode booking unik + detail lengkap, bisa diakses via tautan tanpa login |
| F6 | Pengingat otomatis (WhatsApp + Email) | Notifikasi H-1 dan H+2 jam sebelum jadwal bermain |

### Sisi Admin

| # | Fitur | Fungsi Utama |
|---|---|---|
| F7 | Dashboard jadwal harian | Semua lapangan ditampilkan dalam satu grid per hari |
| F8 | Booking manual (walk-in / telepon) | Input booking atas nama pelanggan, penandaan "sudah bayar tunai" |
| F9 | Tutup lapangan (maintenance) | Memblokir rentang tanggal/jam agar tidak bisa dipesan pelanggan |
| F10 | Konfirmasi & monitoring pembayaran | Melihat status transaksi, menindak booking yang gagal/basi |
| F11 | Riwayat & laporan | Rekap booking dan pendapatan per lapangan / per periode |

---

## 4. Persona Pengguna

### P1 — Pemain Rekreasi (Budi, 28 th)
- Main padel 1-2x seminggu bersama teman kantor, biasanya malam/weekend.
- **Kebutuhan:** tahu cepat jam kosong, bayar cepat, dapat bukti yang bisa dibagikan ke grup.
- **Kecemasan:** takut slotnya sudah diambil orang lain.
- **Kesuksesan:** booking selesai sambil jalan kaki dari parkiran.

### P2 — Pemain Kompetitif (Sari, 34 th)
- Rutin main & booking reguler, sering sewa 2 jam berturut-turut, kadang cancel.
- **Kebutuhan:** bisa booking slot langganan, riwayat & jadwal pribadi, pengingat jelas.
- **Kecemasan:** lupa jadwal atau tidak sadar sudah masuk jam bermain.
- **Kesuksesan:** pengingat datang otomatis ke WhatsApp, tanpa dicek manual.

### P3 — Admin / Pemilik Lapangan (Pak Rudi, 45 th)
- Mengelola 5-10 lapangan sendiri bersama 1-2 staf lapangan.
- **Kebutuhan:** lihat seluruh jadwal hari ini dalam satu layar, input booking walk-in cepat, tahu lapangan mana yang perlu diperbaiki.
- **Kecemasan:** salah catat & booking ganda saat ramai.
- **Kesuksesan:** tidak perlu lagi buka buku catatan / Excel; semua laporan tersedia otomatis.

---

## 5. Non-Goals (Luar Cakupan MVP)

Agar fokus MVP terjaga, hal-hal berikut **TIDAK** dibangun di versi awal:

- ❌ Registrasi akun penuh dengan password & profil lengkap (cukup nomor HP + OTP).
- ❌ Multi-venue / marketplace lintas klub (MVP: satu venue, 5-10 lapangan).
- ❌ Sistem turnamen, ranking, atau fitur komunitas.
- ❌ Loyalty point, voucher, atau program referral.
- ❌ Aplikasi native (iOS/Android) — MVP berbasis web responsive.
- ❌ Pembayaran selain QRIS (transfer bank manual, kartu kredit, paylater).
- ❌ Streaming CCTV / live court view.
- ❌ Sewa peralatan (raket, bola) sebagai item terpisah.
- ❌ Manajemen pelatih / coach booking.
- ❌ Fitur langganan (membership bulanan) — masuk roadmap v2.0.

---

## 6. Batasan & Asumsi Operasional

| Aspek | Keputusan |
|---|---|
| Jumlah lapangan | 5–10 lapangan dalam satu venue, dapat ditambah/diubah oleh admin |
| Jam operasional | Configurable per hari (admin bisa atur jam buka/tutup per hari) |
| Durasi minimum booking | 1 jam (akan dikonfirmasi saat refinement) |
| Pembayaran | QRIS saja di MVP (via payment gateway pihak ketiga) |
| Autentikasi | Nomor HP + OTP, tanpa password |
| Notifikasi | WhatsApp + Email otomatis |
| Bahasa antarmuka | Bahasa Indonesia |

---

## 7. Indikator Keberhasilan (High-Level)

- ≥ 60% booking bulanan selesai **tanpa** intervensi chat/manual dalam 3 bulan setelah launch.
- Booking ganda turun menjadi 0 sejak adanya sistem slot grid terkunci.
- ≥ 80% pelanggan menerima pengingat WhatsApp sukses terkirim sebelum jadwal bermain.
- Waktu rata-rata pelanggan menyelesaikan booking ≤ 2 menit.

> Detail KPI lengkap ada di [`04-PRD.md`](04-PRD.md) bagian 1.3.

---

*Lanjut ke: [02 — User Journey](02-user-journey.md) · Kembali ke: [README](README.md)*
