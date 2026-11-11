# ADR 0011 — User Bayangan untuk Booking Walk-in + Anonimisasi 7 Hari

- **Status:** Accepted
- **Tanggal:** 2026-11-12
- **Pemilik:** Product Owner

## Konteks
Sejak akun pemain wajib untuk booking web ([ADR 0009](0009-akun-email-password.md)), booking walk-in/telepon yang diinput admin tidak punya akun asli. Booking tetap membutuhkan baris `users` karena `bookings.user_id` adalah foreign key dan laporan F11 menghitung omzet per booking.

Product Owner memutuskan pelanggan walk-in diperlakukan sebagai **user bayangan** yang dihapus beberapa hari kemudian, sementara pelanggan yang booking lewat website tersimpan permanen.

## Keputusan
- **Setiap booking wajib memiliki `user_id`**, termasuk walk-in.
- **User bayangan (`is_guest = true`)** dibuat admin saat input booking manual: nama + nomor HP, tanpa email dan tanpa password.
- **Dedupe:** nomor HP dinormalisasi (`08…` → `628…`) lalu dicocokkan dengan guest user dalam **7 hari terakhir**; bila ada, dipakai ulang. Tanpa OTP, pencocokan hanya berdasarkan nomor.
- **Anonimisasi otomatis setelah 7 hari:** cron harian memproses guest yang tidak punya booking aktif dan booking terakhirnya lebih dari 7 hari lalu:
  - `name` → `"Tamu"`, `phone` → `NULL`, `email` → `NULL`, `anonymized_at` → waktu proses.
  - Baris `users` dan seluruh `bookings` **tetap ada** agar laporan F11 dan rekap omzet utuh.
- **User non-guest tidak pernah dianonimisasi.**
- Tiket walk-in tetap dapat dibuka lewat kode; setelah anonimisasi tiket menampilkan "Tamu" tanpa kontak.
- Endpoint cron: `GET /api/cron/anonymize` (secret cron yang sama dengan cron lain); butuh scheduler eksternal seperti [ADR 0006](0006-batas-waktu-pembayaran-qris.md) cron kedaluwarsa.

## Alasan
- **Laporan tetap benar:** hapus keras user akan memutus/ikut menghapus booking historis dan menghilangkan omzet walk-in dari laporan.
- **Minimalisasi data pribadi:** kontak walk-in tidak disimpan lebih lama dari yang diperlukan.
- **Tanpa akun palsu:** walk-in tidak memaksa admin membuat email fiktif.

## Konsekuensi
- **Baik:** laporan historis utuh; walk-in tetap cepat diinput; data pribadi walk-in dibatasi 7 hari.
- **Perlu diwaspadai:**
  - **Kontak walk-in hilang setelah 7 hari** — komplain/klaim jangka panjang tidak bisa ditelusuri.
  - **Salah orang mungkin terjadi:** dedupe berdasarkan nomor tanpa verifikasi bisa menggabungkan dua pelanggan berbeda dengan nomor sama (mis. nomor resepsionis).
  - **Anonimisasi ireversibel**; kesalahan konfigurasi retensi tidak bisa dibatalkan.
  - Booking walk-in tidak muncul di `/riwayat` pemain (tidak ada akun untuk login).
- **Perubahan skema:** `users.email` & `users.password_hash` menjadi nullable, tambah `users.is_guest`, `users.anonymized_at`; migrasi baru saat implementasi.

## Alternatif yang Ditolak
- **Hapus user keras + booking ikut terhapus:** merusak laporan dan audit pembayaran.
- **Simpan walk-in selamanya:** data pribadi berlebih tanpa dasar kebutuhan.
- **Guest tanpa baris `users`:** melanggar asumsi `bookings.user_id` dan memecah model data.
- **Guest user per booking (tanpa dedupe):** sampah data dan sulit menelusuri riwayat kunjungan.

## Referensi
- [PRD — US-08](../04-PRD.md#22-user-stories) · [PRD — §4.3 Data Model](../04-PRD.md#43-database--data-model)
- [Spesifikasi Fitur F8 — Booking Manual](../03-spesifikasi-fitur.md#f8--booking-manual-walk-in--telepon)
- [Glossary — User Bayangan](../05-glossary.md)
- [ADR 0009 — Akun Email + Password](0009-akun-email-password.md)
