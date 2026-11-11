# ADR 0009 — Akun Pengguna Email + Password (Menggantikan Akun Nomor HP + OTP)

- **Status:** Accepted — menggantikan [ADR 0002](0002-akun-nomor-hp.md)
- **Tanggal:** 2026-11-12
- **Pemilik:** Product Owner

## Konteks
Product Owner memutuskan (2026-11-12) bahwa pemain membuat akun sendiri dan booking lewat website harus tersimpan ke akun tersebut. Keputusan ini membatalkan verifikasi OTP yang menjadi dasar [ADR 0002](0002-akun-nomor-hp.md), sekaligus mencabut non-goal PRD "registrasi penuh dengan password".

Kanal pengiriman OTP juga bergantung pada penyedia notifikasi yang belum dipilih (PRD Q5) — [ADR 0010](0010-mvp-tanpa-notifikasi.md) mencabut seluruh pengiriman WhatsApp/Email dari MVP.

## Keputusan
Akun pemain memakai **email + password**.

- **Registrasi:** email (unik), password (minimal 8 karakter), nama, nomor HP. Tidak ada verifikasi email maupun OTP.
- **Login:** email + password; sesi disimpan di cookie `padel_session` bertanda tangan (HMAC-SHA256) yang membawa `userId`.
- **Checkout web wajib sesi:** `/booking` tanpa sesi diarahkan ke `/login`. Booking yang dibuat lewat website selalu terikat ke akun.
- **Password:** disimpan sebagai hash **scrypt** (pola sama dengan auth admin), tidak pernah dikembalikan API.
- **Reset password:** tidak tersedia mandiri di MVP (butuh pengiriman email). Reset dilakukan admin lewat endpoint khusus.
- **Walk-in:** tidak memakai akun asli — admin membuat **user bayangan** ([ADR 0011](0011-user-bayangan-walkin.md)).
- **Mitigasi penyalahgunaan (tanpa OTP):** rate-limit registrasi & login per IP, maksimum booking aktif per akun, admin dapat memblokir akun, seluruh percobaan login dicatat.

## Alasan
- **Permintaan Product Owner:** pemain punya akun permanen; booking web tersimpan di riwayat akun.
- **Tidak bergantung kanal notifikasi:** auth tidak lagi menunggu penyedia WhatsApp/SMS (Q5).
- **Biaya nol per login:** tidak ada biaya pesan OTP.
- **Histori melekat ke akun**, bukan ke nomor HP yang rawan salah input.

## Konsekuensi
- **Baik:** akun & riwayat persisten; login lintas perangkat; tidak ada biaya OTP; alur auth lebih sederhana untuk diimplementasikan.
- **Perlu diwaspadai:**
  - **Friksi naik:** wajib daftar/masuk sebelum checkout — KPI-4 (≤ 2 menit) berisiko; dipantau di funnel analytics.
  - **Tanpa verifikasi nomor HP:** nomor bisa salah/palsu → risiko booking hantu dan akun ganda. Mitigasi hanya rate-limit, batas booking aktif, dan moderasi admin.
  - **Tanpa verifikasi email:** email adalah identitas login; salah ketik tidak terdeteksi, dan akun tidak bisa dipulihkan sendiri. Reset manual via admin sampai kanal email siap (PRD Q7).
  - **Kebijakan privasi:** email kini data identitas utama — wajib disimpan minimal dan akses terbatas.
- **Kode lama dipensiunkan:** `/api/otp/*`, tabel `otp_codes`, dan langkah OTP di `/login` dihapus; sesi berbasis nomor HP diganti sesi berbasis `userId` (tabel `user_sessions`).

## Alternatif yang Ditolak
- **HP + OTP (ADR 0002):** dicabut Product Owner 2026-11-12.
- **Guest checkout tanpa akun:** bertentangan dengan keputusan "booking web harus tersimpan ke akun".
- **Magic link email:** tetap butuh pengiriman email yang ditunda ([ADR 0010](0010-mvp-tanpa-notifikasi.md)).
- **Registrasi bertahap (HP dulu, password belakangan):** menambah dua model identitas sekaligus; ditunda ke v1.1.

## Referensi
- [PRD — US-04/US-06](../04-PRD.md#22-user-stories) · [PRD — Non-Goals](../04-PRD.md#23-non-goals-mvp) · [PRD — Q7](../04-PRD.md#6-open-questions-belum-terjawab)
- [Spesifikasi Fitur F3 — Checkout](../03-spesifikasi-fitur.md#f3--checkout-akun-email--password)
- [Spesifikasi Fitur F8 — Booking Manual](../03-spesifikasi-fitur.md#f8--booking-manual-walk-in--telepon)
- [ADR 0011 — User Bayangan Walk-in](0011-user-bayangan-walkin.md)
