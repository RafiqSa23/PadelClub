# ADR 0010 — MVP Tanpa Notifikasi WhatsApp & Email

- **Status:** Accepted — menggantikan [ADR 0003](0003-notifikasi.md)
- **Tanggal:** 2026-11-12
- **Pemilik:** Product Owner

## Konteks
[ADR 0003](0003-notifikasi.md) menetapkan notifikasi otomatis lewat WhatsApp (utama) dan Email (pendukung) untuk OTP, tiket, konfirmasi, dan pengingat. Implementasinya masih memakai `mockSendNotification` karena penyedia final belum dipilih (PRD Q5).

Product Owner memutuskan (2026-11-12):
- tiket **tidak dikirim** lewat email (ditunda),
- **tidak ada** notifikasi WhatsApp,
- pemain akan punya akun sendiri sehingga status booking bisa dicek langsung di aplikasi.

## Keputusan
**MVP tidak mengirim notifikasi WhatsApp maupun Email sama sekali.**

- Tidak ada pengiriman OTP ([ADR 0009](0009-akun-email-password.md)), tiket, konfirmasi, pengingat, atau pemberitahuan kedaluwarsa lewat kanal eksternal.
- Tiket diakses lewat `/tiket/:kode` (publik, tanpa login) dan `/riwayat` (setelah login).
- **F6 — Pengingat Otomatis dibatalkan dari MVP** dan dipindah ke v2.0. Nomor fitur dipertahankan agar F7–F11 tidak berubah.
- **KPI-3 diganti:** dari "notifikasi WhatsApp terkirim" menjadi "tiket digital dibuka pemain sebelum jadwal" (target ≥ 80%), diukur dari analitik akses `/tiket/:kode` (log akses ditambahkan saat implementasi).
- **AC tautan pembayaran ulang (F4) diganti:** karena slot dilepas setelah 15 menit ([ADR 0006](0006-batas-waktu-pembayaran-qris.md)), tidak ada invoice lama yang bisa dibayar ulang. Halaman kedaluwarsa dan `/riwayat` menampilkan CTA **"Pesan ulang"** ke jadwal yang masih tersedia.
- **Kode & endpoint notifikasi dipensiunkan:** pemanggilan `mockSendNotification` di webhook pembayaran dan cron kedaluwarsa dihapus; `/api/cron/reminders` dan `/api/admin/notifications` dihentikan; tabel `notification_logs` tidak lagi ditulis dan dijadwalkan di-drop saat migrasi implementasi.
- **PRD Q5 ditutup** (ditunda ke v2.0), diganti **Q7** tentang kapan verifikasi email & reset password mandiri dibutuhkan.
- Email tetap dikumpulkan sebagai **identitas login** ([ADR 0009](0009-akun-email-password.md)), bukan kanal notifikasi.

## Alasan
- **Belum ada penyedia** WhatsApp/Email final; memaksa integrasi sekarang menambah biaya & kepatuhan template.
- **Biaya per pesan** tidak sepadan untuk MVP yang belum punya volume.
- **Akun persisten** membuat pelanggan bisa mengecek status sendiri — kanal push tidak lagi satu-satunya cara.
- Menghindari janji produk yang belum bisa dipenuhi (tiket "dikirim" padahal masih mock).

## Konsekuensi
- **Baik:** lingkup lebih kecil, tanpa biaya pesan, tanpa ketergantungan pihak ketiga untuk auth maupun tiket.
- **Perlu diwaspadai:**
  - **No-show naik** karena tidak ada pengingat. Mitigasi: tampilkan jadwal terdekat di `/riwayat` + `/tiket`, dan admin tetap boleh menghubungi pemain manual (di luar sistem).
  - **Kehilangan tiket:** pemain yang tidak menyimpan tautan harus login untuk membuka `/riwayat`.
  - **KPI-3 baru butuh log akses tiket** yang belum ada — harus ditambahkan sebelum KPI bisa diukur.
  - **F6 & kanal notifikasi** menjadi backlog v2.0; `notify-driver.ts` disimpan sebagai kerangka sampai keputusan v2.0.
  - Pengingat pembayaran hampir kedaluwarsa (F10) tidak lagi dikirim ke pemain; hanya tampil sebagai badge di panel admin.

## Alternatif yang Ditolak
- **WhatsApp hanya untuk OTP:** dicabut bersama OTP ([ADR 0009](0009-akun-email-password.md)).
- **Email saja:** butuh penyedia transactional + verifikasi domain sekarang; ditunda.
- **Push notification in-app (web push):** di luar cakupan MVP web dan menambah izin browser.
- **Pengingat internal saja (badge di aplikasi):** tidak menjangkau pemain yang tidak membuka aplikasi; dicatat sebagai kandidat v1.1.

## Referensi
- [PRD — KPI-3](../04-PRD.md#13-success-criteria-kpi) · [PRD — Q5 & Q7](../04-PRD.md#6-open-questions-belum-terjawab)
- [Spesifikasi Fitur F4 — Pembayaran](../03-spesifikasi-fitur.md#f4--pembayaran-otomatis-qris--snap) · [F5 — Tiket](../03-spesifikasi-fitur.md#f5--tiket--bukti-booking-digital) · [F6 — Dibatalkan](../03-spesifikasi-fitur.md#f6--pengingat-otomatis-dibatalkan)
- [ADR 0006 — Batas waktu pembayaran](0006-batas-waktu-pembayaran-qris.md)
