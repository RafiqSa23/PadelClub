# ADR 0013 — Rate-limit Lintas-instance & Penjadwalan Cron Produksi

- **Status:** Accepted
- **Tanggal:** 2026-11-15
- **Pemilik:** Tech Lead

## Konteks
Dua mekanisme MVP masih bergantung pada proses tunggal:

1. **Rate-limit in-memory** (`src/lib/rate-limit.ts`) hanya berlaku per instance. Bila aplikasi berjalan di beberapa instance/serverless, batas registrasi/login/booking bisa dilewati dengan menyebar request.
2. **Cron** (`/api/cron/expire`, `/api/cron/anonymize`) butuh pemanggil eksternal; belum ada konfigurasi penjadwalan di repo, sehingga pelepasan slot kedaluwarsa dan anonimisasi user bayangan tidak berjalan otomatis.

## Keputusan
- **Rate-limit persisten untuk endpoint sensitif** memakai tabel Postgres `rate_limits` (`key` unik, `count`, `windowStart`) dengan fixed-window dan operasi upsert atomik:
  - Dipakai di: `POST /api/auth/register|login`, `POST /api/admin/login`, `POST /api/bookings`, `POST /api/admin/checkin`.
  - Endpoint jadwal (`/api/slots`, `/api/slots/status`) tetap memakai rate-limit **in-memory** karena di-polling sering; menambah roundtrip DB akan menghapus manfaat cache/304.
  - Baris lama dibersihkan oleh cron kedaluwarsa (satu query `DELETE` murah).
- **Penjadwalan cron via Vercel Cron** (`vercel.json`):
  - `/api/cron/expire` — setiap 5 menit (butuh paket yang mengizinkan jadwal per menit; bila tidak, turunkan frekuensi dan catat).
  - `/api/cron/anonymize` — harian 03:00 UTC.
  - Vercel mengirim `Authorization: Bearer ${CRON_SECRET}`; route sudah menerima header tersebut.
- Bila deploy bukan di Vercel, jadwal yang sama didaftarkan di scheduler eksternal (cron-job.org / GitHub Actions schedule) — kontrak endpoint tidak berubah.

## Alasan
- **Konsisten lintas instance:** batas auth tetap berlaku walau aplikasi diskalakan.
- **Tanpa infrastruktur baru:** Postgres sudah menjadi dependensi; tidak perlu Redis.
- **Operasional otomatis:** cron mengembalikan slot dan menjalankan retensi data tanpa intervensi manual.

## Konsekuensi
- **Baik:** keamanan rate-limit konsisten; slot kedaluwarsa & anonimisasi berjalan otomatis di produksi.
- **Perlu diwaspadai:**
  - Tabel `rate_limits` menambah satu roundtrip DB pada endpoint sensitif (frekuensi rendah).
  - Vercel Cron per-menit bergantung paket akun; jadwal `/api/cron/expire` di Hobby dibatasi harian → pelepasan slot bisa terlambat; mitigasi: polling status pembayaran sisi klien tetap menutup slot tepat waktu.
  - `CRON_SECRET` wajib di-set di produksi; tanpa secret route mengizinkan akses (perilaku dev, jangan dipakai di produksi).
- **Skema:** migrasi `0005` menambah tabel `rate_limits`.

## Alternatif yang Ditolak
- **Redis/Upstash:** menambah dependensi & biaya; Postgres memadai untuk volume MVP.
- **Rate-limit DB untuk endpoint jadwal:** menghapus manfaat cache/304 dan menambah beban DB.
- **Cron manual:** rawan terlewat; anonimisasi & pelepasan slot harus otomatis.

## Referensi
- [ADR 0006 — Batas Waktu Pembayaran QRIS](0006-batas-waktu-pembayaran-qris.md)
- [ADR 0011 — User Bayangan Walk-in](0011-user-bayangan-walkin.md)
- [PRD — §4.4 Security & Privacy](../04-PRD.md#44-security--privacy)
