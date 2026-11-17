# ADR 0014 — QR Tiket Bertanda Tangan & Log Pemindaian Gate

- **Status:** Accepted
- **Tanggal:** 2026-11-17
- **Pemilik:** Tech Lead

## Konteks
QR tiket sebelumnya hanya berisi kode booking polos (`PD-XXXXXX`). Siapa pun yang tahu/ membuat gambar QR berisi kode tersebut bisa memakainya di scanner gate, dan screenshot QR berlaku selamanya. Selain itu riwayat pemindaian di `/admin/scanner` hanya hidup di state React: hilang saat reload, ganti perangkat, atau pergantian shift, sehingga tidak ada audit check-in.

Kode booking tetap dipakai di UI, riwayat, dan validasi manual karena resepsionis adalah aktor tepercaya. Yang perlu diperkuat adalah jalur **kamera otomatis** yang membaca QR tanpa melibatkan manusia.

## Keputusan
- **Payload QR bertanda tangan** dengan format versioned:
  `v1.<KODE>.<expEpochDetik>.<hmacBase64Url>`
  - Tanda tangan **HMAC-SHA256** atas `v1.<KODE>.<exp>` memakai `TICKET_QR_SECRET` (minimal 16 karakter).
  - Masa berlaku **5 menit**; halaman `/tiket/[kode]` memperbarui QR tiap ±4 menit dan saat tab kembali aktif.
  - Verifikasi memakai `timingSafeEqual`; kode pada token harus sama dengan kode di URL.
  - Implementasi server: `src/lib/ticket-qr.ts`; format/parser isomorphic: `src/lib/ticket-qr-format.ts`.
- **Penegakan hanya di jalur kamera:** scanner mengirim `GET /api/tickets/:kode?qr=<payload>`. Token tidak valid/kedaluwarsa/kode tidak cocok → `403`. Input manual tetap mengirim kode saja (admin tepercaya).
- **Secret:** `TICKET_QR_SECRET` di `.env`; wajib di produksi (server menolak menandatangani QR tanpa secret saat `NODE_ENV=production`). Rotasi secret langsung membatalkan semua QR lama.
- **Log pemindaian persisten:** tabel `scan_logs` (`bookingId` nullable, `code`, `adminId`/`adminUsername`, `outcome` enum `ok|already|rejected`, `reason`, `createdAt`) diisi best-effort oleh `POST /api/admin/checkin`.
  - `GET /api/admin/scans?limit=20` (admin, rate-limit 120/menit) mengembalikan riwayat terbaru untuk scanner.
  - Penolakan yang terjadi **sebelum** API check-in (batal, belum lunas, duplikat scan di klien) tetap hanya tersimpan di sesi scanner; bukan sumber kebenaran server.
- Migrasi `0006` menambah enum `scan_outcome` + tabel `scan_logs`.

## Alasan
- **Anti-forgery:** tanpa secret, penyerang tidak bisa membuat payload yang lolos verifikasi meski tahu kode booking.
- **Membatasi reuse screenshot:** TTL pendek membuat screenshot cepat kedaluwarsa; verifikasi tetap di server sehingga jam perangkat tidak bisa dimanipulasi.
- **Audit nyata:** log DB bertahan lintas reload/perangkat dan mencatat alasan penolakan dari server.
- **Tanpa infrastruktur baru:** HMAC memakai `node:crypto`; log memakai Postgres yang sudah ada.

## Konsekuensi
- **Baik:** QR palsu ditolak; check-in sukses/gagal dapat diaudit; scanner menampilkan riwayat setelah reload.
- **Perlu diwaspadai:**
  - Screenshot QR masih bisa dipakai sampai TTL habis (≤5 menit). Pencegahan satu-kali-pakai butuh nonce/state tambahan (lihat alternatif).
  - Tiket cetak/unduhan berisi QR lama akan kedaluwarsa; resepsionis harus memakai input manual atau pemain membuka halaman tiket terbaru. Ini didokumentasikan di F5.
  - `TICKET_QR_SECRET` wajib ada di produksi; secret hilang/berubah membuat semua QR lama invalid (pemain cukup memuat ulang halaman).
  - Tabel `scan_logs` tumbuh terus; belum ada retensi otomatis. Volume MVP kecil, tetapi perlu kebijakan retensi bila dipakai jangka panjang.
  - Kegagalan insert log tidak menggagalkan check-in (best-effort) agar operasional gate tidak terblokir.

## Alternatif yang Ditolak
- **QR kode polos (status quo):** mudah dipalsukan; tidak ada bukti bahwa QR dibuat server.
- **Nonce satu-kali-pakai di DB:** mencegah screenshot sepenuhnya, tetapi menambah tulis/baca DB setiap rotasi dan menimbulkan masalah saat scan gagal/retry; ditunda sampai ada kebutuhan nyata.
- **JWT library:** menambah dependensi untuk payload 4 bagian; HMAC `node:crypto` cukup dan lebih kecil.
- **TTL panjang (mis. 24 jam):** nyaman untuk tiket cetak, tetapi membuka window reuse screenshot yang jauh lebih besar.

## Referensi
- [ADR 0006 — Batas Waktu Pembayaran QRIS](0006-batas-waktu-pembayaran-qris.md)
- [ADR 0013 — Rate-limit Lintas-instance & Cron Produksi](0013-rate-limit-cron-produksi.md)
- [Spesifikasi Fitur — F5](../03-spesifikasi-fitur.md#f5--tiket--bukti-booking-digital)
- [Dokumentasi API — §5d](../07-api-backend.md#5d-endpoint-tiket--check-in)
