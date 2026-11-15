# ADR 0012 — Ganti Password Mandiri (Saat Login)

- **Status:** Accepted
- **Tanggal:** 2026-11-15
- **Pemilik:** Product Owner

## Konteks
[ADR 0009](0009-akun-email-password.md) mengunci akun email + password tanpa OTP, dengan **reset lupa password dilakukan admin** (tanpa reset mandiri) sampai kanal email tersedia (PRD Q7). Namun pemain yang masih login tidak punya cara mengganti password sendiri — mis. password lama bocor atau ingin diganti berkala. Ini berbeda dari **lupa password** (tidak bisa login, butuh verifikasi kepemilikan via email/admin).

Product Owner memutuskan menambah **ganti password mandiri saat pengguna sudah login**.

## Keputusan
- Endpoint `POST /api/auth/change-password` (butuh sesi `padel_session`):
  - Body: `currentPassword`, `newPassword`.
  - Verifikasi `currentPassword` terhadap hash akun; bila salah → `401`.
  - `newPassword` minimal 8 karakter (sama dengan registrasi); boleh sama dengan password lama atau tidak (tidak dipaksakan).
  - Simpan hash **scrypt** baru; **akhiri seluruh sesi lain** milik user (perangkat lain logout), sesi perangkat saat ini tetap aktif.
- Halaman `/akun` (butuh login) menampilkan email/nama dan form ganti password.
- **Reset lupa password tetap lewat admin** ([ADR 0009](0009-akun-email-password.md)); reset mandiri menunggu kanal email (PRD Q7).
- Endpoint admin `POST /api/admin/users/{id}/reset-password` tetap ada dan mengakhiri **semua** sesi user; halaman `/admin/users` disediakan untuk memakainya.

## Alasan
- **Keamanan akun:** pengguna bisa mengganti password yang sudah tidak layak tanpa menunggu admin.
- **Tidak butuh kanal email:** verifikasi memakai password lama, bukan email/OTP.
- **Tidak melanggar ADR 0009:** yang ditunda adalah *pemulihan akun saat lupa password*, bukan pergantian password oleh pemilik sesi aktif.

## Konsekuensi
- **Baik:** kontrol keamanan di tangan pengguna; sesi lain otomatis dicabut saat password diganti.
- **Perlu diwaspadai:** lupa password tetap tidak bisa dipulihkan mandiri (tetap ke admin); tidak ada riwayat password (tidak boleh sama dengan N password lama) di MVP.
- **Permukaan API baru:** satu endpoint pelanggan + satu endpoint daftar user admin (`GET /api/admin/users`) untuk halaman reset.

## Alternatif yang Ditolak
- **Reset mandiri via email/magic link:** butuh kanal email yang ditunda ([ADR 0010](0010-mvp-tanpa-notifikasi.md)).
- **Tanpa verifikasi password lama:** sesi yang dibajak bisa mengganti password korban; ditolak.
- **Tidak mencabut sesi lain:** pembajakan lama tetap hidup setelah password diganti.

## Referensi
- [ADR 0009 — Akun Email + Password](0009-akun-email-password.md)
- [PRD — Q7](../04-PRD.md#6-open-questions-belum-terjawab)
- [Spesifikasi Fitur F3 — Checkout](../03-spesifikasi-fitur.md#f3--checkout-akun-email--password)
