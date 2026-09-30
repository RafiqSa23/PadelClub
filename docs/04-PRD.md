# 04 — Product Requirements Document (PRD)

**Produk:** Sistem Penyewaan Lapangan Padel (Padel Court Booking)
**Versi:** 1.0 (MVP)
**Tanggal:** 2026-09-22
**Status:** Draft — siap untuk review stakeholder
**Dokumen Terkait:** [Konsep Produk](01-konsep-produk.md) · [User Journey](02-user-journey.md) · [Spesifikasi Fitur](03-spesifikasi-fitur.md) · [Glossary](05-glossary.md) · [ADR](06-adr/0001-qris-pihak-ketiga.md)

---

## 1. Executive Summary

### 1.1 Problem Statement
Pemain padel saat ini harus menanyakan ketersediaan lapangan lewat WhatsApp/telepon dan membayar secara manual, sehingga rawan overbooking, lambat, dan tidak transparan. Sisi pemilik lapangan kehilangan data dan pendapatan karena jadwal masih dikelola secara manual.

### 1.2 Proposed Solution
Aplikasi web booking padel yang menampilkan grid slot real-time, memungkinkan pembayaran QRIS otomatis, dan mengirimkan tiket digital + pengingat otomatis ke WhatsApp & Email — sehingga booking selesai dalam 3 klik & 2 menit tanpa perlu admin merespons chat.

### 1.3 Success Criteria (KPI)

| # | KPI | Target | Cara Ukur |
|---|---|---|---|
| KPI-1 | Booking selesai tanpa intervensi manual (chat/admin) | ≥ 60% dalam 3 bulan setelah launch | Analytics funnel booking |
| KPI-2 | Booking ganda (double booking) | 0 kasus | Laporan kejadian booking |
| KPI-3 | Notifikasi WhatsApp terkirim sebelum jadwal bermain | ≥ 80% sukses terkirim | Log pengiriman notifikasi |
| KPI-4 | Waktu rata-rata menyelesaikan booking | ≤ 2 menit | Analytics waktu checkout |
| KPI-5 | Okupansi lapangan per bulan | ≥ 10% kenaikan (setelah 3 bulan) | Laporan okupansi |

---

## 2. User Experience & Functionality

### 2.1 User Personas
- **P1 — Pemain Rekreasi:** main 1–2x seminggu, butuh kecepatan booking & bukti untuk dibagikan.
- **P2 — Pemain Kompetitif:** booking rutin, butuh riwayat & pengingat jadwal.
- **P3 — Admin / Pemilik Lapangan:** mengelola 5–10 lapangan, butuh grid jadwal & laporan.
> Deskripsi lengkap: [`01-konsep-produk.md`](01-konsep-produk.md#4-persona-pengguna).

### 2.2 User Stories

| ID | Story | Acceptance Criteria (ringkas) |
|---|---|---|
| US-01 | Sebagai pemain, saya ingin melihat jam kosong pada tanggal pilihan agar tidak perlu bertanya ke admin | Grid menampilkan status slot terkini; slot kosong dapat diklik, slot terisi tidak |
| US-02 | Sebagai pemain, saya ingin memesan beberapa jam sekaligus agar sesi bermain saya lebih panjang | Slot berurutan dalam 1 lapangan bisa dipilih; subtotal dihitung otomatis |
| US-03 | Sebagai pemain, saya ingin membayar dengan QRIS agar proses cepat & tidak perlu transfer manual | QRIS ditampilkan setelah checkout; status berubah otomatis ≤ 10 detik setelah bayar |
| US-04 | Sebagai pemain, saya ingin menerima tiket digital setelah bayar sebagai bukti booking | Tiket berisi kode unik + detail lengkap, dikirim WhatsApp & Email, bisa diakses tanpa login |
| US-05 | Sebagai pemain, saya ingin diingatkan jadwal main agar tidak lupa | Notifikasi WhatsApp + Email terkirim H-1 dan H+2 jam sebelum jadwal |
| US-06 | Sebagai pemain, saya cukup menggunakan nomor HP agar tidak perlu membuat password | Login/registrasi cukup nomor HP + OTP (tanpa password) |
| US-07 | Sebagai admin, saya ingin melihat jadwal harian seluruh lapangan dalam satu layar | Grid hari ini tampil semua status; akses detail dengan 1 klik |
| US-08 | Sebagai admin, saya ingin menambah booking manual (walk-in) untuk pelanggan yang datang langsung | Form validasi bentrok; booking langsung `Terkonfirmasi` bila ditandai lunas |
| US-09 | Sebagai admin, saya ingin menutup lapangan untuk perbaikan agar tidak bisa dipesan pelanggan | Slot terblokir & tampil label `Maintenance`; tidak bisa dipilih pelanggan |
| US-10 | Sebagai admin, saya ingin melihat laporan pendapatan & okupansi | Laporan per periode/lapangan; metrik omzet, booking, okupansi |

> Daftar lengkap & detail AC per fitur: [`03-spesifikasi-fitur.md`](03-spesifikasi-fitur.md).

### 2.3 Non-Goals (MVP)
- ❌ Registrasi penuh dengan password & profil lengkap
- ❌ Multi-venue / marketplace lintas klub
- ❌ Turnamen, ranking, atau fitur komunitas
- ❌ Loyalty point, voucher, referral
- ❌ Aplikasi native (iOS/Android) — MVP web responsive
- ❌ Pembayaran selain QRIS
- ❌ Membership langganan (masuk v2.0)

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
              Payment Gateway (QRIS) ──webhook──→ Backend
                              ↓
              Notification Gateway (WhatsApp + Email) → Backend queue → Log
```

### 4.2 Integration Points
- **Payment Gateway:** **Midtrans** — Core API QRIS (charge → QR ditampilkan di halaman), webhook + fallback polling ([ADR 0001](06-adr/0001-qris-pihak-ketiga.md), [ADR 0007](06-adr/0007-payment-gateway-midtrans.md)).
- **Auth OTP:** dikirim via adapter notifikasi — penyedia final menunggu **Q5**; pada fase MVP memakai driver mock ([ADR 0003](06-adr/0003-notifikasi.md)).
- **Notifikasi WhatsApp:** sama — driver adapter; penyedia WhatsApp Business API/gateway = **Q5** (masih terbuka).
- **Email:** driver adapter email transactional; penyedia final = **Q5**; fase MVP memakai driver mock.

### 4.3 Database & Data Model
**Neon PostgreSQL + Drizzle ORM** ([ADR 0005](06-adr/0005-tech-stack-nextjs-drizzle.md)); skema di [`../src/db/schema.ts`](../src/db/schema.ts):

- `users`, `courts`, `court_hours`, `bookings`, `booking_slots`, `payments`, `closures`, `notification_logs`.

> Pemetaan status booking & slot mengikuti matriks di [02 — User Journey §6](02-user-journey.md#6-matriks-status-slot-dipakai-konsisten-di-seluruh-dokumen).

### 4.4 Security & Privacy
- Sesi pelanggan dirancang memakai cookie `padel_session` (HMAC-SHA256, tanpa dependensi eksternal); cookie admin saat ini masih demo dan diganti saat fase backend admin.
- Webhook Midtrans: verifikasi signature **SHA-512** + handler idempoten ([ADR 0007](06-adr/0007-payment-gateway-midtrans.md)).
- Prinsip awal yang WAJIB dipenuhi terlepas dari stack:
  - Data pribadi (nomor HP, email) disimpan minimal & terenkripsi.
  - Webhook payment gateway wajib diverifikasi signature-nya sebelum memproses booking.
  - Rate-limiting pada endpoint OTP & booking.
  - Akses admin dilindungi autentikasi khusus (di luar OTP pelanggan).

---

## 5. Risks & Roadmap

### 5.1 Phased Rollout

| Fase | Cakupan |
|---|---|
| **MVP (v1.0)** | Booking grid + checkout nomor HP + pembayaran QRIS otomatis + tiket digital + notifikasi WA/Email + dashboard admin + booking manual + tutup lapangan + laporan dasar |
| **v1.1** | Riwayat & profil pelanggan lebih kaya, perbaikan UX, ekspor laporan, optimasi seluler |
| **v2.0** | Membership/langganan, multi-venue, fitur komunitas/turnamen, program loyalitas |

### 5.2 Technical Risks

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Webhook pembayaran telat / gagal | Slot terkunci padahal belum terbayar; pembeli frustrasi | Polling fallback + timer otomatis release slot; retry eksponensial |
| Ketergantungan pihak ketiga (payment/WhatsApp) | Notifikasi & pembayaran bisa terhambat | Fallback channel (email/SMS), circuit breaker, log audit |
| Overbooking saat concurrent booking | Komplain pelanggan | Optimistic locking / kunci slot transaksional |
| Pengiriman notifikasi kena blokir / spam report | Reminder tidak diterima | WhatsApp Business API resmi, template yang disetujui |
| Privasi nomor HP & email | Kepatuhan regulasi data | Enkripsi at-rest, akses terbatas, kebijakan retensi data |

---

## 6. Open Questions (Belum Terjawab)

> **Terjawab:** **Q1** — payment gateway final ditetapkan **Midtrans** (Core API QRIS) pada 2026-09-28, lihat [ADR 0007](06-adr/0007-payment-gateway-midtrans.md). **Q2 & Q3** — batas waktu pembayaran QRIS sekaligus pelepasan slot `Menunggu Pembayaran` ditetapkan **15 menit** oleh Product Owner pada 2026-09-28, lihat [ADR 0006](06-adr/0006-batas-waktu-pembayaran-qris.md). Baris tetap tercantum untuk riwayat.

| # | Pertanyaan | Pemilik Keputusan |
|---|---|---|
| Q1 | Payment gateway final: Midtrans / Xendit / Duitku? → **Terjawab: Midtrans** | Stakeholder + Tech Lead |
| Q2 | Batas waktu pembayaran QRIS untuk memblokir slot? (mis. 15/30 menit) → **Terjawab: 15 menit** | Product Owner |
| Q3 | Batas waktu `Menunggu Pembayaran` sebelum slot otomatis kosong kembali? → **Terjawab: 15 menit** | Product Owner |
| Q4 | Jam operasional tiap hari & variasi harga akhir? | Admin Pemilik |
| Q5 | Penyedia WhatsApp Business API & anggaran biaya per pesan? | Stakeholder |
| Q6 | Apakah booking boleh multi-lapangan dalam 1 transaksi? | Product Owner |

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