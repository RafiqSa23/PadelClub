# 07 — Dokumentasi Backend API

> Referensi teknis untuk seluruh endpoint backend (`src/app/api/`).
> Spesifikasi mesin-terbaca: [`07-api-backend.openapi.yaml`](07-api-backend.openapi.yaml) (impor ke Postman / Swagger UI).
> Versi dokumen mengikuti batch backend, format `1.0-batchN`. **Versi saat ini: `1.0-batch7`.**
> Source of truth implementasi tetap kode di `src/app/api/` + skema `src/db/schema.ts`.

## Isi Dokumen

- [1. Pendahuluan](#1-pendahuluan)
- [2. Autentikasi](#2-autentikasi)
- [3. Konvensi Respons & Error](#3-konvensi-respons--error)
- [4. Rate Limit](#4-rate-limit)
- [5. Endpoint Publik](#5-endpoint-publik)
- [5a. Endpoint Pelanggan — OTP](#5a-endpoint-pelanggan--otp)
- [5b. Endpoint Pelanggan — Booking](#5b-endpoint-pelanggan--booking)
- [5c. Endpoint Pembayaran — QRIS & Expiry](#5c-endpoint-pembayaran--qris--expiry)
- [5d. Endpoint Tiket & Check-in](#5d-endpoint-tiket--check-in)
- [6. Endpoint Admin — Auth](#6-endpoint-admin--auth)
- [7. Endpoint Admin — Jadwal & Penutupan](#7-endpoint-admin--jadwal--penutupan)
- [7b. Endpoint Admin — Monitoring](#7b-endpoint-admin--monitoring)
- [7c. Endpoint Admin — Notifikasi & Cron Pengingat](#7c-endpoint-admin--notifikasi--cron-pengingat)
- [8. Endpoint Admin — Lapangan & Booking Manual](#8-endpoint-admin--lapangan--booking-manual)
- [8b. Endpoint Admin — Laporan](#8b-endpoint-admin--laporan)
- [9. Rencana Batch Berikutnya](#9-rencana-batch-berikutnya)
- [10. Model Data Ringkas](#10-model-data-ringkas)
- [Changelog Dokumen](#changelog-dokumen)

---

## 1. Pendahuluan

- **Base URL:** same-origin, semua path di bawah `/api` (mis. `GET /api/slots?date=2026-10-05`).
- **Format:** JSON. Request body memakai `Content-Type: application/json`.
- **Versioning:** tidak ada prefix versi di URL selama MVP. Perubahan kompatibel-mundur (tambah field/endpoint) menaikkan versi dokumen (`1.0-batch2`, …). Perubahan merusak (rename/hapus field) diumumkan di [Changelog Dokumen](#changelog-dokumen) dan dicatat di [`README.md`](README.md).
- **Contoh `curl`:** dijalankan terhadap `http://localhost:3100` (dev server, `npm run dev -- -p 3100`). Contoh respons di dokumen ini **hasil panggilan asli**, bukan karangan.
- **Kaitan fitur:** setiap endpoint mencantumkan kode fitur F1–F11 dari [`03-spesifikasi-fitur.md`](03-spesifikasi-fitur.md).

---

## 2. Autentikasi

| Sesi | Cookie | Cara dapat | Masa berlaku | Dipakai oleh |
|---|---|---|---|---|
| Admin | `padelclub_admin` (HttpOnly, `SameSite=Lax`) | `POST /api/admin/login` | 12 jam (tabel `admin_sessions`) | Seluruh `POST/PATCH/DELETE /api/admin/*` dan `GET /api/admin/schedule`, `/api/admin/me` |
| Customer | `padel_session` (HMAC-SHA256, tanpa dep eksternal) | `POST /api/otp/verify` | 30 hari | `POST /api/bookings`, `GET /api/me/bookings` |
| Cron internal | Header `x-cron-secret` / `Authorization: Bearer` / query `?secret=` via env `CRON_SECRET` | — | — | `GET /api/cron/expire` (✅ Batch 4), `GET /api/cron/reminders` (✅ Batch 6) |

Catatan:

- Guard antarmuka `/admin/*` di `src/proxy.ts` hanya memeriksa **keberadaan** cookie (redirect bila kosong). Otorisasi sesungguhnya ditegakkan di tiap route handler via `getCurrentAdmin()` — token di-hash SHA-256 lalu dicocokkan ke `admin_sessions` yang belum kedaluwarsa.
- `GET /api/admin/closures` (list) dan seluruh endpoint publik **tidak** memerlukan auth.
- Password admin di-hash `scrypt` (`src/lib/admin-auth.ts`). Akun awal dari seed: `admin / admin123` (ganti setelah login pertama).

---

## 3. Konvensi Respons & Error

Sukses:

```json
{ "ok": true, "courts": [ ... ] }
```

Gagal:

```json
{ "ok": false, "message": "Parameter date wajib format YYYY-MM-DD" }
```

| Kode | Arti | Kapan muncul |
|---|---|---|
| 200 | OK | GET/DELETE/PATCH berhasil |
| 201 | Created | POST berhasil membuat data |
| 400 | Validasi gagal | Format tanggal salah, rentang jam invalid, body kurang |
| 401 | Unauthorized | Tanpa cookie sesi / sesi kedaluwarsa (endpoint admin tulis + `/schedule`, `/me`) |
| 404 | Tidak ditemukan | ID closure/court/booking tidak ada |
| 409 | Konflik | Slot sudah dipesan pihak lain (⏳ Batch 2, via unique constraint) |
| 429 | Rate limit | Terlalu banyak percobaan login/OTP |

---

## 4. Rate Limit

| Endpoint | Batas | Jendela |
|---|---|---|
| `POST /api/admin/login` | 10 percobaan / IP | 60 detik |
| `POST /api/otp/*` | Kirim-ulang min 60 dtk (409/429 bila terlalu cepat), maks 5x gagal per kode, 20 req/mnt/IP (request), 30 verifikasi/mnt/IP | — |
| `POST /api/bookings` | 10/mnt per user | 60 detik |

Implementasi: `src/lib/rate-limit.ts` (in-memory per instance) + batas berbasis DB untuk OTP.

---

## 5. Endpoint Publik

### 5.1 `GET /api/health` — cek server & DB

```bash
curl http://localhost:3100/api/health
```

```json
{ "ok": true, "db": "connected" }
```

| Error | Kode | Contoh `message` |
|---|---|---|
| DB putus | 500 | `{ "ok": false, "db": "error", "message": "..." }` |

### 5.2 `GET /api/courts` — daftar lapangan aktif (F1)

Mengembalikan lapangan aktif beserta **jam operasional hari ini** (fallback `07:00–23:00` bila tak ada baris `court_hours`).

```bash
curl http://localhost:3100/api/courts
```

```json
{
  "ok": true,
  "courts": [
    {
      "id": 1,
      "name": "Lapangan 1",
      "hourlyPrice": 35000,
      "isActive": true,
      "isIndoor": false,
      "description": "Outdoor, pasir sintetis",
      "openHour": 7,
      "closeHour": 23
    }
  ]
}
```

### 5.3 `GET /api/slots?date=YYYY-MM-DD` — ketersediaan 1 tanggal (F1)

Menggabungkan `court_hours` + `booking_slots⨝bookings` (status `dibatalkan` dan `menunggu_pembayaran` yang kedaluwarsa dianggap kosong) + `closures`. Lapangan non-aktif tidak dimasukkan ke `slots`.

```bash
curl "http://localhost:3100/api/slots?date=2026-10-05"
```

```json
{
  "ok": true,
  "schedule": {
    "date": "2026-10-05",
    "dayOfWeek": 1,
    "courts": [ { "id": 1, "name": "Lapangan 1", "...": "..." } ],
    "slots": [
      { "courtId": 1, "hour": 7, "status": "kosong" },
      { "courtId": 1, "hour": 8, "status": "kosong" }
    ]
  }
}
```

Status slot: `kosong` | `menunggu_pembayaran` | `terkonfirmasi` | `tutup`. Slot terisi menyertakan `code` (kode booking); slot tutup menyertakan `reason`.

| Error | Kode | Contoh `message` |
|---|---|---|
| Format tanggal salah | 400 | `Parameter date wajib format YYYY-MM-DD` |

---

## 5a. Endpoint Pelanggan — OTP

> F3 — Checkout cepat (nomor HP + OTP). Driver mock: kode dicetak ke log server dan (khusus non-produksi) dikembalikan sebagai `debugCode` agar alur dapat diuji end-to-end. Saat penyedia WA final (PRD Q5) tiba, hanya driver yang diganti — kontrak endpoint tetap.

### 5a.1 `POST /api/otp/request` — minta kode OTP

```bash
curl -X POST http://localhost:3100/api/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"phone":"081234567890","name":"Raka Pratama"}'
```

```json
{ "ok": true, "sentTo": "6281234567890", "expiresInSeconds": 300 }
```

Aturan: OTP berlaku 5 menit, 1x pakai; kirim-ulang min 60 detik; nomor dinormalisasi ke format `62…`.

| Error | Kode | Contoh `message` |
|---|---|---|
| Nomor invalid | 400 | `Nomor HP tidak valid (gunakan format 08…)` |
| Kirim-ulang terlalu cepat | 429 | `Tunggu 59 detik sebelum meminta kode baru` |
| Terlalu sering (IP) | 429 | `Terlalu banyak permintaan, coba lagi sebentar` |

### 5a.2 `POST /api/otp/verify` — verifikasi + buat akun otomatis

Cocok → OTP ditandai terpakai, akun dibuat bila nomor baru (`users`), cookie `padel_session` diset.

```bash
curl -X POST http://localhost:3100/api/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"phone":"081234567890","code":"914285","name":"Raka Pratama"}' -c cust.txt
```

```json
{ "ok": true, "user": { "id": 1, "name": "Raka Pratama", "phone": "6281234567890" } }
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Kode salah | 401 | `Kode OTP salah.` |
| Kedaluwarsa/tidak ada | 401 | `Kode kedaluwarsa atau tidak ditemukan. Minta kode baru.` |
| 5x gagal | 429 | `Terlalu banyak percobaan gagal. Minta kode baru.` |
| Format kode | 400 | `Kode OTP harus 6 digit` |

---

## 5b. Endpoint Pelanggan — Booking

### 5b.1 `POST /api/bookings` — buat booking, tahan slot (F2)

Perlu sesi `padel_session`. Jam wajib berurutan dalam satu lapangan; subtotal = jam × harga. Hasil awal selalu `menunggu_pembayaran` (+15 menit, ADR 0006) + baris `payments` (`pending`, `orderId: ORD-<kode>`). Bentrok (termasuk race) → `409`.

```bash
curl -X POST http://localhost:3100/api/bookings \
  -H 'Content-Type: application/json' -b cust.txt \
  -d '{"courtId":2,"date":"2026-10-06","hours":[18,19]}'
```

```json
{
  "ok": true,
  "booking": {
    "code": "PD-VKB6WV",
    "courtId": 2,
    "courtName": "Lapangan 2",
    "date": "2026-10-06",
    "hours": [18, 19],
    "status": "menunggu_pembayaran",
    "subtotal": 70000,
    "expiresAt": "2026-09-29T18:09:50.197Z"
  },
  "payment": {
    "orderId": "ORD-PD-VKB6WV",
    "amount": 70000,
    "status": "pending",
    "expiresAt": "2026-09-29T18:09:50.197Z"
  }
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Login dengan OTP terlebih dahulu` |
| Body kurang | 400 | `courtId, date (YYYY-MM-DD), dan hours[] wajib diisi` |
| Tanggal lewat | 400 | `Tanggal sudah lewat` |
| Tidak berurutan | 409 | `Hanya jam berurutan dalam satu lapangan yang dibolehkan.` |
| Slot dipesan | 409 | `Slot sudah dipesan pihak lain. Pilih jam lain.` |
| Kena closure | 409 | `Sebagian jam bersinggungan dengan jadwal tutup/maintenance.` |
| Di luar jam | 409 | `Jam di luar operasional lapangan.` |

### 5b.2 `GET /api/bookings/:code` — detail via kode (publik)

Dipakai layar konfirmasi + tiket (Batch 5).

```bash
curl http://localhost:3100/api/bookings/PD-VKB6WV
```

```json
{
  "ok": true,
  "booking": {
    "code": "PD-VKB6WV",
    "courtId": 2,
    "courtName": "Lapangan 2",
    "hourlyPrice": 35000,
    "date": "2026-10-06",
    "hours": [18, 19],
    "status": "menunggu_pembayaran",
    "source": "online",
    "subtotal": 70000,
    "expiresAt": "2026-09-29T18:09:50.197Z",
    "customerName": "Raka Uji",
    "customerPhone": "6281234567890",
    "paymentStatus": "pending"
  }
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tidak ada | 404 | `Booking tidak ditemukan` |

### 5b.3 `GET /api/me/bookings` — riwayat milik sesi

Perlu sesi `padel_session`. Dipakai `/riwayat`.

```bash
curl http://localhost:3100/api/me/bookings -b cust.txt
```

```json
{
  "ok": true,
  "bookings": [
    {
      "code": "PD-VKB6WV",
      "courtId": 2,
      "courtName": "Lapangan 2",
      "date": "2026-10-06",
      "status": "menunggu_pembayaran",
      "source": "online",
      "subtotal": 70000,
      "createdAt": "2026-09-29T17:54:51.173Z",
      "hours": [18, 19]
    }
  ]
}
```

---

## 5c. Endpoint Pembayaran — QRIS & Expiry

> F4 — Pembayaran QRIS otomatis. Driver `mock` (tanpa kredensial): QR berupa payload teks `MOCK-QRIS:ORD-<kode>:<amount>` — visual di halaman masih dekoratif sampai driver Midtrans (ADR 0007) tiba. Expiry 15 menit server-side (ADR 0006); sumber kebenaran expiry tetap `bookings.expiresAt`.

### 5c.1 `POST /api/payments/:code/charge` — charge QRIS (idempoten)

Charge ulang selama belum kedaluwarsa mengembalikan payload yang sama. Tanpa auth (kode booking bersifat rahasia per transaksi); rate-limit 10/mnt per kode.

```bash
curl -X POST http://localhost:3100/api/payments/PD-YTZE3G/charge
```

```json
{
  "ok": true,
  "payment": {
    "orderId": "ORD-PD-YTZE3G",
    "amount": 70000,
    "status": "pending",
    "qrString": "MOCK-QRIS:ORD-PD-YTZE3G:70000",
    "expiresAt": "2026-09-30T12:11:23.920Z"
  },
  "booking": {
    "code": "PD-YTZE3G",
    "status": "menunggu_pembayaran",
    "expiresAt": "2026-09-30T12:11:23.920Z"
  }
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tidak ada | 404 | `Booking tidak ditemukan` |
| Sudah terbayar | 409 | `Booking sudah terbayar` |
| Batal/kedaluwarsa | 409 | `Booking sudah dibatalkan atau kedaluwarsa` |
| Lewat 15 menit | 409 | `Batas waktu pembayaran 15 menit habis. Slot akan dibuka kembali.` |
| Terlalu sering | 429 | `Terlalu banyak percobaan, coba lagi sebentar` |

### 5c.2 `GET /api/payments/:code/status` — polling fallback

Dipakai UI tiap 5 detik selama menunggu pembayaran (webhook-first, polling sebagai fallback bila webhook tidak sampai).

```bash
curl http://localhost:3100/api/payments/PD-YTZE3G/status
```

```json
{
  "ok": true,
  "booking": { "code": "PD-YTZE3G", "status": "terkonfirmasi", "expiresAt": null },
  "payment": {
    "orderId": "ORD-PD-YTZE3G",
    "amount": 70000,
    "status": "paid",
    "qrString": "MOCK-QRIS:ORD-PD-YTZE3G:70000",
    "expiresAt": "2026-09-30T12:11:23.920Z",
    "paidAt": "2026-09-30T12:12:01.000Z"
  }
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tidak ada | 404 | `Booking tidak ditemukan` |

### 5c.3 `POST /api/webhooks/payment` — webhook gateway (idempoten)

`status: PAID` (atau `settlement`/`capture` Midtrans) → booking otomatis `terkonfirmasi` + log notifikasi `tiket`; `expire`/`cancel`/`deny` → `dibatalkan` + payment `expired`. Panggilan ganda aman (`already: true`). Verifikasi signature via `PaymentDriver.verifyWebhook` (mock: cek `orderId`; Midtrans: SHA-512).

```bash
curl -X POST http://localhost:3100/api/webhooks/payment \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"ORD-PD-YTZE3G","status":"PAID","amount":70000}'
```

```json
{ "ok": true, "booking": { "code": "PD-YTZE3G", "status": "terkonfirmasi" } }
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Body kurang | 400 | `orderId dan status wajib diisi` |
| Status asing | 400 | `Status webhook tidak dikenali` |
| Signature invalid | 401 | `Signature webhook tidak valid` |
| Order asing | 404 | `Order tidak ditemukan` |
| Sudah tidak menunggu | 409 | `Booking sudah tidak menunggu pembayaran` |

### 5c.4 `GET /api/cron/expire` — kedaluwarsakan booking > 15 mnt

Perlu `CRON_SECRET` (header `x-cron-secret`, `Authorization: Bearer`, atau query `?secret=`). Dijadwalkan tiap menit via cron eksternal (Vercel Cron / cron-job.org). Tiap booking kedaluwarsa: `menunggu_pembayaran → dibatalkan`, payment `pending → expired`, log `kadaluarsa` — slot kembali `kosong` otomatis.

```bash
curl -H 'x-cron-secret: dev-cron-secret-lokal' http://localhost:3100/api/cron/expire
```

```json
{ "ok": true, "expiredCount": 1, "codes": ["PD-CS624E"] }
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa/salah secret | 401 | `Unauthorized` |

---

## 5d. Endpoint Tiket & Check-in

> F5 — Tiket/bukti booking digital. Tiket dibuka tanpa login bermodal kode unik; check-in hanya oleh admin bersesi (halaman publik tidak boleh men-toggle sendiri).

### 5d.1 `GET /api/tickets/:kode` — tiket publik

Memuat seluruh field tiket (AC F5: kode, nama & HP, lapangan, tanggal, jam, durasi implisit dari `hours`, total, status) + `paymentStatus`/`paidAt` + `checkedInAt`/`checkedInBy` + `closureNotice` (pemberitahuan bila jadwal ketiban penutupan/Tutup; Batal ditandai via `status: dibatalkan`).

```bash
curl http://localhost:3100/api/tickets/PD-YTZE3G
```

```json
{
  "ok": true,
  "ticket": {
    "code": "PD-YTZE3G",
    "courtId": 2,
    "courtName": "Lapangan 2",
    "description": "Outdoor, pasir sintetis",
    "isIndoor": false,
    "date": "2026-10-03",
    "hours": [18, 19],
    "status": "terkonfirmasi",
    "source": "online",
    "subtotal": 70000,
    "expiresAt": null,
    "customerName": "Raka Uji2",
    "customerPhone": "6281234567891",
    "paymentStatus": "paid",
    "paidAt": "2026-09-30T12:12:01.000Z",
    "checkedInAt": null,
    "checkedInBy": null,
    "closureNotice": null
  }
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tidak ada | 404 | `Tiket tidak ditemukan` |

### 5d.2 `POST /api/admin/checkin` — check-in oleh admin

Hanya booking `terkonfirmasi`; idempoten (check-in ganda → `already: true`). **Perlu sesi admin.** Rate-limit 30/mnt per admin.

```bash
curl -X POST http://localhost:3100/api/admin/checkin \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"code":"PD-YTZE3G"}'
```

```json
{
  "ok": true,
  "ticket": {
    "code": "PD-YTZE3G",
    "checkedInAt": "2026-09-30T12:20:00.000Z",
    "checkedInBy": "admin"
  }
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Unauthorized` |
| Body kurang | 400 | `code wajib diisi` |
| Tidak ada | 404 | `Booking tidak ditemukan` |
| Belum lunas/batal | 409 | `Hanya booking terkonfirmasi yang bisa check-in` |

---

## 6. Endpoint Admin — Auth

### 6.1 `POST /api/admin/login` — masuk panel

```bash
curl -X POST http://localhost:3100/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' -c cookies.txt
```

```json
{ "ok": true, "admin": { "id": 1, "username": "admin" } }
```

Respons menyertakan header `Set-Cookie: padelclub_admin=<token>; Path=/; HttpOnly; SameSite=Lax` (gunakan `-c`/`-b` pada `curl` lanjutan).

| Error | Kode | Contoh `message` |
|---|---|---|
| Body kurang | 400 | `Username dan password wajib diisi` |
| Kredensial salah | 401 | `Username atau password salah` |
| Terlalu sering | 429 | `Terlalu banyak percobaan, coba lagi sebentar` |

### 6.2 `POST /api/admin/logout` — keluar panel

Menghapus baris sesi di DB + mengosongkan cookie.

```bash
curl -X POST http://localhost:3100/api/admin/logout -b cookies.txt
```

```json
{ "ok": true, "loggedOut": true }
```

### 6.3 `GET /api/admin/me` — profil sesi berjalan

```bash
curl http://localhost:3100/api/admin/me -b cookies.txt
```

```json
{ "ok": true, "admin": { "id": 1, "username": "admin" } }
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa/kedaluwarsa sesi | 401 | `Unauthorized` |

---

## 7. Endpoint Admin — Jadwal & Penutupan

### 7.1 `GET /api/admin/schedule?date=YYYY-MM-DD` — grid + detail booking (F7 read-model)

Sama dengan `GET /api/slots` ditambah `bookings` (jam dikelompokkan per booking, nama/HP dari tamu atau user) untuk modal detail tanpa pindah halaman. **Perlu sesi admin.**

```bash
curl "http://localhost:3100/api/admin/schedule?date=2026-10-05" -b cookies.txt
```

```json
{
  "ok": true,
  "schedule": { "date": "2026-10-05", "dayOfWeek": 1, "courts": [], "slots": [] },
  "bookings": []
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Unauthorized` |
| Format tanggal salah | 400 | `Parameter date wajib format YYYY-MM-DD` |

### 7.2 `GET /api/admin/closures` — daftar penutupan

- Dengan `?date=YYYY-MM-DD`: closure tanggal tersebut (publik, tanpa auth).
- Tanpa param: 100 closure hari ini ke depan (untuk halaman `/admin/lapangan`).

```bash
curl "http://localhost:3100/api/admin/closures?date=2026-10-05"
```

```json
{ "ok": true, "closures": [] }
```

### 7.3 `POST /api/admin/closures` — tutup lapangan (F9)

Menutup seluruh hari (`startHour`/`endHour` null) atau rentang jam. Booking yang sudah ada **tidak** dibatalkan otomatis (AC F9). **Perlu sesi admin.** Slot tertutup otomatis berstatus `tutup` di `/api/slots`.

```bash
curl -X POST http://localhost:3100/api/admin/closures \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"courtId":1,"date":"2026-10-05","startHour":10,"endHour":12,"reason":"Perbaikan net"}'
```

```json
{
  "ok": true,
  "closure": {
    "id": 1,
    "courtId": 1,
    "closureDate": "2026-10-05",
    "startHour": 10,
    "endHour": 12,
    "reason": "Perbaikan net"
  }
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Unauthorized` |
| Body kurang/tanggal salah | 400 | `courtId (number) dan date (YYYY-MM-DD) wajib diisi` |
| Rentang invalid | 400 | `Rentang jam tidak valid (0–24, startHour < endHour)` |

### 7.4 `DELETE /api/admin/closures/:id` — hapus penutupan (F9)

```bash
curl -X DELETE http://localhost:3100/api/admin/closures/1 -b cookies.txt
```

```json
{ "ok": true, "deleted": { "id": 1 } }
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Unauthorized` |
| ID bukan angka | 400 | `ID closure tidak valid` |
| Tidak ada | 404 | `Closure tidak ditemukan` |

---

## 7b. Endpoint Admin — Monitoring

### 7b.1 `GET /api/admin/bookings` — daftar + filter + cari (F10)

Query: `status=semua|menunggu_pembayaran|terkonfirmasi|dibatalkan`, `search=` (nama/HP/kode/lapangan), `date=YYYY-MM-DD`, `expiring=1` (hanya menunggu yang kedaluwarsa ≤ 5 menit lagi — pengingat F10), `limit` (max 200), `offset`. **Perlu sesi admin.**

```bash
curl "http://localhost:3100/api/admin/bookings?status=menunggu_pembayaran" -b cookies.txt
```

```json
{
  "ok": true,
  "bookings": [
    {
      "code": "PD-9GAREK",
      "courtId": 1,
      "courtName": "Lapangan 1",
      "date": "2026-10-07",
      "status": "menunggu_pembayaran",
      "source": "walkin",
      "subtotal": 35000,
      "expiresAt": "2026-09-29T18:36:13.722Z",
      "customerName": "Uji Monitor",
      "customerPhone": "6281900011122",
      "paymentStatus": "pending",
      "hours": [10]
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Unauthorized` |
| Status invalid | 400 | `Status tidak valid` |

### 7b.2 `PATCH /api/admin/bookings/:code` — konfirmasi / batalkan (F10)

Remediasi: `confirm` (menunggu → terkonfirmasi, payment pending → paid) atau `cancel` (aktif → dibatalkan, payment pending → expired). Slot terbebas otomatis karena ketersediaan dihitung dari status.

```bash
curl -X PATCH http://localhost:3100/api/admin/bookings/PD-9GAREK \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"action":"confirm"}'
```

```json
{ "ok": true, "booking": { "code": "PD-9GAREK", "status": "terkonfirmasi" } }
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Unauthorized` |
| Aksi invalid | 400 | `action wajib "confirm" atau "cancel"` |
| Tidak ada | 404 | `Booking tidak ditemukan` |
| Sudah confirm/batal | 409 | `Hanya booking menunggu pembayaran yang bisa dikonfirmasi` |

### 7b.3 `GET /api/admin/overview?date=` — ringkasan harian (F7)

KPI omzet (sum terkonfirmasi), okupansi, hitungan status, daftar hampir-kedaluwarsa, closure hari itu. Dipakai `/admin/dashboard`.

```bash
curl "http://localhost:3100/api/admin/overview?date=2026-10-08" -b cookies.txt
```

```json
{
  "ok": true,
  "date": "2026-10-08",
  "kpi": {
    "omzet": 0,
    "occupancy": 2,
    "totalSlots": 86,
    "occupiedSlots": 2,
    "freeSlots": 84,
    "totalBookings": 1,
    "confirmed": 0,
    "waiting": 1,
    "cancelled": 0,
    "expiringCount": 0
  },
  "expiring": [],
  "closures": []
}
```

---

## 7c. Endpoint Admin — Notifikasi & Cron Pengingat

> F6 — Pengingat otomatis (WhatsApp + Email). Driver mock (log + console); WhatsApp wajib, Email bila pelanggan mengisinya. Jadwal cron tiap **5 menit**; tiap target (H-1 = 24 jam, H-2jam = 2 jam sebelum mulai) dikirim maksimal sekali per booking (cek log `terkirim`), upaya ulang 3x bila gagal, log tersimpan untuk audit.

### 7c.1 `GET /api/cron/reminders` — kirim pengingat jatuh tempo

Perlu `CRON_SECRET` (seperti `/api/cron/expire`). Isi pesan: tanggal, jam, lapangan, nama, kode booking.

```bash
curl -H 'x-cron-secret: dev-cron-secret-lokal' http://localhost:3100/api/cron/reminders
```

```json
{
  "ok": true,
  "checked": 3,
  "skipped": 2,
  "sent": [{ "code": "PD-YTZE3G", "type": "pengingat_h2", "channel": "whatsapp" }],
  "failed": []
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa/salah secret | 401 | `Unauthorized` |

### 7c.2 `GET /api/admin/notifications` — baca log notifikasi (audit)

Query: `type=tiket|pengingat_h1|pengingat_h2|sisa_pembayaran|kadaluarsa`, `channel=whatsapp|email`, `status=terkirim|gagal`, `limit` (max 100), `offset`. **Perlu sesi admin.** Dipakai `/admin/monitoring`.

```bash
curl "http://localhost:3100/api/admin/notifications?limit=5" -b cookies.txt
```

```json
{
  "ok": true,
  "logs": [
    {
      "id": 3,
      "bookingId": 7,
      "code": "PD-YTZE3G",
      "channel": "whatsapp",
      "type": "pengingat_h2",
      "status": "terkirim",
      "sentAt": "2026-09-30T12:30:00.000Z",
      "error": null
    }
  ],
  "total": 3,
  "limit": 5,
  "offset": 0
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Unauthorized` |
| Filter invalid | 400 | `type tidak valid` |

---

## 8. Endpoint Admin — Lapangan & Booking Manual

### 8.1 `POST /api/admin/courts` — tambah lapangan (ADR 0004)

Membuat lapangan + jam default `08:00–22:00` × 7 hari. **Perlu sesi admin.**

```bash
curl -X POST http://localhost:3100/api/admin/courts \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"name":"Lapangan 7","hourlyPrice":35000,"isIndoor":true}'
```

```json
{
  "ok": true,
  "court": { "id": 7, "name": "Lapangan 7", "hourlyPrice": 35000, "...": "..." }
}
```

### 8.2 `PATCH /api/admin/courts/:id` — ubah harga/status/jam

Jam operasional (`openHour`/`closeHour`) disamakan untuk 7 hari (MVP). **Perlu sesi admin.**

```bash
curl -X PATCH http://localhost:3100/api/admin/courts/5 \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"hourlyPrice":32000}'
```

```json
{ "ok": true, "court": { "id": 5, "name": "Lapangan 5", "hourlyPrice": 32000 } }
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Unauthorized` |
| Harga invalid | 400 | `hourlyPrice harus bilangan positif` |
| Jam invalid | 400 | `Jam operasional tidak valid (0–24, open < close)` |
| Tidak ada | 404 | `Lapangan tidak ditemukan` |

### 8.3 `POST /api/admin/bookings` — booking manual walk-in/telepon (F8)

`paid=true` (tunai) langsung `terkonfirmasi`; `paid=false` menjadi `menunggu_pembayaran` (+15 mnt). Nomor HP ditautkan ke user bila sudah terdaftar, atau dibuatkan akun dasar. Validasi bentrok sama dengan booking online (409). **Perlu sesi admin.**

```bash
curl -X POST http://localhost:3100/api/admin/bookings \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"courtId":3,"date":"2026-10-06","hours":[9,10],"name":"Walkin Sari","phone":"082100011122","paid":true}'
```

```json
{
  "ok": true,
  "booking": {
    "code": "PD-5E9A4T",
    "courtId": 3,
    "date": "2026-10-06",
    "hours": [9, 10],
    "status": "terkonfirmasi",
    "subtotal": 80000,
    "expiresAt": null
  },
  "payment": { "orderId": "ORD-PD-5E9A4T", "amount": 80000, "status": "paid" }
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Unauthorized` |
| Body kurang | 400 | `courtId, date, hours[], dan name wajib diisi` |
| HP invalid | 400 | `Nomor HP tidak valid (gunakan format 08…)` |
| Slot bentrok | 409 | `Slot sudah dipesan pihak lain. Pilih jam lain.` |

---

## 8b. Endpoint Admin — Laporan

> F11 — Riwayat & laporan. Metrik AC: omzet (sum `terkonfirmasi`), total booking, dibatalkan, okupansi per lapangan. Periode hari/bulan/kustom via `from`/`to` (maks 366 hari); ekspor **CSV** server-side (`?format=csv`, dengan BOM agar rapi di Excel); PDF di luar MVP. **Perlu sesi admin.**

### 8b.1 `GET /api/admin/reports?from&to&courtId` — rekap JSON

Okupansi = slot terisi (`terkonfirmasi`) vs kapasitas (jam operasional × hari). Dipakai `/admin/laporan`.

```bash
curl "http://localhost:3100/api/admin/reports?from=2026-09-01&to=2026-09-30" -b cookies.txt
```

```json
{
  "ok": true,
  "from": "2026-09-01",
  "to": "2026-09-30",
  "summary": {
    "omzet": 110000,
    "totalBookings": 2,
    "cancelled": 1,
    "waiting": 0,
    "avgOccupancy": 0
  },
  "courts": [
    {
      "courtId": 2,
      "name": "Lapangan 2",
      "isIndoor": false,
      "bookingCount": 1,
      "revenue": 70000,
      "occupiedSlots": 2,
      "totalSlots": 480,
      "occupancyPct": 0
    }
  ]
}
```

### 8b.2 `GET /api/admin/reports?…&format=csv` — unduh CSV

Kolom sama seperti ekspor mock lama (`Lapangan, Periode, Booking terkonfirmasi, Omzet, Okupansi, Mulai, Sampai`) agar kontinuitas. Respons `Content-Disposition: attachment`.

```bash
curl "http://localhost:3100/api/admin/reports?from=2026-09-01&to=2026-09-30&format=csv" -b cookies.txt
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Unauthorized` |
| Format tanggal salah | 400 | `from/to wajib format YYYY-MM-DD` |
| Rentang invalid | 400 | `Rentang tanggal tidak valid (to < from)` |
| Format invalid | 400 | `format wajib "json" atau "csv"` |

---

## 9. Rencana Batch Berikutnya

> Seluruh batch 1–7 selesai. Bagian ini menjadi riwayat pengerjaan (beserta path di `07-api-backend.openapi.yaml`). Struktur section tidak berubah.

### 9.1 ✅ Batch 2 — Booking + OTP + Walk-in (F2, F3, F8) → versi `1.0-batch2` (selesai 2026-09-30)

Terdokumentasi penuh di §5a, §5b, dan §8.3 + OpenAPI: `POST /api/otp/request|verify`, `POST /api/bookings`, `GET /api/bookings/:code`, `GET /api/me/bookings`, `POST /api/admin/bookings`.

### 9.2 ✅ Batch 3 — Admin monitoring (F7 penuh, F10) → versi `1.0-batch3` (selesai 2026-09-30)

Terdokumentasi penuh di §7b + OpenAPI: `GET /api/admin/bookings` (filter/cari/expiring), `PATCH /api/admin/bookings/:code` (confirm/cancel), `GET /api/admin/overview` (KPI harian).

### 9.3 ✅ Batch 4 — Pembayaran mock + expiry (F4) → versi `1.0-batch4` (selesai 2026-09-30)

Terdokumentasi penuh di §5c + OpenAPI: `POST /api/payments/:code/charge` (idempoten), `GET /api/payments/:code/status` (polling fallback), `POST /api/webhooks/payment` (PAID → `terkonfirmasi` + tiket, idempoten), `GET /api/cron/expire` (perlu `CRON_SECRET`). Wiring `/booking`: QR payload mock + countdown expiry server + simulasi-bayar + polling 5 dtk + state kedaluwarsa.

### 9.4 ✅ Batch 5 — Tiket (F5) → versi `1.0-batch5` (selesai 2026-09-30)

Terdokumentasi penuh di §5d + OpenAPI: `GET /api/tickets/:kode` (tiket publik + notice Batal/Tutup + status check-in), `POST /api/admin/checkin` (admin only, idempoten). Wiring: `/tiket/:kode` data real (toggle check-in publik dihapus — hanya tampil status), `/riwayat` via `GET /api/me/bookings` (+ `/api/courts` untuk sidebar), modal `/admin/booking` dapat check-in + tampil status (list ikut kembalikan `checkedInAt`).

### 9.5 ✅ Batch 6 — Notifikasi (F6) → versi `1.0-batch6` (selesai 2026-09-30)

Terdokumentasi penuh di §7c + OpenAPI: `GET /api/cron/reminders` (H-1 & H-2jam, idempoten, retry 3x, WA wajib + email bila ada) + `GET /api/admin/notifications` (audit log, filter). Wiring: seksi Log Notifikasi di `/admin/monitoring` (20 terbaru, real).

### 9.6 ✅ Batch 7 — Laporan (F11) → versi `1.0-batch7` (selesai 2026-09-30)

Terdokumentasi penuh di §8b + OpenAPI: `GET /api/admin/reports` (JSON: omzet, total, batal, okupansi per lapangan) + `?format=csv` (ekspor server-side). Wiring: `/admin/laporan` data real + unduh CSV via anchor.

---

## 10. Model Data Ringkas

> Detail kolom: `src/db/schema.ts` (single source). Migrasi: `drizzle/`.

| Tabel | Kunci untuk API |
|---|---|
| `courts` | `id, name, hourlyPrice, isActive, isIndoor, description` |
| `court_hours` | `courtId, dayOfWeek (0–6), openTime/closeTime ("HH:MM")` |
| `bookings` | `code (unik), courtId, userId?, guestName/Phone?, bookingDate, status, source, subtotal, expiresAt, checkedInAt/By` (check-in diisi Batch 5) |
| `booking_slots` | `bookingId, courtId, slotDate, hour` — unik `(courtId, slotDate, hour)` = anti-overbooking |
| `payments` | `bookingId, gateway, gatewayRef?, orderId?, amount, status, qrisPayload?, expiresAt?, paidAt?` — `qrisPayload.qrString` diisi saat charge (Batch 4) |
| `closures` | `courtId, closureDate, startHour?/endHour? (null = sehari), reason?` |
| `otp_codes` | `phone, codeHash, expiresAt, attempts, consumedAt?` |
| `admins` / `admin_sessions` | `username + passwordHash (scrypt)` / `tokenHash (SHA-256), expiresAt` |
| `notification_logs` | `bookingId?, channel, type, status, error?` (diisi Batch 4: `tiket` saat PAID, `kadaluarsa` saat expire; Batch 6: `pengingat_h1/h2` + `gagal` bila kontak tak tersedia) |
| `users` | `phone (unik), name, email?` |

---

## Changelog Dokumen

| Versi | Tanggal | Perubahan |
|---|---|---|
| `1.0-batch1` | 2026-09-30 | Rilis awal: 11 endpoint Batch 1 (health, courts, slots, admin auth, schedule, closures, courts) + stub Batch 2–7 + OpenAPI YAML. Contoh respons dari panggilan asli ke Neon. |
| `1.0-batch2` | 2026-09-30 | +6 endpoint Batch 2 (otp request/verify, bookings create/detail, me/bookings, admin walk-in) + contoh real + skema OpenAPI baru. §5a/§5b/§8.3, stub 9.1 terisi. |
| `1.0-batch3` | 2026-09-30 | +3 operasi Batch 3 (admin bookings list, confirm/cancel, overview) + contoh real + skema OpenAPI baru. §7b, stub 9.2 terisi. |
| `1.0-batch4` | 2026-09-30 | +4 endpoint Batch 4 (payments charge/status, webhook, cron expire) + contoh real + skema OpenAPI baru + wiring `/booking`. §5c, stub 9.3 terisi. |
| `1.0-batch5` | 2026-09-30 | +2 endpoint Batch 5 (tickets publik, admin checkin) + `checkedInAt` di list admin + contoh + skema OpenAPI baru + wiring `/tiket/:kode`, `/riwayat`, modal `/admin/booking`. §5d, stub 9.4 terisi. |
| `1.0-batch6` | 2026-09-30 | +2 endpoint Batch 6 (cron reminders, admin notifications) + contoh + skema OpenAPI baru + seksi log di `/admin/monitoring`. §7c, stub 9.5 terisi. |
| `1.0-batch7` | 2026-09-30 | +1 endpoint Batch 7 (admin reports JSON + CSV) + contoh + skema OpenAPI baru + wiring `/admin/laporan`. §8b, stub 9.6 terisi. Seluruh batch 1–7 selesai. |

---

*Lanjut ke: [README](README.md) · OpenAPI: [07-api-backend.openapi.yaml](07-api-backend.openapi.yaml) · Fitur: [03-spesifikasi-fitur.md](03-spesifikasi-fitur.md)*
