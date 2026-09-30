"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ASSETS } from "@/lib/assets";
import { COURTS, generateDaySlots } from "@/lib/mock";
import { dateLabel, formatRupiah, todayString } from "@/lib/format";
import { MIcon } from "@/components/ui/MIcon";
import { cn } from "@/lib/cn";

const IMAGES = [ASSETS.courtPanoramico, ASSETS.courtOutdoor, ASSETS.courtIndoor];

function periodLabel(hour: number) {
  if (hour < 12) return "Pagi";
  if (hour < 17) return "Siang";
  if (hour < 21) return "Prime";
  return "Late";
}

const FEATURES = [
  {
    icon: "payments",
    tile: "bg-court-grass-light text-court-green-deep",
    accent: "text-primary-container",
    title: "Transparansi Harga Tanpa Biaya Tersembunyi",
    body: "Harga per jam sudah termasuk penerangan 1000 Lux LED, bola baru Babolat Court, dan akses shower locker air panas. Tanpa biaya admin tambahan saat checkout.",
    link: "Lihat Rincian Biaya",
    linkIcon: "north_east",
  },
  {
    icon: "qr_code_scanner",
    tile: "bg-secondary-container/20 text-secondary",
    accent: "text-secondary",
    title: "Konfirmasi Otomatis QRIS Waktu Nyata",
    body: "Sistem verifikasi gateway pembayaran otomatis membuka slot Anda dalam waktu 5 detik. Tiket digital instan dikirim ke WhatsApp dan email terdaftar Anda.",
    link: "Didukung Semua Bank & E-Wallet",
    linkIcon: "bolt",
  },
  {
    icon: "sports_score",
    tile: "bg-primary-fixed text-on-primary-fixed",
    accent: "text-primary-container",
    title: "Lampu LED Standar Turnamen & Raket Sewa Pro",
    body: "Main malam hari tanpa bayangan silang berkat 8 titik floodlight 1000 Lux. Tersedia sewa raket Wilson Bela Pro, Bullpadel Vertex, dan Nox AT10 di pro-shop lapangan.",
    link: "Sertifikasi WPT Court",
    linkIcon: "verified",
  },
];

const TESTIMONIALS = [
  {
    initial: "R",
    quote:
      "Proses bookingnya benar-benar cuma 2 menit. Tinggal scan QRIS dari BCA Mobile, tiket langsung masuk WA. Lapangan Panoramico-nya terbaik di Jakarta Selatan!",
    name: "Reza Mahardika",
    role: "Pemain Amatir • South Padel Club",
  },
  {
    initial: "F",
    quote:
      "Pencahayaan LED 1000 Lux tidak menyilaukan saat smash bola atas (bandeja). Loker mandi bersih dan kafe kopinya sangat nyaman untuk nongkrong sehabis tanding.",
    name: "Felicia Santoso",
    role: "Padel Enthusiast • Kemang Group",
  },
];

const PERKS = [
  { icon: "local_parking", label: "Parkir Luas (30 Mobil)" },
  { icon: "shower", label: "Locker Room & Shower" },
  { icon: "local_cafe", label: "Pro-Shop & Cafe" },
  { icon: "wifi", label: "Free Highspeed Wi-Fi" },
];

export default function HomePage() {
  const today = todayString();
  const slots = generateDaySlots(today);
  const activeCourts = COURTS.filter((court) => court.isActive);
  const availableCount = slots.filter((slot) => slot.status === "kosong").length;

  const [dayOffset, setDayOffset] = useState(0);
  const [zone, setZone] = useState<"pagi" | "siang" | "malam">("malam");

  const featured = activeCourts.slice(0, 3).map((court, index) => {
    const courtSlots = slots.filter((slot) => slot.courtId === court.id);
    return {
      court,
      image: IMAGES[index % IMAGES.length],
      kosong: courtSlots.filter((slot) => slot.status === "kosong").slice(0, 3),
      terkonfirmasi: courtSlots.filter((slot) => slot.status === "terkonfirmasi").slice(0, 2),
      menunggu: courtSlots.filter((slot) => slot.status === "menunggu_pembayaran").slice(0, 1),
    };
  });

  const statusPanel = activeCourts.slice(0, 4).map((court) => {
    const kosong = slots
      .filter((slot) => slot.courtId === court.id && slot.status === "kosong")
      .slice(0, 3);
    const held = slots.find(
      (slot) => slot.courtId === court.id && slot.status === "menunggu_pembayaran",
    );
    return { court, kosong, held };
  });

  return (
    <div className="flex flex-col">
      {/* Hero + Quick Slot Picker */}
      <section className="relative w-full overflow-hidden bg-field-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-court-grass-light/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-primary-fixed-dim/20 blur-2xl" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 pt-10 sm:px-6">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-7">
              <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-court-grass-light px-3 py-1.5 text-label-sm text-court-green-deep">
                <span className="h-2.5 w-2.5 rounded-full bg-primary-container animate-ping" />
                <span className="uppercase tracking-wider">Garansi Kecepatan Booking</span>
                <span className="text-slate-whisper">•</span>
                <span className="text-data-tabular">3 Klik &amp; 2 Menit</span>
              </div>

              <h1 className="text-balance text-display-mobile text-on-surface sm:text-display">
                Sewa Lapangan Padel Cepat &amp; Tanpa Friksi —{" "}
                <span className="text-primary-container">3 Klik &amp; 2 Menit</span>
              </h1>

              <p className="max-w-xl text-balance text-body-lg text-slate-whisper">
                Pilih jam, verifikasi instan, konfirmasi real-time dengan standar internasional
                WPT. Nikmati rumput sintetis monofilamen dan pencahayaan LED 1000 Lux bebas silau.
              </p>

              <div className="flex flex-wrap items-center gap-6 pt-2 text-on-surface">
                <div className="flex flex-col">
                  <span className="text-headline-lg text-court-green-deep">
                    {activeCourts.length} Lapangan
                  </span>
                  <span className="text-label-sm text-slate-whisper">Standar WPT Premium</span>
                </div>
                <span className="h-8 w-px bg-outline-variant/30" />
                <div className="flex flex-col">
                  <span className="text-headline-lg text-primary-container">&lt; 15 Detik</span>
                  <span className="text-label-sm text-slate-whisper">Verifikasi QRIS Instan</span>
                </div>
                <span className="h-8 w-px bg-outline-variant/30" />
                <div className="flex flex-col">
                  <span className="text-headline-lg text-secondary">100%</span>
                  <span className="text-label-sm text-slate-whisper">Jadwal Real-Time Akurat</span>
                </div>
              </div>
            </div>

            <div className="relative lg:col-span-5">
              <div className="relative overflow-hidden rounded-2xl bg-surface-container shadow-xl">
                <Image
                  src={ASSETS.heroCourt}
                  alt="Lapangan padel indoor dengan pencahayaan LED 1000 Lux"
                  width={1600}
                  height={900}
                  unoptimized
                  className="h-72 w-full object-cover lg:h-[380px]"
                />
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-on-surface/80 via-transparent to-transparent p-4 text-field-white">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <span className="rounded bg-primary-container/90 px-2 py-0.5 text-label-sm text-field-white">
                        {featured[0]?.court.name ?? "Lapangan 1"}
                      </span>
                      <p className="mt-1 text-headline-sm text-field-white">
                        Kaca Bebas Pilar Turnamen
                      </p>
                    </div>
                    <div className="rounded-lg bg-field-white/20 px-2 py-1.5 text-right backdrop-blur-md">
                      <span className="block text-label-sm text-court-grass-light">
                        Kondisi Lapangan
                      </span>
                      <span className="text-data-tabular text-field-white">Optimal 24°C</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Slot Picker */}
          <div className="mt-6 rounded-2xl bg-field-white p-4 shadow-md ring-1 ring-line/70">
            <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-12">
              <div className="space-y-1 lg:col-span-3">
                <span className="flex items-center gap-2 text-label-md text-on-surface">
                  <MIcon name="calendar_today" className="text-[18px] text-primary-container" />
                  Pilih Tanggal
                </span>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-mist-shadow p-1">
                  {[
                    { value: 0, label: `Hari Ini, ${dateLabel(today)}` },
                    { value: 1, label: "Besok" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDayOffset(option.value)}
                      className={cn(
                        "min-h-9 rounded-lg px-2 py-1 text-center text-label-md transition-all",
                        dayOffset === option.value
                          ? "bg-field-white text-primary-container shadow-sm"
                          : "text-slate-whisper hover:text-on-surface",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 lg:col-span-3">
                <label
                  htmlFor="landing-court-type"
                  className="flex items-center gap-2 text-label-md text-on-surface"
                >
                  <MIcon name="sports_tennis" className="text-[18px] text-primary-container" />
                  Tipe Lapangan
                </label>
                <select
                  id="landing-court-type"
                  defaultValue="all"
                  className="h-11 w-full rounded-xl bg-mist-shadow px-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
                >
                  <option value="all">Semua Lapangan ({activeCourts.length} Unit)</option>
                  {activeCourts.map((court) => (
                    <option key={court.id} value={String(court.id)}>
                      {court.name} — {court.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 lg:col-span-3">
                <span className="flex items-center gap-2 text-label-md text-on-surface">
                  <MIcon name="schedule" className="text-[18px] text-primary-container" />
                  Zona Waktu Favorit
                </span>
                <div className="flex items-center gap-1">
                  {(
                    [
                      { value: "pagi", label: "Pagi (06-12)" },
                      { value: "siang", label: "Siang (12-17)" },
                      { value: "malam", label: "Malam Prime" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setZone(option.value)}
                      className={cn(
                        "h-11 flex-1 rounded-xl px-1 text-center text-label-sm transition-all",
                        zone === option.value
                          ? "bg-court-grass-light font-semibold text-court-green-deep"
                          : "bg-mist-shadow text-slate-whisper hover:bg-court-grass-light hover:text-court-green-deep",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-3">
                <Link
                  href="/booking"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-container text-label-lg text-field-white shadow-md transition-all hover:bg-court-green-deep"
                >
                  <MIcon name="search" className="text-[20px]" />
                  Cari Jadwal Lapangan
                </Link>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mist-shadow/70 p-3">
              <span className="text-label-sm text-slate-whisper">Status Slot Real-Time:</span>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {[
                  { dot: "bg-court-grass-light border border-primary-container/40", label: "Tersedia (Book Sekarang)" },
                  { dot: "bg-confirmed-blue", label: "Terkonfirmasi" },
                  { dot: "bg-pending-amber", label: "Menunggu Pembayaran (3 Menit)" },
                  { dot: "bg-closure-grey", label: "Maintenance / Tutup" },
                ].map((item) => (
                  <span key={item.label} className="flex items-center gap-2 text-label-sm text-on-surface">
                    <span className={cn("h-3.5 w-3.5 rounded", item.dot)} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ketersediaan slot hari ini */}
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2 text-label-sm text-primary-container">
              <MIcon name="sensors" className="text-[16px]" />
              <span className="uppercase tracking-wider">Sinkronisasi Sistem Real-Time</span>
            </div>
            <h2 className="mt-2 text-headline-lg text-on-surface">
              Ketersediaan Slot Hari Ini ({dateLabel(today)})
            </h2>
            <p className="mt-1 text-body-md text-slate-whisper">
              {availableCount} slot masih kosong. Klik slot jam kosong untuk langsung memulai
              reservasi instan.
            </p>
          </div>
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 text-label-lg text-primary-container hover:underline"
          >
            Buka Matriks Slot Lengkap
            <MIcon name="arrow_forward" className="text-[20px]" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {featured.map((item) => (
            <article
              key={item.court.id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl bg-field-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div>
                <div className="relative h-44 w-full">
                  <Image
                    src={item.image}
                    alt={`Lapangan ${item.court.name}`}
                    width={1200}
                    height={800}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-primary-container px-2 py-1 text-label-sm text-field-white">
                    {item.court.name} • {item.court.isIndoor ? "Indoor" : "Outdoor"}
                  </span>
                  <span className="absolute bottom-2 right-2 rounded-lg bg-on-surface/85 px-2 py-1 text-label-sm text-field-white backdrop-blur-sm">
                    {formatRupiah(item.court.hourlyPrice)} / jam
                  </span>
                </div>

                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2 text-body-sm text-slate-whisper">
                    <span className="flex items-center gap-1.5">
                      <MIcon
                        name={item.court.isIndoor ? "ac_unit" : "wb_sunny"}
                        className="text-[16px] text-court-green-deep"
                      />
                      {item.court.description}
                    </span>
                    <span>1000 Lux LED</span>
                  </div>

                  <p className="mb-2 uppercase tracking-wide text-label-sm text-slate-whisper">
                    Slot Kosong Hari Ini:
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {item.kosong.length === 0 && (
                      <span className="col-span-3 rounded-lg bg-mist-shadow p-2 text-center text-label-sm text-slate-whisper">
                        Semua slot terisi
                      </span>
                    )}
                    {item.kosong.map((slot) => (
                      <Link
                        key={`${slot.courtId}-${slot.hour}`}
                        href="/booking"
                        className="flex flex-col items-center justify-center rounded-lg bg-court-grass-light py-2 text-data-tabular text-court-green-deep shadow-sm transition-colors hover:bg-primary-container hover:text-field-white"
                      >
                        <span>{String(slot.hour).padStart(2, "0")}:00</span>
                        <span className="text-[11px] opacity-80">{periodLabel(slot.hour)}</span>
                      </Link>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-mist-shadow/50 p-1.5 text-label-sm text-slate-whisper">
                    {item.terkonfirmasi.map((slot) => (
                      <span key={`${slot.courtId}-${slot.hour}`} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-confirmed-blue" />
                        {String(slot.hour).padStart(2, "0")}:00 Booked
                      </span>
                    ))}
                    {item.menunggu.map((slot) => (
                      <span key={`${slot.courtId}-${slot.hour}`} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-pending-amber" />
                        {String(slot.hour).padStart(2, "0")}:00 Held
                      </span>
                    ))}
                    {item.terkonfirmasi.length === 0 && item.menunggu.length === 0 && (
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-closure-grey" />
                        Slot penuh hari ini
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4">
                <Link
                  href="/booking"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-court-grass-light py-2.5 text-label-md text-court-green-deep transition-all hover:bg-primary-container hover:text-field-white"
                >
                  Pilih Slot {item.court.name}
                  <MIcon name="chevron_right" className="text-[16px]" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Keunggulan */}
      <section className="w-full bg-field-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto mb-8 max-w-2xl space-y-2 text-center">
            <span className="inline-block rounded-full bg-court-grass-light px-3 py-1.5 uppercase tracking-wider text-label-sm text-court-green-deep">
              Keunggulan PadelClub
            </span>
            <h2 className="text-headline-lg text-on-surface">
              Dirancang Khusus untuk Pemain Padel Modern
            </h2>
            <p className="text-body-md text-slate-whisper">
              Standar fasilitas atlet profesional dipadukan dengan kemudahan pemesanan digital
              tanpa kerepotan konfirmasi manual.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col justify-between rounded-2xl bg-mist-shadow/60 p-6 transition-colors hover:bg-mist-shadow"
              >
                <div className="space-y-3">
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl",
                      feature.tile,
                    )}
                  >
                    <MIcon name={feature.icon} className="text-[28px]" />
                  </span>
                  <h3 className="text-headline-sm text-on-surface">{feature.title}</h3>
                  <p className="text-body-md text-slate-whisper">{feature.body}</p>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2 pt-4 text-label-md",
                    feature.accent,
                  )}
                >
                  <span>{feature.link}</span>
                  <MIcon name={feature.linkIcon} className="text-[18px]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-court-green-deep to-primary-container p-6 text-field-white shadow-xl lg:p-8">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-auto opacity-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 400 600"
            aria-hidden="true"
          >
            <rect x="20" y="20" width="360" height="560" rx="10" />
            <line x1="20" x2="380" y1="300" y2="300" />
            <line x1="200" x2="200" y1="120" y2="480" />
            <circle cx="200" cy="300" r="40" />
          </svg>

          <div className="relative z-10 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-8">
              <span className="inline-block rounded-full bg-field-white/20 px-3 py-1.5 text-label-sm tracking-wide text-field-white">
                Cepat, Aman &amp; Terverifikasi
              </span>
              <h2 className="text-headline-lg leading-tight text-field-white">
                Ingin Main Malam Ini? Masih Ada {availableCount} Slot Kosong Tersisa
              </h2>
              <p className="max-w-xl text-body-lg text-court-grass-light">
                Booking langsung dari smartphone Anda tanpa registrasi akun yang berbelit-belit.
                Cukup nomor WhatsApp dan nama pemain.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/booking"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-field-white px-6 text-label-lg text-court-green-deep shadow-lg transition-all hover:bg-court-grass-light"
                >
                  Buka Jadwal Hari Ini
                  <MIcon name="calendar_month" className="text-[20px]" />
                </Link>
                <Link
                  href="/tiket"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-field-white/10 px-6 text-label-lg text-field-white backdrop-blur-sm transition-all hover:bg-field-white/20"
                >
                  <MIcon name="confirmation_number" className="text-[20px]" />
                  Cek E-Ticket Saya
                </Link>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-field-white/20 bg-field-white/10 p-4 backdrop-blur-md lg:col-span-4">
              <div className="flex items-center justify-between">
                <span className="text-label-md text-court-grass-light">Status Lapangan Hari Ini</span>
                <span className="rounded bg-field-white/20 px-1.5 py-0.5 text-label-sm">
                  {dateLabel(today)}
                </span>
              </div>
              <div className="space-y-2 text-body-sm">
                {statusPanel.map(({ court, kosong, held }) => (
                  <div
                    key={court.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-field-white/10 p-2"
                  >
                    <span>{court.name}</span>
                    <span
                      className={cn(
                        "font-semibold",
                        held && kosong.length === 0 ? "text-pending-amber" : "text-court-grass-light",
                      )}
                    >
                      {kosong.length > 0
                        ? `Tersedia: ${kosong
                            .map((slot) => `${String(slot.hour).padStart(2, "0")}:00`)
                            .join(", ")}`
                        : held
                          ? `Tersedia: ${String(held.hour).padStart(2, "0")}:00 (Hold)`
                          : "Penuh"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimoni + Lokasi */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <div>
              <span className="inline-block rounded-full bg-court-grass-light px-3 py-1.5 uppercase tracking-wider text-label-sm text-court-green-deep">
                Komunitas Padel Jakarta
              </span>
              <h2 className="mt-2 text-headline-lg text-on-surface">
                Dipercaya Lebih dari 1.200 Pemain Aktif
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {TESTIMONIALS.map((item) => (
                <div
                  key={item.name}
                  className="flex flex-col justify-between space-y-3 rounded-2xl bg-field-white p-4 shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center text-pending-amber">
                      {Array.from({ length: 5 }).map((_, star) => (
                        <MIcon key={star} name="star" className="text-[18px]" fill />
                      ))}
                    </div>
                    <p className="text-body-md text-on-surface">“{item.quote}”</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-court-grass-light text-headline-sm text-court-green-deep">
                      {item.initial}
                    </span>
                    <div>
                      <p className="text-label-md text-on-surface">{item.name}</p>
                      <p className="text-body-sm text-slate-whisper">{item.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-3xl bg-field-white p-6 shadow-sm lg:col-span-5">
            <div className="space-y-1">
              <span className="inline-block rounded-full bg-court-grass-light px-3 py-1.5 uppercase tracking-wider text-label-sm text-court-green-deep">
                Lokasi Strategis
              </span>
              <h3 className="text-headline-sm text-on-surface">PadelClub Arena Cilandak</h3>
              <p className="text-body-sm text-slate-whisper">
                Jl. TB Simatupang No. 18, Cilandak, Jakarta Selatan 12430
              </p>
            </div>

            <div
              className="relative flex h-48 items-end overflow-hidden rounded-2xl bg-cover bg-center p-4 shadow-inner"
              style={{ backgroundImage: `url('${ASSETS.mapKemang}')` }}
            >
              <div className="flex items-center gap-2 rounded-xl bg-field-white/95 px-3 py-2 shadow-sm backdrop-blur-md">
                <MIcon name="pin_drop" className="text-[20px] text-court-green-deep" />
                <span className="font-semibold text-label-sm text-on-surface">
                  5 Menit dari Jl. TB Simatupang
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-label-sm text-on-surface">
              {PERKS.map((perk) => (
                <div key={perk.label} className="flex items-center gap-2">
                  <MIcon name={perk.icon} className="text-[18px] text-court-green-deep" />
                  <span>{perk.label}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-mist-shadow pt-3">
              <a
                href="https://maps.google.com"
                rel="noopener noreferrer"
                target="_blank"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-mist-shadow py-2.5 text-label-md text-court-green-deep transition-all hover:bg-court-grass-light"
              >
                <MIcon name="directions" className="text-[18px]" />
                Petunjuk Arah Google Maps
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
