# ADR 0004 — Jumlah Lapangan & Jam Operasional Configurable oleh Admin

- **Status:** Accepted
- **Tanggal:** 2026-09-22
- **Pemilik:** Product Owner

## Konteks
Venue saat ini berniat memiliki **5–10 lapangan** dengan jam operasional yang bisa berbeda per hari. Kepastian jumlah final belum ditetapkan, sehingga sistem tidak boleh "mengeras" (hardcode) terhadap jumlah/jam tertentu.

## Keputusan
Jumlah lapangan, harga per jam, dan jam operasional menjadi **data yang dapat dikonfigurasi oleh admin** (tidak di-hardcode).

- Admin dapat menambah/mengubah lapangan beserta harga/jam-nya.
- Jam operasional dapat diatur per hari (buka/tutup).
- Grid jadwal & slot otomatis mengikuti konfigurasi tersebut.

## Alasan
- **Fleksibilitas bisnis:** pemilik dapat menyesuaikan tanpa perlu perubahan kode.
- **Skala MVP yang belum final:** 5–10 lapangan adalah estimasi; sistem tetap benar untuk 1 atau 15 lapangan.
- **Perubahan harga musiman:** ditangani melalui konfigurasi harga biasa.
- **Mendukung fitur tutup lapangan** (F9) tanpa merombak model data.

## Konsekuensi
- **Baik:** operasional mandiri admin; grid & harga selalu akurat sesuai konfigurasi.
- **Perlu diwaspadai:**
  - Perlu validasi anti-bentrok saat admin mengubah jam operasional (booking yang sudah ada di jam yang dihapus harus ditangani — masih pertanyaan terbuka, lihat bagian Open Questions di PRD).
  - Perlunya audit trail untuk perubahan konfigurasi.
  - Grid admin harus mampu menampilkan layout dinamis (bukan grid statis).

## Alternatif yang Ditolak
- Jumlah & jam hardcode (mis. selalu 10 lapangan, 08:00–22:00) — rentan dan tidak sesuai kebutuhan pemilik nyata.
- Mendefinisikan konfigurasi sebagai kode/config env — kurang lentur bagi admin non-teknis.

## Referensi
- [01 — Konsep Produk, Batasan & Asumsi](../01-konsep-produk.md#6-batasan--asumsi-operasional)
- [Spesifikasi Fitur F9 — Tutup Lapangan](../03-spesifikasi-fitur.md#f9--tutup-lapangan-maintenance)