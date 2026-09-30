# 02 — User Journey & Struktur Halaman (Sitemap)

## 1. Prinsip UX yang Dipegang

- **"3 klik & 2 menit"** — booking selesai dalam 3 klik utama dan waktu maksimal 2 menit.
- **Tanpa login wajib di awal** — login (nomor HP + OTP) hanya diperlukan saat checkout.
- **Transparansi harga** — harga per jam dan biaya tambahan tampil sejak halaman pencarian.
- **Feedback setiap aksi** — klik slot langsung memberi respons visual (perubahan warna grid).
- **Satu sumber kebenaran** — status slot selalu sama untuk customer & admin (data real-time).

---

## 2. Alur Pemain (Customer) — 8 Langkah

### Diagram Alur
```
Landing Page → Pilih Tanggal → Pilih Lapangan & Jam → Review Order
        → Masukkan Nomor HP (OTP) → Bayar QRIS → Tiket Digital → Pengingat Otomatis
```

### Detail Langkah

| # | Tahap | Tindakan Pengguna | Sistem Melakukan | Keluaran UX |
|---|---|---|---|---|
| 1 | Landing Page | Klik tombol besar **"Booking Sekarang"** | Menampilkan CTA utama tanpa hambatan | Langsung masuk ke pemilihan tanggal |
| 2 | Pilih Tanggal | Klik tanggal di kalender | Kalender menandai tanggal libur/tutup, menampilkan harga/hari | Tanggal terpilih ter-highlight |
| 3 | Pilih Lapangan & Jam | Klik 1–beberapa slot jam di grid lapangan | Grid menampilkan warna status slot; menghitung subtotal saat slot dipilih | Slot terpilih berubah warna, subtotal tampil live |
| 4 | Review Order | Verifikasi ringkasan booking → klik **"Lanjut ke Pembayaran"** | Menampilkan detail lengkap (lapangan, tanggal, jam, durasi, harga, biaya) | Ringkasan yang jelas dan tidak ambigu |
| 5 | Nomor HP + OTP | Input nomor HP & nama, verifikasi kode OTP | Mengirim OTP via WhatsApp (fallback SMS), memvalidasi kode | Akun terverifikasi cepat tanpa password |
| 6 | Bayar QRIS | Pindai/menampilkan QRIS, konfirmasi pembayaran | Payment gateway memvalidasi pembayaran; webhook memperbarui status booking | Status otomatis menjadi **Terkonfirmasi** |
| 7 | Tiket Digital | Lihat tiket, unduh/bagikan | Menampilkan kode booking + detail lengkap + tautan akses tanpa login | Bukti valid yang bisa dibagikan ke grup |
| 8 | Pengingat Otomatis | (tidak perlu tindakan) | Mengirim WhatsApp + Email H-1 dan H+2 jam sebelum jadwal | Pelanggan tidak lupa jadwal bermain |

### Skenario Gagal yang Perlu Ditangani
- **Slot keduluan orang lain saat pelanggan masih checkout** → sistem menampilkan pesan "slot telah terisi", menyimpan pilihan lain yang masih kosong.
- **OTP tidak terkirim / tidak sampai** → tombol "kirim ulang" dengan hitung mundur 60 detik.
- **Pembayaran QRIS gagal / kedaluwarsa** → status "Menunggu Pembayaran" dengan batas waktu + opsi membatalkan order.
- **Booking menunggu bayar tidak dibayar** → sistem mengosongkan kembali slot setelah **15 menit** ([ADR 0006](06-adr/0006-batas-waktu-pembayaran-qris.md)).

---

## 3. Alur Pengelola (Admin) — Tiga Skenario

### 3.1 Melihat Jadwal Harian
1. Login Admin → **Dashboard**.
2. Pilih tanggal (default: hari ini).
3. Seluruh lapangan tampil dalam satu grid:
   - 🟢 **Kosong** (putih/hijau) — bisa dipesan.
   - 🔵 **Terkonfirmasi** — sudah dibayar.
   - 🟡 **Menunggu Pembayaran** — booking belum lunas.
   - 🔴 **Tutup / Maintenance** — sengaja diblokir.
4. Klik salah satu slot → detail booking (nama, HP, jam, metode pembayaran).

### 3.2 Input Booking Manual (Walk-in / Telepon)
1. Dashboard → klik tombol **"+ Booking Manual"**.
2. Isi form: nama, nomor HP, lapangan, tanggal, jam, durasi.
3. Pilih metode pembayaran: **Tunai / Sudah Bayar** (booking langsung **Terkonfirmasi**) ATAU **Belum Bayar (Utang/Menunggu)**.
4. Sistem membuat booking + tiket; admin dapat mencetak/mengirim bukti lewat WhatsApp.

### 3.3 Menutup Lapangan (Maintenance / Perbaikan)
1. Jadwal → pilih lapangan, tanggal, dan rentang jam (atau seluruh hari).
2. Isi alasan singkat (contoh: "Perbaikan net", "Pengecatan ulang").
3. Simpan → slot langsung diblokir; status **Maintenance** tidak bisa dipesan pelanggan maupun admin.

---

## 4. Sitemap — Sisi Customer (5 Halaman Inti)

```
/                        Landing Page
│                        (hero, daftar lapangan singkat, harga, CTA booking, testimoni, kontak)
│
├── /booking             Wizard Booking (multi-step dalam 1 halaman)
│                        Tanggal → Lapangan & Jam → Review → Checkout
│
├── /login               Login / Registrasi ringan
│                        (Nomor HP + Nama → OTP → tanpa password)
│
├── /tiket/:kode         Tiket / Bukti Booking
│                        (bisa dibuka tanpa login via kode unik)
│
└── /riwayat             Riwayat Booking Pemain
                        (hanya setelah login/OTP)
```

**Catatan UX:**
- `/booking` dibuat **satu halaman multi-step** (bukan berpindah URL) untuk meminimalkan langkah & menghindari pengguna tersesat.
- `/tiket/:kode` bisa diakses tanpa login agar tiket bisa dibagikan ke rekan pemain & admin dapat melihatnya saat check-in.
- `/riwayat` menampilkan booking aktif (belum berlalu) paling atas, lalu yang sudah selesai/dibatalkan.

---

## 5. Sitemap — Sisi Admin (6 Halaman Inti)

```
/admin                halaman Login Admin
├── /admin/dashboard      Ringkasan: booking hari ini, slot terisi, omzet, lapangan tersibuk
├── /admin/jadwal         Grid jadwal harian/mingguan semua lapangan (core screen)
├── /admin/booking        Daftar semua booking + aksi (konfirmasi bayar, batalkan)
├── /admin/booking/baru   Form booking manual (walk-in / telepon)
├── /admin/lapangan       Kelola lapangan, harga, jam operasional + tutup untuk perbaikan
└── /admin/laporan        Rekap pendapatan & okupansi per lapangan/periode
```

**Catatan UX:**
- `/admin/jadwal` adalah layar kerja utama — selalu diakses 1 klik dari dashboard.
- Semua tindakan (konfirmasi bayar, blokir slot) berbentuk tombol langsung tanpa berpindah halaman (inline action).
- Statistik dashboard disegarkan real-time sesuai data booking.

> **Di luar sitemap MVP:** aplikasi juga memuat 3 halaman demo tambahan hasil pengembangan desain — `/admin/papan-jadwal` (papan jadwal publik mode TV/lobi), `/admin/monitoring` (monitoring web publik + banner siaran), dan `/admin/scanner` (pemindaian tiket di gate). Ketiganya tidak termasuk cakupan PRD dan statusnya dipantau di [`../PROGRESS.md`](../PROGRESS.md).

---

## 6. Matriks Status Slot (Dipakai Konsisten di Seluruh Dokumen)

| Status | Warna | Arti | Bisa Dipesan? |
|---|---|---|---|
| Kosong | Putih / hijau muda | Slot tersedia | ✅ Ya |
| Terkonfirmasi | Biru | Sudah dibayar & sah | ❌ Tidak |
| Menunggu Pembayaran | Kuning | Booking dibuat, belum lunas | ❌ Tidak (sementara) |
| Tutup / Maintenance | Abu / label silang | Diblokir sengaja | ❌ Tidak |

> Definisi lengkap tiap istilah: [`05-glossary.md`](05-glossary.md).

---

*Lanjut ke: [03 — Spesifikasi Fitur](03-spesifikasi-fitur.md) · Kembali ke: [01 — Konsep Produk](01-konsep-produk.md)*