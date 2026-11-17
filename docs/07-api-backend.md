# 07 — Dokumentasi Backend API

> Referensi teknis untuk seluruh endpoint backend (`src/app/api/`).
> Spesifikasi mesin-terbaca: [`07-api-backend.openapi.yaml`](07-api-backend.openapi.yaml) (impor ke Postman / Swagger UI).
> Versi dokumen mengikuti batch backend, format `1.0-batchN`. **Versi saat ini: `1.3-privasi` (kunci detail booking 2026-11-17).**
> Source of truth implementasi tetap kode di `src/app/api/` + skema `src/db/schema.ts`.

## Isi Dokumen

- [1. Pendahuluan](#1-pendahuluan)
- [2. Autentikasi](#2-autentikasi)
- [3. Konvensi Respons & Error](#3-konvensi-respons--error)
- [4. Rate Limit](#4-rate-limit)
- [5. Endpoint Publik](#5-endpoint-publik)
- [5a. Endpoint Pelanggan — Auth (Akun Email + Password)](#5a-endpoint-pelanggan--auth-akun-email--password)
- [5b. Endpoint Pelanggan — Booking](#5b-endpoint-pelanggan--booking)
- [5c. Endpoint Pembayaran — QRIS & Expiry](#5c-endpoint-pembayaran--qris--expiry)
- [5d. Endpoint Tiket & Check-in](#5d-endpoint-tiket--check-in)
- [6. Endpoint Admin — Auth](#6-endpoint-admin--auth)
- [7. Endpoint Admin — Jadwal & Penutupan](#7-endpoint-admin--jadwal--penutupan)
- [7b. Endpoint Admin — Monitoring](#7b-endpoint-admin--monitoring)
- [7c. Endpoint Admin — Cron Anonimisasi (Notifikasi Dipensiunkan)](#7c-endpoint-admin--cron-anonimisasi-notifikasi-dipensiunkan)
- [7d. Endpoint Admin — Akun Pemain](#7d-endpoint-admin--akun-pemain)
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
| Customer | `padel_session` (token acak 32 byte; **hash SHA-256** tersimpan di `user_sessions`) | `POST /api/auth/login` / `POST /api/auth/register` | 30 hari | `POST /api/bookings`, `GET /api/me/bookings`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`, `GET /api/tickets/:kode` (pemilik) |
| Cron internal | Header `x-cron-secret` / `Authorization: Bearer` / query `?secret=` via env `CRON_SECRET` | — | — | `GET /api/cron/expire`, `GET /api/cron/anonymize` |

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
| 429 | Rate limit | Terlalu banyak percobaan login/registrasi |

---

## 4. Rate Limit

| Endpoint | Batas | Jendela |
|---|---|---|
| `POST /api/admin/login` | 10 percobaan / IP | 60 detik |
| `POST /api/auth/register` | 5 percobaan / IP | 60 menit |
| `POST /api/auth/login` | 10 percobaan / IP | 60 detik |
| `POST /api/auth/change-password` | 10 percobaan / user | 60 detik |
| `POST /api/bookings` | 10/mnt per user + maks 3 booking aktif per akun (PRD Q8) | 60 detik |
| `POST /api/admin/checkin` | 30 percobaan / admin | 60 detik |

Implementasi: endpoint sensitif (auth, booking, check-in) memakai `src/lib/rate-limit-db.ts` — tabel Postgres `rate_limits`, fixed-window, konsisten lintas-instance ([ADR 0013](06-adr/0013-rate-limit-cron-produksi.md)). Endpoint jadwal (`/api/slots`, `/api/slots/status`) tetap memakai `src/lib/rate-limit.ts` (in-memory) karena di-polling sering. Batas booking aktif diperiksa di transaksi booking. Baris `rate_limits` lama dibersihkan oleh cron kedaluwarsa.

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

### 5.4 `GET /api/slots/status?date=&v=` — polling delta jadwal

Klien mengirim versi terakhir (`v`) yang dipegang; server membalas **304 tanpa query DB** bila tidak ada perubahan. Bila ada perubahan, balasan `{ ok, v, full: false, slots: [...] }` berisi patch slot; `full: true` mengirim `schedule` penuh (mis. server baru restart / klien tertinggal). Dipakai polling 10 detik di `/booking` dan `/admin/jadwal`.

```bash
curl "http://localhost:3100/api/slots/status?date=2026-10-05&v=3"
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Format tanggal salah | 400 | `Parameter date wajib format YYYY-MM-DD` |
| Terlalu sering | 429 | `Terlalu banyak permintaan jadwal, coba lagi sebentar` |

---

## 5a. Endpoint Pelanggan — Auth (Akun Email + Password)

> F3 — Checkout dengan akun ([ADR 0009](06-adr/0009-akun-email-password.md)). **OTP dihapus** dari MVP. Password di-hash `scrypt`; sesi `padel_session` membawa `userId`. Tidak ada verifikasi email; **reset lupa password** hanya oleh admin, sedangkan **ganti password saat login** tersedia mandiri ([ADR 0012](06-adr/0012-ganti-password-mandiri.md)).

### 5a.1 `POST /api/auth/register` — daftar akun

```bash
curl -X POST http://localhost:3100/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Raka Pratama","email":"raka@example.com","password":"rahasia123","phone":"081234567890"}' -c cust.txt
```

```json
{ "ok": true, "user": { "id": 1, "name": "Raka Pratama", "email": "raka@example.com", "phone": "6281234567890" } }
```

Aturan: email unik (case-insensitive), password minimal 8 karakter, nomor HP dinormalisasi ke `62…` tanpa verifikasi. Akun aktif langsung dan cookie `padel_session` diset.

| Error | Kode | Contoh `message` |
|---|---|---|
| Field kurang / format email salah | 400 | `Email tidak valid` |
| Password pendek | 400 | `Password minimal 8 karakter` |
| Email sudah terdaftar | 409 | `Email sudah terdaftar` |
| Terlalu sering (IP) | 429 | `Terlalu banyak pendaftaran, coba lagi nanti` |

### 5a.2 `POST /api/auth/login` — masuk

```bash
curl -X POST http://localhost:3100/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"raka@example.com","password":"rahasia123"}' -c cust.txt
```

```json
{ "ok": true, "user": { "id": 1, "name": "Raka Pratama", "email": "raka@example.com" } }
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Email/password salah | 401 | `Email atau password salah` |
| Terlalu sering (IP) | 429 | `Terlalu banyak percobaan, coba lagi sebentar` |

### 5a.3 `POST /api/auth/logout` — keluar

Menghapus sesi aktif (`user_sessions`) dan cookie `padel_session`.

```json
{ "ok": true }
```

### 5a.4 `GET /api/auth/me` — profil sesi berjalan

```json
{ "ok": true, "user": { "id": 1, "name": "Raka Pratama", "email": "raka@example.com", "phone": "6281234567890" } }
```

Tanpa sesi → `401`.

### 5a.5 `POST /api/auth/change-password` — ganti password saat login

Perlu sesi `padel_session` ([ADR 0012](06-adr/0012-ganti-password-mandiri.md)). Body: `currentPassword`, `newPassword` (minimal 8 karakter). Password lama salah → `401`. Bila berhasil, password di-hash ulang dan **sesi perangkat lain dicabut**; sesi perangkat ini tetap aktif.

```bash
curl -X POST http://localhost:3100/api/auth/change-password \
  -H 'Content-Type: application/json' -b cust.txt \
  -d '{"currentPassword":"rahasia123","newPassword":"rahasiaBaru456"}'
```

```json
{ "ok": true, "changed": true }
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Masuk ke akun terlebih dahulu` |
| Field kurang | 400 | `Password lama dan password baru wajib diisi` |
| Password baru pendek | 400 | `Password baru minimal 8 karakter` |
| Password lama salah | 401 | `Password lama salah` |
| Terlalu sering | 429 | `Terlalu banyak percobaan, coba lagi sebentar` |

### 5a.6 Reset password oleh admin

`POST /api/admin/users/:id/reset-password` (sesi admin) — menetapkan password baru sementara dan mengakhiri seluruh sesi user tersebut. Halaman admin `/admin/users` memakai endpoint ini; daftar akun lewat `GET /api/admin/users?q=`. Reset lupa password mandiri belum ada (PRD Q7).

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
| Tanpa sesi | 401 | `Masuk ke akun terlebih dahulu` |
| Body kurang | 400 | `courtId, date (YYYY-MM-DD), dan hours[] wajib diisi` |
| Tanggal lewat | 400 | `Tanggal sudah lewat` |
| Tidak berurutan | 409 | `Hanya jam berurutan dalam satu lapangan yang dibolehkan.` |
| Slot dipesan | 409 | `Slot sudah dipesan pihak lain. Pilih jam lain.` |
| Kena closure | 409 | `Sebagian jam bersinggungan dengan jadwal tutup/maintenance.` |
| Di luar jam | 409 | `Jam di luar operasional lapangan.` |

### 5b.2 `GET /api/bookings/:code` — detail via kode (wajib sesi)

Perlu sesi `padel_session` (pemilik) atau sesi admin. Pelanggan hanya boleh membuka booking miliknya sendiri (`booking.userId` cocok dengan sesi); selain itu 403. Admin boleh membuka semua booking.

```bash
curl http://localhost:3100/api/bookings/PD-VKB6WV -b cust.txt
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
| Tanpa sesi | 401 | `Masuk ke akun terlebih dahulu` |
| Bukan pemilik | 403 | `Anda bukan pemilik booking ini` |
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

## 5c. Endpoint Pembayaran — Snap & Expiry

> F4 — Pembayaran via Midtrans **Snap popup** (ADR 0008, 2026-10-01; menggantikan QR Core API ADR 0007). Driver `midtrans`: charge mengembalikan `snapToken` (+ `redirectUrl`) untuk `snap.pay()`; semua metode pembayaran aktif. Driver `mock` (tanpa kredensial): QR berupa payload teks `MOCK-QRIS:ORD-<kode>:<amount>` (dekoratif, lokal saja). Expiry 15 menit server-side (ADR 0006); sumber kebenaran expiry tetap `bookings.expiresAt`. Webhook dikirim per transaksi via `X-Override-Notification` (tanpa setting dashboard) bila `APP_PUBLIC_URL` diisi.

### 5c.1 `POST /api/payments/:code/charge` — charge Snap/QR (idempoten)

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
    "gateway": "midtrans",
    "qrString": null,
    "qrImageUrl": null,
    "snapToken": "b3bb2da4-...-midtrans-snap-token",
    "redirectUrl": "https://app.sandbox.midtrans.com/snap/v4/redirection/…",
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
    "gateway": "midtrans",
    "qrString": "MOCK-QRIS:ORD-PD-YTZE3G:70000",
    "snapToken": null,
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

Perlu `CRON_SECRET` (header `x-cron-secret`, `Authorization: Bearer`, atau query `?secret=`). Dijadwalkan oleh `vercel.json` **setiap 5 menit** (`*/5 * * * *`); bila deploy non-Vercel, daftarkan jadwal yang sama di scheduler eksternal ([ADR 0013](06-adr/0013-rate-limit-cron-produksi.md)). Tiap booking kedaluwarsa: `menunggu_pembayaran → dibatalkan`, payment `pending → expired`, log `kadaluarsa` — slot kembali `kosong` otomatis. Route ini juga membersihkan baris `rate_limits` yang sudah basi.

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

> F5 — Tiket/bukti booking digital. Tiket **wajib login**: pemain hanya boleh membuka tiket miliknya sendiri (kode unik saja tidak cukup), admin bersesi boleh membuka semua tiket untuk scanner gate. Check-in hanya oleh admin bersesi (halaman tiket tidak boleh men-toggle sendiri).

### 5d.1 `GET /api/tickets/:kode` — tiket (wajib login/pemilik)

Memuat seluruh field tiket (AC F5: kode, nama & HP, lapangan, tanggal, jam, durasi implisit dari `hours`, total, status) + `paymentStatus`/`paidAt` + `checkedInAt`/`checkedInBy` + `closureNotice` (pemberitahuan bila jadwal ketiban penutupan/Tutup; Batal ditandai via `status: dibatalkan`).

**Akses:** sesi `padel_session` milik `booking.userId` **atau** sesi admin. Tanpa sesi → `401`; sesi pemain lain → `403`.

```bash
curl http://localhost:3100/api/tickets/PD-YTZE3G -b cust.txt
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
| Tanpa sesi | 401 | `Masuk ke akun terlebih dahulu` |
| Bukan pemilik | 403 | `Anda bukan pemilik tiket ini` |
| Tidak ada | 404 | `Tiket tidak ditemukan` |

Halaman `/tiket/[kode]` mengarahkan `401` ke `/login?next=/tiket/[kode]` dan menampilkan pesan khusus untuk `403`.

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

## 7c. Endpoint Admin — Cron Anonimisasi (Notifikasi Dipensiunkan)

> **Revisi 2026-11-12:** F6 dan seluruh kanal notifikasi WhatsApp/Email dibatalkan dari MVP ([ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)). Endpoint `GET /api/cron/reminders` dan `GET /api/admin/notifications` **dipensiunkan** — dihapus saat implementasi bersama tabel `notification_logs`. Pemanggilan notifikasi di webhook pembayaran dan cron kedaluwarsa juga dihapus. Panel `/admin/monitoring` kehilangan seksi log notifikasi (diganti data booking bila perlu).

### 7c.1 `GET /api/cron/anonymize` — anonimisasi user bayangan > 7 hari

Perlu `CRON_SECRET` (pola sama dengan `/api/cron/expire`). Dijadwalkan `vercel.json` **harian 03:00 UTC** (`0 3 * * *`). Memproses `users` dengan `is_guest = true` yang tidak punya booking aktif dan booking terakhirnya lebih dari 7 hari lalu: nama → `"Tamu"`, `phone`/`email` → `NULL`, `anonymized_at` diisi. Baris user & booking **tidak dihapus** ([ADR 0011](06-adr/0011-user-bayangan-walkin.md)).

```bash
curl -H 'x-cron-secret: dev-cron-secret-lokal' http://localhost:3100/api/cron/anonymize
```

```json
{ "ok": true, "anonymized": 2, "skipped": 0 }
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa/salah secret | 401 | `Unauthorized` |

---

## 7d. Endpoint Admin — Akun Pemain

> Dipakai halaman `/admin/users` ([ADR 0012](06-adr/0012-ganti-password-mandiri.md)) untuk mencari akun pemain dan mereset password saat pemain lupa. Reset **lupa password** tetap lewat admin; reset mandiri menunggu kanal email (PRD Q7).

### 7d.1 `GET /api/admin/users?q=` — daftar/cari akun

**Perlu sesi admin.** `q` opsional (cocokkan nama/email/nomor HP, case-insensitive). Maksimal 25 hasil, urut terbaru.

```bash
curl "http://localhost:3100/api/admin/users?q=raka" -b cookies.txt
```

```json
{
  "ok": true,
  "users": [
    {
      "id": 1,
      "name": "Raka Pratama",
      "email": "raka@example.com",
      "phone": "6281234567890",
      "isGuest": false,
      "anonymizedAt": null,
      "createdAt": "2026-11-12T09:10:00.000Z"
    }
  ]
}
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Unauthorized` |

### 7d.2 `POST /api/admin/users/:id/reset-password` — reset password oleh admin

**Perlu sesi admin.** Body: `password` (minimal 8 karakter). Password di-hash `scrypt` baru dan **seluruh sesi user tersebut diakhiri**. User bayangan walk-in tidak punya password → `409`.

```bash
curl -X POST http://localhost:3100/api/admin/users/1/reset-password \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"password":"sementara123"}'
```

```json
{ "ok": true, "userId": 1 }
```

| Error | Kode | Contoh `message` |
|---|---|---|
| Tanpa sesi | 401 | `Unauthorized` |
| ID invalid | 400 | `ID user tidak valid` |
| Password pendek | 400 | `Password minimal 8 karakter` |
| Tidak ada | 404 | `User tidak ditemukan` |
| User bayangan | 409 | `User bayangan tidak punya password` |

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

### 9.1 ✅ Batch 2 — Booking + Auth Akun + Walk-in (F2, F3, F8) → versi `1.0-batch2` (selesai 2026-09-30; auth direvisi `1.1-auth`)

Terdokumentasi penuh di §5a, §5b, dan §8.3 + OpenAPI: ~~`POST /api/otp/request|verify`~~ (dipensiunkan, diganti `POST /api/auth/register|login`), `POST /api/bookings`, `GET /api/bookings/:code`, `GET /api/me/bookings`, `POST /api/admin/bookings`.

### 9.2 ✅ Batch 3 — Admin monitoring (F7 penuh, F10) → versi `1.0-batch3` (selesai 2026-09-30)

Terdokumentasi penuh di §7b + OpenAPI: `GET /api/admin/bookings` (filter/cari/expiring), `PATCH /api/admin/bookings/:code` (confirm/cancel), `GET /api/admin/overview` (KPI harian).

### 9.3 ✅ Batch 4 — Pembayaran mock + expiry (F4) → versi `1.0-batch4` (selesai 2026-09-30)

Terdokumentasi penuh di §5c + OpenAPI: `POST /api/payments/:code/charge` (idempoten), `GET /api/payments/:code/status` (polling fallback), `POST /api/webhooks/payment` (PAID → `terkonfirmasi` + tiket, idempoten), `GET /api/cron/expire` (perlu `CRON_SECRET`). Wiring `/booking`: QR payload mock + countdown expiry server + simulasi-bayar + polling 5 dtk + state kedaluwarsa.

### 9.4 ✅ Batch 5 — Tiket (F5) → versi `1.0-batch5` (selesai 2026-09-30)

Terdokumentasi penuh di §5d + OpenAPI: `GET /api/tickets/:kode` (sejak `1.2-akun` wajib login + pemilik/admin + notice Batal/Tutup + status check-in), `POST /api/admin/checkin` (admin only, idempoten). Wiring: `/tiket/:kode` data real (toggle check-in publik dihapus — hanya tampil status), `/riwayat` via `GET /api/me/bookings` (+ `/api/courts` untuk sidebar), modal `/admin/booking` dapat check-in + tampil status (list ikut kembalikan `checkedInAt`).

### 9.5 ❌ Batch 6 — Notifikasi (F6) → versi `1.0-batch6` (dipensiunkan 2026-11-12)

Dibatalkan dari MVP ([ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)): `GET /api/cron/reminders` + `GET /api/admin/notifications` dihapus, tabel `notification_logs` di-drop. F6 pindah ke v2.0.

### 9.6 ✅ Batch 7 — Laporan (F11) → versi `1.0-batch7` (selesai 2026-09-30)

Terdokumentasi penuh di §8b + OpenAPI: `GET /api/admin/reports` (JSON: omzet, total, batal, okupansi per lapangan) + `?format=csv` (ekspor server-side). Wiring: `/admin/laporan` data real + unduh CSV via anchor.

### 9.7 ✅ Akun + Operasional → versi `1.2-akun` (selesai 2026-11-15)

Ganti password mandiri (§5a.5, `/akun`, [ADR 0012](06-adr/0012-ganti-password-mandiri.md)); reset password admin (§7d, `/admin/users`); tiket wajib login/pemilik (§5d.1); rate-limit persisten `rate_limits` + jadwal Vercel Cron (§4, §5c.4, §7c.1, [ADR 0013](06-adr/0013-rate-limit-cron-produksi.md)); `GET /api/slots/status` didokumentasikan di OpenAPI.

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
| `users` | `email?, passwordHash? (scrypt; null untuk user bayangan), name, phone?, isGuest, anonymizedAt?, createdAt/updatedAt` |
| `user_sessions` | `userId, tokenHash (SHA-256), expiresAt` |
| `rate_limits` | `key (unik), count, windowStart` — fixed-window endpoint sensitif ([ADR 0013](06-adr/0013-rate-limit-cron-produksi.md)) |
| ~~`otp_codes`~~ | **dipensiunkan** ([ADR 0009](06-adr/0009-akun-email-password.md)) — di-drop saat migrasi |
| `admins` / `admin_sessions` | `username + passwordHash (scrypt)` / `tokenHash (SHA-256), expiresAt` |
| ~~`notification_logs`~~ | **dipensiunkan** ([ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)) — di-drop saat migrasi |

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
| `1.1-auth` | 2026-11-12 | **Revisi scope:** §5a OTP → auth email+password (`/api/auth/register|login|logout|me`, reset admin); F6 + notifikasi dipensiunkan (§7c → `cron/anonymize`); `user_sessions` baru; `otp_codes` & `notification_logs` di-drop; rate-limit registrasi/login. Mengikuti ADR 0009–0011. |
| `1.2-akun` | 2026-11-15 | **Akun + operasional:** sesi pemain pakai token acak + hash SHA-256 (bukan HMAC); `POST /api/auth/change-password` (§5a.5) + halaman `/akun`; `GET /api/admin/users` + `POST /api/admin/users/:id/reset-password` + halaman `/admin/users` (§7d); `GET /api/tickets/:kode` wajib login + pemilik (401/403, §5d.1); rate-limit endpoint sensitif pindah ke tabel Postgres `rate_limits`; jadwal Vercel Cron di `vercel.json` (§5c.4, §7c.1). Mengikuti ADR 0012–0013. |
| `1.3-privasi` | 2026-11-17 | **Privasi booking:** `GET /api/bookings/:code` tidak lagi publik — wajib sesi, pemain hanya pemilik (401/403), admin boleh semua (§5b.2 + OpenAPI). Test guard privasi ditambah (tiket tanpa sesi 401, guest reset 409). |

---

*Lanjut ke: [README](README.md) · OpenAPI: [07-api-backend.openapi.yaml](07-api-backend.openapi.yaml) · Fitur: [03-spesifikasi-fitur.md](03-spesifikasi-fitur.md)*
