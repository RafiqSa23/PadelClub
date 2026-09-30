# Design System: Padel Court Booking

**Project:** Sistem Penyewaan Lapangan Padel (Padel Court Booking)
**Versi:** 0.3 (Diadopsi — token terverifikasi terhadap implementasi)
**Tanggal:** 2026-09-28
**Status:** Diadopsi — arah visual diturunkan dari desain sistem Stitch yang disetujui untuk pengembangan; nilai hex, skala tipografi, dan token akhir kini hidup di [`../src/app/globals.css`](../src/app/globals.css).

> **Bukan source of truth.** Dokumen ini memformalkan keputusan desain yang sudah ada dan mengusulkan arah visual. PRD (`04-PRD.md`) tetap menjadi dokumen master; dokumen ini tidak menambah fitur, status, atau acceptance criteria. Source of truth **teknis** untuk token/warna/tipografi adalah `src/app/globals.css` — bila ada selisih dengan tabel di bawah, ikuti file CSS.
>
> Istilah domain mengikuti `05-glossary.md`. Status slot mengikuti matriks resmi di `02-user-journey.md` §6.

---

## 1. Visual Theme & Atmosphere

Produk ini harus terasa: **Ringan, cepat, sportif, dan tepercaya.** Identitas visual diturunkan dari janji produk "3 klik & 2 menit":

- **Cepat & tanpa friksi** — layout padat, fokus pada grid slot, minim elemen dekoratif yang memperlambat aksi.
- **Sportif energik** — bahasa visual padel: warna hijau lapangan, aksen keras yang tegas, tipografi modern.
- **Transparan** — harga, status slot, dan detail biaya selalu terlihat sejak awal; tidak ada kejutan.
- **Tepercaya** — status slot yang tidak ambigu, konfirmasi pembayaran yang jelas, tiket yang resmi.

Densitas: medium. Kerapatan informasi tinggi pada layar grid (slot), tetapi longgar pada alur checkout agar pengguna tidak panik.

---

## 2. Color Palette & Roles

### 2.1 Status Slot — DIKUNCI (dari `02-user-journey.md` §6)

Status berikut sudah dikunci secara fungsional di seluruh dokumen. Warna **diadopsi** dari desain sistem Stitch dan sudah disinkronkan dengan token di `src/app/globals.css` (2026-09-28); peran berikut tetap berlaku:

| Status | Peran | Nama Deskriptif (Diadopsi) | Hex (Diadopsi) | Catatan |
|---|---|---|---|---|
| Kosong (Available) | Slot dapat dipilih | Court-grass Light | `#E8F5E9` (isi) / `#FFFFFF` | Pilihan pada area putih/hijau muda |
| Terkonfirmasi | Sudah dibayar & sah | Confirmed Blue | `#1565C0` | Tidak dapat diklik pelanggan |
| Menunggu Pembayaran | Booking dibuat, belum lunas | Pending Amber | `#F9A825` | Terkunci sementara, ada timer |
| Tutup / Maintenance | Diblokir sengaja | Closure Grey | `#9E9E9E` + label silang | Tidak dapat dipilih |

### 2.2 Brand & Aksi — DIADOPSI

| Nama Deskriptif | Hex (Diadopsi) | Peran Fungsional |
|---|---|---|
| Court Green (brand utama) | `#2E7D32` | Tombol aksi utama ("Booking Sekarang", "Lanjut ke Pembayaran"), tautan aktif |
| Court Green Deep | `#1B5E20` | Hover / penekanan brand |
| Night Padel (teks utama) | `#1A1A2E` | Judul, teks primer |
| Slate Whisper (teks sekunder) | `#5A5A6E` | Keterangan, harga, placeholder |
| Field White (permukaan) | `#FFFFFF` | Kartu, modal, grid |
| Mist Shadow (latar) | `#F4F6F8` | Latar halaman / kanvas grid |

> Peran fungsional lain: warna status pembayaran memakai token `pending` / `error` dari `globals.css` (gateway QRIS: Midtrans — [ADR 0007](06-adr/0007-payment-gateway-midtrans.md), tanpa amplop warna brand gateway terpisah); warna error/gagal `#D32F2F` untuk pesan OTP salah atau pembayaran kedaluwarsa.

---

## 3. Typography Rules

**Diadopsi** — keluarga utama **Plus Jakarta Sans** (via `next/font`, token `--font-sans` / `--font-display` di `globals.css`), mono **Geist Mono** (`--font-mono`):

- Karakter: sans-serif geometris/humanis — ramah layar, mendukung Bahasa Indonesia, harga & jam tampil tajam.
- **Angka tabular** untuk harga, jam, dan durasi agar kolom grid sejajar rapi (token `data-tabular`).
- Skala proporsional (nilai final di `globals.css`):

| Level | Ukuran (Diadopsi) | Bobot | Penggunaan |
|---|---|---|---|
| Display | 36px (30px mobile) | 800 | Hero landing (CTA utama) |
| H1 | 28px (24px mobile) | 700 | Judul halaman / wizard |
| H2 | 20px | 600 | Judul seksi, ringkasan booking |
| Body | 16px | Regular | Teks inti |
| Caption | 13px | 600 | Harga, jam operasional, label slot |
| Micro | 12px | 500 | Timer OTP, keterangan status |

- Letter-spacing: normal (0) pada body; negatif ringan pada display/headline (`-0,01`…`-0,02em`). **Tidak memakai** caps-kecil berlebihan kecuali label tombol/status.
- Kontras minimal: teks utama ≥ WCAG AA (4.5:1) terhadap `Field White`.

---

## 4. Component Stylings

### Buttons
- **Primary:** pill-shaped (radius 8–12px), background `Court Green`, teks putih; hover gelap (`Court Green Deep`); memuat status "processing" (spinner) saat menunggu webhook pembayaran.
- **Secondary / Ghost:** stroke tipis abu (`Slate Whisper` 40%), background `Field White`; untuk "Kirim ulang OTP", aksi inline admin.
- **Danger:** `#D32F2F` hanya untuk aksi destruktif (batalkan booking).
- Ukuran sentuh ≥ 44px (mobile-first).

### Slot Grid Cell
- Bentuk kotak dengan **sudut sedikit melengkung** (radius 4–6px), bukan pill — untuk kepadatan grid.
- Tiga visual state: `Kosong` (isi hijau muda, hover outline brand), `Terkunci` (isi confirmed/pending/closure — tidak diklik), `Terpilih` (isi `Court Green`, teks putih) — respons visual **langsung** saat diklik sesuai prinsip UX `02-user-journey.md` §1.
- Label dalam sel: jam (mis. `18:00`) — ringkas, tanpa tanggal.

### Cards / Containers
- Sudut **lumayan melengkung** (radius 12px), latar `Field White`, bayangan **halus menyebar** (whisper-diffused, elevation 1–3) untuk kartu ringkasan order & tiket.
- Grid jadwal admin: kanvas `Mist Shadow`, sel-sel grid rata (border 1px abu muda), tanpa bayangan per-sel.

### Inputs / Forms
- Field ber-stroke abu tipis (1px, `Slate Whisper` 50%), latar `Field White`; fokus: outline `Court Green` 2px.
- Input nomor HP: klavier telepon (telephone input pattern, prefix +62), satu baris, tombol "Kirim OTP" berdampingan.
- OTP: 6 kotak terpisah, angka tabular, tombol "Kirim ulang" dengan **countdown 60 detik** (per spesifikasi F3).

---

## 5. Layout Principles

- **Mobile-first & responsive** — MVP berbasis web responsive (`01-konsep-produk.md` §5), grid harus tetap terbaca di hp dengan scroll horizontal yang jelas pada tabel jam.
- **Konsistensi spasi:** skala 4px (4/8/12/16/24/32) — kepadatan grid pakai 4–8px; antar-seksi 24–32px.
- **Grid slot = bahasa utama:** seluruh layar (customer & admin) memakai matriks Lapangan × Jam dengan **satu sumber kebenaran** waktu nyata (prinsip `02-user-journey.md` §1).
- **Wizard booking satu halaman** (`/booking`): multi-step dalam satu URL — tanggal → lapangan & jam → review → checkout. Ringkasan (subtotal) selalu terlihat (sticky) di sisi kanan desktop / atas mobile.
- **Admin grid dinamis:** karena jumlah lapangan & jam operasional bersifat configurable (ADR 0004), grid tidak boleh layout statis — kolom baris mengikuti konfigurasi lapangan/jam.
- Margin halaman: 16px mobile, 24px desktop — konten terpusat maksimal 1200px.

---

## 6. Motion, Feedback & Accessibility

- **Feedback setiap aksi** (prinsip UX `02-user-journey.md` §1): perubahan warna grid, status tombol, konfirmasi sukses; transisi ≤ 200ms, tidak berlebihan (fokus kecepatan).
- Slot yang dikunci real-time saat dipilih orang lain: animasi subtle + pesan "slot telah terisi" (skenario gagal `02-user-journey.md` §2) sambil **tetap menyimpan pilihan kosong lain**.
- **Timer yang terlihat** untuk `Menunggu Pembayaran` (QRIS ekspirasi) dan countdown OTP.
- **Aksesibilitas:** status slot tidak hanya dibedakan warna — tambahkan ikon/label (mis. label silang untuk `Maintenance`); kontras WCAG AA; target sentuh ≥ 44px; fokus keyboard terlihat.
- Reduksi gerakan dihormati (`prefers-reduced-motion`).

---

## 7. Design Decisions Status

| Area | Status | Sumber Referensi |
|---|---|---|
| Status slot (4 status + peran warna) | **Dikunci (fungsi)** | `02-user-journey.md` §6, `05-glossary.md` |
| Prinsip UX (3 klik, 1 sumber kebenaran, feedback) | **Dikunci** | `02-user-journey.md` §1 |
| Nama & nilai hex palette, tipografi, komponen, layout, motion | **Diadopsi (implementasi)** | `src/app/globals.css` — diturunkan dari desain sistem Stitch |
| Stack teknis (font, implementasi CSS/Tailwind, dsb.) | **Dikunci** | `04-PRD.md` §4 + `06-adr/0005-tech-stack-nextjs-drizzle.md` |

### 7.1 Catatan Implementasi (v0.3)

- Token warna & skala tipografi (`--text-display` … `--text-data-tabular`) didefinisikan di `src/app/globals.css` via `@theme inline` Tailwind v4.
- Nama merek pada antarmuka: **PadelClub** (desain sumber memakai nama lain, disamakan).
- Skala spasi desain dipetakan ke spacing Tailwind standar (mis. `space-lg` → `p-4`, `space-2xl` → `p-8`); token spacing kustom tidak ditambahkan.
- Ikon memakai Material Symbols (`MIcon`), bukan set ikon lama.

---

*Kembali ke: [README](README.md) · Lihat status slot resmi: [02 — User Journey §6](02-user-journey.md#6-matriks-status-slot-dipakai-konsisten-di-seluruh-dokumen)*