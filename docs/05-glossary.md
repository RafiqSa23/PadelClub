# 05 — Glossary (Istilah Domain)

Glossary berisi istilah yang dipakai konsisten di seluruh dokumen produk.

## A
| Istilah | Definisi |
|---|---|
| **Admin / Pemilik** | Pengguna yang mengelola lapangan (jadwal, booking, lapangan, laporan). |
| **Analytics Funnel** | Pengukuran langkah demi langkah yang dilalui pelanggan hingga menyelesaikan booking. |
| **Anonimisasi** | Penghapusan data pribadi (nama, nomor HP, email) dari baris user tanpa menghapus booking historis ([ADR 0011](06-adr/0011-user-bayangan-walkin.md)). |

## B
| Istilah | Definisi |
|---|---|
| **Booking** | Pemesanan satu atau beberapa jam di lapangan tertentu pada tanggal tertentu. |
| **Booking Hantu** | Booking yang menghalangi slot tetapi tidak kunjung dibayar (ghost booking). |
| **Booking Manual (Walk-in)** | Booking yang diinput oleh admin untuk pelanggan yang datang langsung / telepon. |

## C
| Istilah | Definisi |
|---|---|
| **Check-in** | Tanda pelanggan telah hadir dan memasuki lapangan pada jadwalnya. |
| **Customer / Pemain** | Pengguna yang memesan lapangan. |

## G
| Istilah | Definisi |
|---|---|
| **Grid Slot** | Tampilan tabel/jaringan yang memetakan lapangan (baris) vs jam (kolom). |

## I
| Istilah | Definisi |
|---|---|
| **Invoice** | Faktur pembayaran yang dibuat sistem saat booking dibuat. |

## K
| Istilah | Definisi |
|---|---|
| **Kode Booking (Tiket)** | Kode unik pada tiket untuk membuka detail booking; wajib sesi pemilik atau admin. |

## L
| Istilah | Definisi |
|---|---|
| **Lapangan (Court)** | Fasilitas padel yang dapat disewa; MVP: 5–10 lapangan dalam satu venue. |

## M
| Istilah | Definisi |
|---|---|
| **Maintenance (Tutup)** | Kondisi lapangan diblokir sengaja untuk perbaikan, tidak bisa dipesan. |
| **MVP** | Minimum Viable Product — versi pertama dengan fitur inti untuk meluncurkan produk. |

## N
| Istilah | Definisi |
|---|---|
| **Non-Goals** | Hal-hal yang secara sengaja TIDAK dikerjakan pada versi ini. |

## O
| Istilah | Definisi |
|---|---|
| **Okupansi** | Persentase slot terpakai dibandingkan slot tersedia pada suatu periode. |
| **OTP** | One-Time Password — kode sekali pakai untuk verifikasi nomor HP. **Tidak dipakai di MVP** ([ADR 0009](06-adr/0009-akun-email-password.md)). |

## P
| Istilah | Definisi |
|---|---|
| **Payment Gateway** | Penyedia layanan pembayaran yang memproses transaksi QRIS (mis. Midtrans/Xendit/Duitku). |
| **Pemandu Notifikasi** | Sistem/Penyedia pengiriman pesan WhatsApp, Email, atau SMS otomatis. **Ditunda ke v2.0** ([ADR 0010](06-adr/0010-mvp-tanpa-notifikasi.md)). |

## Q
| Istilah | Definisi |
|---|---|
| **QRIS** | Quick Response Code Indonesian Standard — standar pembayaran QR tunggal yang dapat dipindai semua e-wallet/bank di Indonesia. |

## R
| Istilah | Definisi |
|---|---|
| **Retensi 7 Hari** | Batas penyimpanan kontak user bayangan walk-in sebelum dianonimisasi otomatis ([ADR 0011](06-adr/0011-user-bayangan-walkin.md)). |

## S
| Istilah | Definisi |
|---|---|
| **Sesi (`padel_session`)** | Cookie bertanda tangan yang menyimpan `userId` setelah pemain login. |
| **Slot** | Satu unit unit waktu tersewa (1 jam) pada lapangan & tanggal tertentu. |
| **Sitemap** | Peta/struktur halaman aplikasi. |

## T
| Istilah | Definisi |
|---|---|
| **Terkonfirmasi** | Status booking yang sudah dibayar dan sah. |
| **Tiket Digital** | Bukti booking elektronik berisi kode unik & detail jadwal; diakses lewat akun atau tautan, tidak dikirim via WhatsApp/Email. |

## U
| Istilah | Definisi |
|---|---|
| **User Bayangan** | Baris user `is_guest` untuk pelanggan walk-in/telepon: nama + HP tanpa email/password; dianonimisasi setelah 7 hari tanpa booking aktif. |

## W
| Istilah | Definisi |
|---|---|
| **Webhook** | Panggilan otomatis dari payment gateway ke sistem backend saat ada pembaruan status pembayaran. |
| **Wizard Booking** | Alur checkout multi-langkah dalam satu halaman (tanggal → lapangan & jam → review → bayar). |

---

## Status Booking (Ringkasan)

| Status | Definisi Singkat |
|---|---|
| `Kosong` | Slot tersedia, bisa dipesan. |
| `Terkonfirmasi` | Sudah dibayar & sah. |
| `Menunggu Pembayaran` | Booking dibuat tetapi belum lunas (sementara memblokir slot). |
| `Tutup / Maintenance` | Slot diblokir untuk perbaikan. |
| `Batal` | Booking dibatalkan (oleh sistem karena tidak terbayar, atau admin). |
| `Check-in` | Pelanggan sudah hadir sesuai jadwal. |

---

*Kembali ke: [04 — PRD](04-PRD.md) · [README](README.md)*