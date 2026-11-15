# 03 — Spesifikasi Fitur

> Format tiap fitur: Tujuan → Alur → Kriteria Terima (AC) → Batasan.
> Semua jam format 24 jam. Harga contoh Rp35.000/jam/lapangan (final ditetapkan admin).

## Isi Dokumen

- [F1 — Pencarian Slot (Tanggal → Lapangan → Jam)](#f1--pencarian-slot)
- [F2 — Keranjang Booking Multi-Jam](#f2--keranjang-booking-multi-jam)
- [F3 — Checkout (Akun Email + Password)](#f3--checkout-akun-email--password)
- [F4 — Pembayaran Otomatis (QRIS / Snap)](#f4--pembayaran-otomatis-qris--snap)
- [F5 — Tiket / Bukti Booking Digital](#f5--tiket--bukti-booking-digital)
- [F6 — Pengingat Otomatis (Dibatalkan)](#f6--pengingat-otomatis-dibatalkan)
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

## F3 — Checkout (Akun Email + Password)

- **Tujuan:** Checkout hanya untuk pemain terdaftar agar booking & riwayat tersimpan di akun.
- **Alur:**
  1. Pelanggan memilih slot → sistem memeriksa sesi. Tanpa sesi → diarahkan ke `/login` (masuk atau daftar).
  2. Daftar: nama, email, password, nomor HP → akun aktif langsung (tanpa verifikasi email/OTP).
  3. Setelah login → kembali ke `/booking` dengan slot pilihan tetap → lanjut pembayaran.
- **Kriteria Terima (AC):**
  - Registrasi menolak email yang sudah terdaftar (409) dan password < 8 karakter (400).
  - Login menolak email/password salah tanpa membocorkan mana yang salah.
  - `/booking` tanpa sesi selalu diarahkan ke `/login`, lalu kembali ke wizard dengan pilihan slot utuh.
  - Nomor HP wajib diisi saat registrasi, tetapi **tidak diverifikasi** (tanpa OTP).
  - Password disimpan sebagai hash scrypt; API tidak pernah mengembalikan password/hash.
  - Rate-limit registrasi & login per IP (tabel `rate_limits`, berlaku lintas-instance).
  - Ganti password mandiri saat login di `/akun`: wajib password lama, password baru minimal 8 karakter, sesi perangkat lain dicabut ([ADR 0012](06-adr/0012-ganti-password-mandiri.md)).
  - Lupa password: tidak ada reset mandiri di MVP; admin dapat mereset dari panel `/admin/users`.
- **Batasan:** Tanpa OTP, tanpa verifikasi email, tanpa reset lupa password mandiri; ganti password hanya saat sudah login ([ADR 0009](06-adr/0009-akun-email-password.md), [ADR 0012](06-adr/0012-ganti-password-mandiri.md)).

---

## F4 — Pembayaran Otomatis (QRIS / Snap)

- **Tujuan:** Konfirmasi pembayaran otomatis tanpa input manual dari admin.
- **Alur:**
  1. Sistem membuat invoice → payment gateway (Midtrans Snap) menghasilkan pembayaran (QRIS atau semua metode yang diaktifkan).
  2. Pelanggan menyelesaikan pembayaran via Snap popup / e-wallet / transfer bank.
  3. Webhook gateway mengirim status seperti `PAID`/`settlement` → booking otomatis `Terkonfirmasi`.
- **Kriteria Terima (AC):**
  - Booking berstatus `Menunggu Pembayaran` sejak invoice dibuat.
  - Pembayaran aktif **15 menit** sejak invoice dibuat (keputusan [ADR 0006](06-adr/0006-batas-waktu-pembayaran-qris.md); batas gateway umumnya 15–30 menit).
  - Halaman booking kedaluwarsa & `/riwayat` menampilkan CTA **"Pesan ulang"** ke jadwal yang masih tersedia (invoice lama tidak dapat dibayar ulang — tidak ada notifikasi tautan, [ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)).
  - Saat `PAID` diterima: status booking berubah `Terkonfirmasi` ≤ 10 detik, tiket otomatis aktif di `/tiket/:kode` dan `/riwayat`.
  - Pesanan tidak dibayar setelah batas waktu → slot kembali `Kosong`; status terlihat di `/riwayat` (tanpa notifikasi eksternal).
- **Batasan:** Driver default `mock` (kredensial Midtrans belum diisi); saat `PAYMENT_DRIVER="midtrans"` + `MIDTRANS_SERVER_KEY` diisi, gunakan Midtrans Snap dengan semua metode pembayaran (kecualian non-goal QRIS-only dicabut, [ADR 0008](06-adr/0008-snap-popup-pengganti-core-api.md)). Webhook signature diverifikasi **SHA-512** (`order_id`, `gross_amount`, `status_code`, server key) dengan handler idempoten — Midtrans, [ADR 0007](06-adr/0007-payment-gateway-midtrans.md).

---

## F5 — Tiket / Bukti Booking Digital

- **Tujuan:** Bukti valid yang bisa dilihat, dibagikan, dan digunakan untuk check-in.
- **Alur:** Saat `Terkonfirmasi`, sistem membuat tiket → dapat dibuka di `/riwayat` atau lewat tautan `/tiket/:kode` (wajib login sebagai pemilik; admin boleh membuka semua tiket). Tidak ada pengiriman WhatsApp/Email.
- **Kriteria Terima (AC):**
  - Tiket memuat: kode unik, nama&HP pemesan, lapangan, tanggal, jam, durasi, total harga, status.
  - Tiket hanya bisa dibuka pemiliknya (sesi `padel_session` cocok `booking.userId`) atau admin bersesi; tanpa login → diarahkan ke `/login`, pemain lain → pesan "bukan pemilik tiket". Tiket selalu tersedia di `/riwayat` akun pemesan.
  - Admin dapat menandai pelanggan "sudah check-in" dari halaman tiket.
  - Tiket berstatus `Batal`/`Tutup` menampilkan pemberitahuan jelas bila dilihat.
  - Tidak ada tiket yang dikirim otomatis ke kanal eksternal (ditunda v2.0, [ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)).
- **Batasan:** Tiket tidak bisa dipindah-tangankan secara langsung (pemindahan hak di luar MVP).

---

## F6 — Pengingat Otomatis (Dibatalkan)

- **Status:** **Dibatalkan dari MVP (2026-11-12)**, pindah ke v2.0 ([ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)). Nomor F dipertahankan agar F7–F11 tidak berubah.
- **Alasan:** tidak ada kanal notifikasi WhatsApp/Email di MVP; pengingat membutuhkan penyedia pihak ketiga yang belum dipilih (PRD Q5).
- **Pengganti sementara:** jadwal terdekat ditampilkan di `/riwayat` dan `/tiket`, tanpa push.
- **Syarat kebangkitan (v2.0):** kanal notifikasi terpasang + template pesan disetujui penyedia; AC lama (H-1 & H+2 jam, retry 3x, log audit) dipakai kembali.

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
  - Pelanggan walk-in dibuat sebagai **user bayangan** (`is_guest`), didedupe berdasarkan nomor HP dalam 7 hari terakhir ([ADR 0011](06-adr/0011-user-bayangan-walkin.md)).
  - User bayangan tanpa booking aktif > 7 hari dianonimisasi otomatis (nama→"Tamu", HP/email kosong); booking tetap tersimpan untuk laporan.
  - Admin dapat mencetak/membagikan tautan tiket secara manual — sistem tidak mengirim WhatsApp/Email.

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
  - Booking `Menunggu Pembayaran` yang hampir kedaluwarsa ditandai badge di panel admin (tanpa notifikasi ke pemain — [ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)).
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