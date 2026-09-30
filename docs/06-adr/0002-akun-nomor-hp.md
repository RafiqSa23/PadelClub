# ADR 0002 — Akun Pengguna Cukup Nomor HP (OTP, Tanpa Password)

- **Status:** Accepted
- **Tanggal:** 2026-09-22
- **Pemilik:** Product Owner

## Konteks
Friction utama pelanggan adalah harus mendaftar sebelum bisa booking. Pendaftaran dengan email + password membuat pelanggan meninggalkan proses checkout. Alternatifnya:

1. Registrasi penuh (email + password + verifikasi).
2. **Login/registrasi hanya dengan nomor HP dan kode OTP** (opsional nama + email saat checkout).
3. Guest tanpa identitas sama sekali.

MVP memilih pendekatan yang paling cepat namun tetap memungkinkan pelanggan mengakses riwayat booking.

## Keputusan
Akun pengguna **dibuat otomatis dari nomor HP** yang diverifikasi dengan **OTP**, tanpa password.

- Alur: input nama + nomor HP → sistem mengirim OTP → input OTP → akun terverifikasi.
- Pengiriman OTP utama via WhatsApp (fallback SMS — lihat [ADR 0003](0003-notifikasi.md)).
- Nomor HP yang sudah pernah dipakai dianggap "login" (akun dibuat saat pertama kali).

## Alasan
- **Kecepatan checkout:** prinsip produk "3 klik & 2 menit".
- **Tanpa beban menghafal password:** mengurangi lupa-password yang memutus funnel.
- **Rendah barrier:** cukup nomor yang sudah dimiliki semua orang.
- **Email opsional:** tetap dikumpulkan (untuk notifikasi + OTP fallback) namun tidak wajib.
- **Non-goals terjaga:** registrasi penuh ditunda ke v1.1.

## Konsekuensi
- **Baik:** onboarding ringan; riwayat tetap melekat ke nomor HP yang sama.
- **Perlu diwaspadai:**
  - Wajib rate-limiting & anti-spam pada endpoint OTP.
  - OTP hanya sekali pakai & kedaluwarsa setelah 5 menit.
  - Nomor HP adalah data pribadi — wajib disimpan terenkripsi & akses terbatas.
  - Risiko salah-input nomor → dikelola dengan konfirmasi terakhir sebelum booking dibuat.

## Alternatif yang Ditolak
- Registrasi penuh dengan password — friction tinggi, di luar MVP.

## Referensi
- [PRD — US-06](../04-PRD.md#22-user-stories)
- [Spesifikasi Fitur F3 — Checkout](../03-spesifikasi-fitur.md#f3--checkout-cepat-nomor-hp--otp)