# 04 — Product Requirements Document (PRD)

**Produk:** Sistem Penyewaan Lapangan Padel (Padel Court Booking)
**Versi:** 1.1 (MVP) — revisi scope 2026-11-12
**Tanggal:** 2026-09-22 (rev. 2026-11-12)
**Status:** Draft — scope auth & notifikasi direvisi Product Owner
**Dokumen Terkait:** [Konsep Produk](01-konsep-produk.md) · [User Journey](02-user-journey.md) · [Spesifikasi Fitur](03-spesifikasi-fitur.md) · [Glossary](05-glossary.md) · [ADR](06-adr/0001-qris-pihak-ketiga.md)

---

## 1. Executive Summary

### 1.1 Problem Statement
Pemain padel saat ini harus menanyakan ketersediaan lapangan lewat WhatsApp/telepon dan membayar secara manual, sehingga rawan overbooking, lambat, dan tidak transparan. Sisi pemilik lapangan kehilangan data dan pendapatan karena jadwal masih dikelola secara manual.

### 1.2 Proposed Solution
Aplikasi web booking padel yang menampilkan grid slot real-time, memungkinkan pembayaran otomatis (Midtrans Snap), dan menyimpan tiket digital di akun pemain — tanpa perlu admin merespons chat. Notifikasi WhatsApp/Email dan pengingat otomatis ditunda ke v2.0 ([ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)).

### 1.3 Success Criteria (KPI)

| # | KPI | Target | Cara Ukur |
|---|---|---|---|
| KPI-1 | Booking selesai tanpa intervensi manual (chat/admin) | ≥ 60% dalam 3 bulan setelah launch | Analytics funnel booking |
| KPI-2 | Booking ganda (double booking) | 0 kasus | Laporan kejadian booking |
| KPI-3 | Tiket digital dibuka pemain sebelum jadwal bermain | ≥ 80% tiket diakses sebelum jam main | Analitik akses `/tiket/:kode` (log akses ditambahkan saat implementasi) |
| KPI-4 | Waktu rata-rata menyelesaikan booking | ≤ 2 menit | Analytics waktu checkout |
| KPI-5 | Okupansi lapangan per bulan | ≥ 10% kenaikan (setelah 3 bulan) | Laporan okupansi |

---

## 2. User Experience & Functionality

### 2.1 User Personas
- **P1 — Pemain Rekreasi:** main 1–2x seminggu, butuh kecepatan booking & bukti untuk dibagikan.
- **P2 — Pemain Kompetitif:** booking rutin, butuh riwayat & jadwal pribadi di akun.
- **P3 — Admin / Pemilik Lapangan:** mengelola 5–10 lapangan, butuh grid jadwal & laporan.
> Deskripsi lengkap: [`01-konsep-produk.md`](01-konsep-produk.md#4-persona-pengguna).

### 2.2 User Stories

| ID | Story | Acceptance Criteria (ringkas) |
|---|---|---|
| US-01 | Sebagai pemain, saya ingin melihat jam kosong pada tanggal pilihan agar tidak perlu bertanya ke admin | Grid menampilkan status slot terkini; slot kosong dapat diklik, slot terisi tidak |
| US-02 | Sebagai pemain, saya ingin memesan beberapa jam sekaligus agar sesi bermain saya lebih panjang | Slot berurutan dalam 1 lapangan bisa dipilih; subtotal dihitung otomatis |
| US-03 | Sebagai pemain, saya ingin membayar dengan QRIS agar proses cepat & tidak perlu transfer manual | QRIS ditampilkan setelah checkout; status berubah otomatis ≤ 10 detik setelah bayar |
| US-04 | Sebagai pemain, saya ingin mendapatkan tiket digital setelah bayar sebagai bukti booking | Tiket berisi kode unik + detail lengkap, tersimpan di `/riwayat` akun, hanya bisa dibuka pemilik setelah login (admin boleh membuka semua tiket) |
| ~~US-05~~ | ~~Sebagai pemain, saya ingin diingatkan jadwal main agar tidak lupa~~ → **dibatalkan 2026-11-12**, pindah v2.0 ([ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)) | — |
| US-06 | Sebagai pemain, saya ingin membuat akun agar booking & riwayat saya tersimpan | Registrasi email + password; wajib login sebelum checkout; tanpa OTP |
| US-07 | Sebagai admin, saya ingin melihat jadwal harian seluruh lapangan dalam satu layar | Grid hari ini tampil semua status; akses detail dengan 1 klik |
| US-08 | Sebagai admin, saya ingin menambah booking manual (walk-in) untuk pelanggan yang datang langsung | Form validasi bentrok; booking langsung `Terkonfirmasi` bila ditandai lunas; pelanggan dicatat sebagai user bayangan yang dianonimisasi setelah 7 hari |
| US-09 | Sebagai admin, saya ingin menutup lapangan untuk perbaikan agar tidak bisa dipesan pelanggan | Slot terblokir & tampil label `Maintenance`; tidak bisa dipilih pelanggan |
| US-10 | Sebagai admin, saya ingin melihat laporan pendapatan & okupansi | Laporan per periode/lapangan; metrik omzet, booking, okupansi |

> Daftar lengkap & detail AC per fitur: [`03-spesifikasi-fitur.md`](03-spesifikasi-fitur.md).

### 2.3 Non-Goals (MVP)
- ~~❌ Registrasi penuh dengan password & profil lengkap~~ — **dicabut 2026-11-12**: akun email + password menjadi syarat booking web ([ADR 0009](06-adr/0009-akun-email-password.md))
- ❌ Multi-venue / marketplace lintas klub
- ❌ Turnamen, ranking, atau fitur komunitas
- ❌ Loyalty point, voucher, referral
- ❌ Aplikasi native (iOS/Android) — MVP web responsive
- ~~❌ Pembayaran selain QRIS~~ — **dicabut 2026-10-01**: pembayaran via Midtrans Snap membuka semua metode (pengecualian disetujui Product Owner, [ADR 0008](06-adr/0008-snap-popup-pengganti-core-api.md))
- ❌ Membership langganan (masuk v2.0)
- ❌ Notifikasi WhatsApp/Email & pengingat otomatis (masuk v2.0, [ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md))
- ❌ Verifikasi email, OTP, dan **reset lupa password** mandiri (reset manual via admin sampai PRD Q7 terjawab; *ganti* password saat sudah login tetap tersedia, [ADR 0012](06-adr/0012-ganti-password-mandiri.md))

---

## 3. AI System Requirements
**Tidak berlaku untuk MVP.** Produk ini tidak menggunakan AI pada versi awal.
> Jika nanti ditambahkan (mis. rekomendasi jam sibuk), kebutuhan AI akan didokumentasikan di sini pada versi PRD berikutnya.

---

## 4. Technical Specifications

> Bagian teknis ini mulai diisi pada sesi engineering (mulai 2026-09-28) berdasarkan keputusan yang terkunci di [`06-adr/`](06-adr/). Rincian implementasi & status terbaru mengikuti ADR dan [`../PROGRESS.md`](../PROGRESS.md).

### 4.1 Architecture Overview
**Stack:** Next.js 16 (App Router, TypeScript) + Tailwind CSS untuk frontend & API routes, Drizzle ORM + Neon PostgreSQL untuk database ([ADR 0005](06-adr/0005-tech-stack-nextjs-drizzle.md)).

Arah alur data:
```
Web App (Customer / Admin) → API Backend → Database
                              ↓
              Payment Gateway (Midtrans Snap) ──webhook──→ Backend
```
> Kanal notifikasi (WhatsApp/Email) tidak ada di MVP — [ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md).

### 4.2 Integration Points
- **Payment Gateway:** **Midtrans** — **Snap popup** (`snap.pay` di halaman `/booking`, semua metode pembayaran; sebelumnya Core API QRIS — digantikan [ADR 0008](06-adr/0008-snap-popup-pengganti-core-api.md)). Webhook + fallback polling ([ADR 0001](06-adr/0001-qris-pihak-ketiga.md), [ADR 0007](06-adr/0007-payment-gateway-midtrans.md) — digantikan ADR 0008).
- **Auth pemain:** akun email + password, sesi cookie `padel_session` berbasis `userId`; tanpa OTP dan tanpa verifikasi email ([ADR 0009](06-adr/0009-akun-email-password.md)).
- **Notifikasi WhatsApp/Email:** **tidak dipakai di MVP**; penyedia ditunda ke v2.0 ([ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md), PRD Q5).

### 4.3 Database & Data Model
**Neon PostgreSQL + Drizzle ORM** ([ADR 0005](06-adr/0005-tech-stack-nextjs-drizzle.md)); skema di [`../src/db/schema.ts`](../src/db/schema.ts):

- `users`, `user_sessions`, `courts`, `court_hours`, `bookings`, `booking_slots`, `payments`, `closures`, `rate_limits`.
- **User bayangan:** booking walk-in memakai baris `users` dengan `is_guest = true`; setelah 7 hari tanpa booking aktif, nama & kontak dianonimisasi (`anonymized_at`) tetapi baris user dan booking tetap ada untuk laporan ([ADR 0011](06-adr/0011-user-bayangan-walkin.md)).
- **Rate-limit persisten:** tabel `rate_limits` (`key`, `count`, `windowStart`) menopang batas endpoint sensitif lintas-instance; endpoint jadwal yang di-polling tetap in-memory ([ADR 0013](06-adr/0013-rate-limit-cron-produksi.md)).
- `notification_logs` dipensiunkan ([ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)) dan dijadwalkan di-drop saat migrasi implementasi.

> Pemetaan status booking & slot mengikuti matriks di [02 — User Journey §6](02-user-journey.md#6-matriks-status-slot-dipakai-konsisten-di-seluruh-dokumen).

### 4.4 Security & Privacy
- Sesi pelanggan memakai cookie `padel_session` berisi token acak (hash SHA-256 disimpan di `user_sessions`); password disimpan sebagai hash **scrypt** ([ADR 0009](06-adr/0009-akun-email-password.md), [ADR 0012](06-adr/0012-ganti-password-mandiri.md)).
- Webhook Midtrans: verifikasi signature **SHA-512** + handler idempoten ([ADR 0007](06-adr/0007-payment-gateway-midtrans.md)).
- Prinsip awal yang WAJIB dipenuhi terlepas dari stack:
  - Data pribadi (nomor HP, email) disimpan minimal & terenkripsi.
  - Webhook payment gateway wajib diverifikasi signature-nya sebelum memproses booking.
  - Rate-limiting pada endpoint registrasi/login & booking — endpoint sensitif memakai tabel `rate_limits` (lintas-instance), endpoint jadwal in-memory ([ADR 0013](06-adr/0013-rate-limit-cron-produksi.md)).
  - Tiket hanya bisa dibuka pemilik (sesi cocok `booking.userId`) atau admin bersesi; kode unik saja tidak cukup.
  - Akses admin dilindungi autentikasi khusus (di luar akun pelanggan).
  - Retensi data user bayangan walk-in: **7 hari**, lalu dianonimisasi ([ADR 0011](06-adr/0011-user-bayangan-walkin.md)).

---

## 5. Risks & Roadmap

### 5.1 Phased Rollout

| Fase | Cakupan |
|---|---|
| **MVP (v1.0)** | Booking grid + akun email/password + pembayaran otomatis + tiket digital di akun + dashboard admin + booking manual (user bayangan) + tutup lapangan + laporan dasar |
| **v1.1** | Riwayat & profil pelanggan lebih kaya, reset password mandiri, perbaikan UX, ekspor laporan, optimasi seluler |
| **v2.0** | Notifikasi WhatsApp/Email + pengingat otomatis (F6), membership/langganan, multi-venue, fitur komunitas/turnamen, program loyalitas |

### 5.2 Technical Risks

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Webhook pembayaran telat / gagal | Slot terkunci padahal belum terbayar; pembeli frustrasi | Polling fallback + timer otomatis release slot; retry eksponensial |
| Ketergantungan payment gateway | Pembayaran terhambat | Driver adapter + fallback polling + log audit |
| Overbooking saat concurrent booking | Komplain pelanggan | Optimistic locking / kunci slot transaksional |
| Tanpa verifikasi nomor HP | Booking hantu & akun ganda (nomor palsu/salah) | Rate-limit registrasi & booking, batas booking aktif per akun, moderasi admin |
| Wajib login sebelum checkout | Drop-off naik; KPI-4 (≤ 2 menit) berisiko gagal | Form daftar ringkas, sesi panjang, ukur funnel per langkah |
| Tanpa pengingat otomatis | No-show meningkat | Jadwal terdekat di `/riwayat` & `/tiket`; admin tetap bisa menghubungi manual |
| Lupa password tanpa reset mandiri | Akun tidak bisa diakses | Reset oleh admin; jadwalkan reset mandiri (PRD Q7) |
| Privasi nomor HP & email | Kepatuhan regulasi data | Enkripsi at-rest, akses terbatas, anonimisasi user bayangan 7 hari |

---

## 6. Open Questions (Belum Terjawab)

> **Terjawab:** **Q1** — payment gateway final ditetapkan **Midtrans** (Core API QRIS) pada 2026-09-28, lihat [ADR 0007](06-adr/0007-payment-gateway-midtrans.md). **Q2 & Q3** — batas waktu pembayaran QRIS sekaligus pelepasan slot `Menunggu Pembayaran` ditetapkan **15 menit** oleh Product Owner pada 2026-09-28, lihat [ADR 0006](06-adr/0006-batas-waktu-pembayaran-qris.md). Baris tetap tercantum untuk riwayat.

> **Revisi 2026-11-12:** scope auth menjadi **akun email + password tanpa OTP** ([ADR 0009](06-adr/0009-akun-email-password.md)); notifikasi WhatsApp/Email & pengingat otomatis **dibatalkan dari MVP** ([ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)); booking walk-in memakai **user bayangan** dengan anonimisasi 7 hari ([ADR 0011](06-adr/0011-user-bayangan-walkin.md)).

| # | Pertanyaan | Pemilik Keputusan |
|---|---|---|
| Q1 | Payment gateway final: Midtrans / Xendit / Duitku? → **Terjawab: Midtrans** | Stakeholder + Tech Lead |
| Q2 | Batas waktu pembayaran QRIS untuk memblokir slot? (mis. 15/30 menit) → **Terjawab: 15 menit** | Product Owner |
| Q3 | Batas waktu `Menunggu Pembayaran` sebelum slot otomatis kosong kembali? → **Terjawab: 15 menit** | Product Owner |
| Q4 | Jam operasional tiap hari & variasi harga akhir? | Admin Pemilik |
| Q5 | Penyedia WhatsApp Business API & anggaran biaya per pesan? → **Ditunda ke v2.0** ([ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)) | Stakeholder |
| Q6 | Apakah booking boleh multi-lapangan dalam 1 transaksi? | Product Owner |
| Q7 | Kapan verifikasi email & **reset lupa password** mandiri dibutuhkan? (MVP: reset manual via admin; ganti password saat login sudah ada — [ADR 0012](06-adr/0012-ganti-password-mandiri.md)) | Product Owner |
| Q8 | Ambang rate-limit registrasi/login & batas booking aktif per akun? → **Terjawab sebagian:** 5 registrasi/IP/jam, 10 login/IP/menit, 3 booking aktif; implementasi tabel `rate_limits` ([ADR 0013](06-adr/0013-rate-limit-cron-produksi.md)) | Tech Lead |

---

## 7. Referensi Dokumen

| Dokumen | Ringkas |
|---|---|
| [01 — Konsep Produk](01-konsep-produk.md) | Masalah, persona, fitur utama, non-goals |
| [02 — User Journey](02-user-journey.md) | Alur Customer & Admin, sitemap, matriks status |
| [03 — Spesifikasi Fitur](03-spesifikasi-fitur.md) | Detail per fitur + AC terukur |
| [05 — Glossary](05-glossary.md) | Istilah domain |
| [06 — ADR](06-adr/0001-qris-pihak-ketiga.md) | Keputusan arsitektur produk |

---

*Dokumen ini adalah source of truth. Setiap perubahan scope wajib memperbarui changelog di [`README.md`](README.md).*