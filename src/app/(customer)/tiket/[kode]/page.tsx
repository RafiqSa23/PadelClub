"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button, ButtonLink } from "@/components/ui/Button";
import { QRBox } from "@/components/ui/QRBox";
import { MIcon } from "@/components/ui/MIcon";
import {
  IconAlert,
  IconCalendar,
  IconCheckCircle,
  IconChat,
  IconCopy,
  IconDownload,
  IconInfo,
  IconMapPin,
} from "@/components/ui/icons";
import { ASSETS } from "@/lib/assets";
import { dateLabel, formatRupiah, hourLabel } from "@/lib/format";
import type { BookingStatus } from "@/lib/types";

interface Ticket {
  code: string;
  courtId: number;
  courtName: string | null;
  description: string | null;
  isIndoor: boolean | null;
  date: string;
  hours: number[];
  status: BookingStatus;
  subtotal: number;
  customerName: string | null;
  customerPhone: string | null;
  paymentStatus: string | null;
  paidAt: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  closureNotice: string | null;
}

const HOTLINE = "+62 811-2345-7890";

function gcalUrl(opts: {
  title: string;
  details: string;
  start: Date;
  end: Date;
}) {
  const stamp = (date: Date) =>
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${stamp(opts.start)}/${stamp(opts.end)}`,
    details: opts.details,
    location: "PadelClub Arena Cilandak, Jl. TB Simatupang No. 18, Jakarta Selatan",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const FACILITIES = [
  { icon: "sports_baseball", title: "Bola Padel", note: "Siap main" },
  { icon: "light", title: "Lampu 1000 Lux", note: "Anti silau LED" },
  { icon: "lock", title: "Loker", note: "Kunci ganti" },
  { icon: "shower", title: "Ruang Bilas", note: "Air panas / handuk" },
];

export default function TicketPage() {
  const params = useParams<{ kode: string }>();
  const code = params.kode;
  const [ticket, setTicket] = useState<Ticket | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/tickets/${encodeURIComponent(code)}`);
        const json = (await res.json()) as {
          ok: boolean;
          message?: string;
          ticket?: Ticket;
        };
        if (cancelled) return;
        if (!json.ok || !json.ticket) {
          if (res.status === 404) {
            setTicket(null);
          } else {
            setLoadError(json.message ?? "Gagal memuat tiket.");
          }
          return;
        }
        setTicket(json.ticket);
      } catch {
        if (!cancelled) setLoadError("Tidak dapat terhubung ke server.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (ticket === undefined) {
    if (loadError) {
      return (
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-light text-danger">
            <IconAlert size={28} />
          </span>
          <div>
            <h1 className="text-headline-md text-on-surface">Tiket gagal dimuat</h1>
            <p className="mt-1.5 text-body-md text-slate-whisper">{loadError}</p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <ButtonLink href={`/tiket/${code}`} fullWidth size="lg">
              Coba lagi
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" fullWidth>
              Kembali ke beranda
            </ButtonLink>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <div className="h-7 w-52 animate-pulse rounded-xl bg-field-white shadow-sm" />
        <div className="mt-6 rounded-2xl bg-field-white p-6 shadow-sm">
          <div className="h-48 animate-pulse rounded-xl bg-mist-shadow" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-light text-danger">
          <IconAlert size={28} />
        </span>
        <div>
          <h1 className="text-headline-md text-on-surface">Tiket tidak ditemukan</h1>
          <p className="mt-1.5 text-body-md text-slate-whisper">
            Tidak ada tiket dengan kode &quot;{code}&quot;. Periksa kembali kode atau tautan yang
            Anda terima.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <ButtonLink href="/tiket" fullWidth size="lg">
            Cek kode lain
          </ButtonLink>
          <ButtonLink href="/" variant="secondary" fullWidth>
            Kembali ke beranda
          </ButtonLink>
        </div>
      </div>
    );
  }

  const booking = ticket;
  const court = {
    name: ticket.courtName ?? "Lapangan",
    description: ticket.description ?? "",
    isIndoor: ticket.isIndoor ?? false,
  };
  const startHour = Math.min(...booking.hours);
  const endHour = Math.max(...booking.hours) + 1;
  const paid = booking.paymentStatus === "paid" && booking.status === "terkonfirmasi";
  const cancelled = booking.status === "dibatalkan";
  const checkedIn = booking.checkedInAt !== null;

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `Tiket PadelClub\nKode: ${booking.code}\n${court?.name}\n${dateLabel(booking.date)} ${hourLabel(startHour, endHour)}`,
  )}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      setLinkCopied(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(booking!.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const hero = cancelled
    ? {
        icon: "block",
        tone: "bg-danger-light text-danger",
        badgeTone: "bg-danger-light text-danger",
        badge: "Booking Dibatalkan",
        title: "Booking Ini Sudah Dibatalkan",
        desc: `Slot ${dateLabel(booking.date)} ${hourLabel(startHour, endHour)} sudah dibebaskan. Hubungi kami bila ingin mengatur ulang.`,
      }
    : paid
      ? {
          icon: "check_circle",
          tone: "bg-court-grass-light text-court-green-deep",
          badgeTone: "bg-court-grass-light text-court-green-deep",
          badge: "Booking Sah & Instan Terkonfirmasi",
          title: "Pembayaran Terverifikasi & Slot Terkunci",
          desc: "Transaksi otomatis terverifikasi sistem pada",
        }
      : {
          icon: "schedule",
          tone: "bg-pending-light text-pending-ink",
          badgeTone: "bg-pending-light text-pending-ink",
          badge: "Menunggu Pembayaran",
          title: "Selesaikan Pembayaran Untuk Mengunci Slot",
          desc: "Booking Anda ditahan sementara. Jika tidak dibayar dalam 15 menit, slot dibuka kembali.",
        };

  const calendarUrl = gcalUrl({
    title: `PadelClub — ${court?.name}`,
    details: `Kode booking ${booking.code}. Pemesan: ${booking.customerName}.`,
    start: new Date(`${booking.date}T${String(startHour).padStart(2, "0")}:00:00`),
    end: new Date(`${booking.date}T${String(endHour).padStart(2, "0")}:00:00`),
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {/* Hero konfirmasi */}
      <section className="relative overflow-hidden rounded-2xl bg-field-white p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-court-grass-light/60 blur-2xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:items-center">
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-sm ${hero.tone}`}
            >
              <MIcon name={hero.icon} className="text-[32px]" />
            </span>
            <div className="min-w-0">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-label-sm uppercase tracking-wider ${hero.badgeTone}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                {hero.badge}
              </span>
              <h1 className="mt-2 text-headline-lg text-on-surface sm:text-display-mobile">
                {hero.title}
              </h1>
              <p className="mt-1 text-body-md text-slate-whisper">
                {hero.desc}{" "}
                {paid && ticket.paidAt && (
                  <span className="font-medium tabular-nums text-on-surface">
                    {dateLabel(booking.date)}, {hourLabel(startHour, endHour)} · terverifikasi pada{" "}
                    {new Date(ticket.paidAt).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    WIB
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-mist-shadow px-4 text-label-md text-on-surface transition-colors hover:bg-surface-variant"
            >
              <IconCopy size={18} />
              {linkCopied ? "Link Disalin!" : "Bagikan Tiket"}
            </button>
            <ButtonLink href="/booking" size="lg" icon={<MIcon name="sports_tennis" className="text-[18px]" />}>
              Booking Lagi
            </ButtonLink>
          </div>
        </div>
      </section>

      {cancelled && (
        <div
          className="flex items-start gap-2 rounded-xl bg-danger-light p-4 text-body-md font-semibold text-danger"
          role="alert"
        >
          <IconAlert size={18} className="mt-0.5 shrink-0" />
          Booking ini telah dibatalkan dan slot sudah tidak berlaku.
        </div>
      )}

      {ticket.closureNotice && !cancelled && (
        <div
          className="flex items-start gap-2 rounded-xl bg-pending-light p-4 text-body-md font-semibold text-pending-ink"
          role="alert"
        >
          <IconAlert size={18} className="mt-0.5 shrink-0" />
          {ticket.closureNotice}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Kiri: boarding pass */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          <article className="overflow-hidden rounded-xl bg-field-white shadow-md">
            <div className="h-2.5 w-full bg-gradient-to-r from-primary-container via-court-green-deep to-primary-container" />

            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-court-grass-light px-2 py-1 text-label-sm font-bold uppercase tracking-widest text-court-green-deep">
                    E-Ticket Resmi
                  </span>
                  <span className="text-slate-whisper">•</span>
                  <span className="text-data-tabular text-slate-whisper">PadelClub Verified Venue</span>
                </div>
                <div className="text-right">
                  <span className="block text-label-sm text-slate-whisper">Kode Booking</span>
                  <span className="text-headline-sm tracking-wider text-court-green-deep">
                    #{booking.code}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4 rounded-xl bg-mist-shadow p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="text-label-sm font-bold uppercase tracking-wide text-court-green-deep">
                    Arena Terpilih
                  </span>
                  <h3 className="mt-1 text-headline-md text-on-surface">{court?.name}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-body-sm text-slate-whisper">
                    <MIcon name="crop_free" className="text-[16px] text-court-green-deep" />
                    {court?.description} · {court?.isIndoor ? "Indoor" : "Outdoor"}
                  </p>
                </div>
                <div className="inline-flex shrink-0 flex-col rounded-lg bg-field-white px-4 py-3 shadow-sm sm:items-end">
                  <span className="text-label-sm text-slate-whisper">Durasi Game</span>
                  <span className="text-label-lg font-bold tabular-nums text-on-surface">
                    {booking.hours.length} Jam Penuh
                  </span>
                </div>
              </div>
            </div>

            {/* Garis perforasi */}
            <div className="relative flex items-center justify-between bg-field-white px-1">
              <div className="-ml-3 h-6 w-6 rounded-full bg-mist-shadow shadow-inner" />
              <div className="mx-2 flex-1 border-b-2 border-dashed border-slate-whisper/20" />
              <div className="-mr-3 h-6 w-6 rounded-full bg-mist-shadow shadow-inner" />
            </div>

            {/* QR + metadata */}
            <div className="flex flex-col items-center gap-6 p-5 sm:p-6 md:flex-row">
              <div className="flex w-full shrink-0 flex-col items-center gap-3 self-start bg-surface-container-low p-4 shadow-sm sm:w-auto sm:self-auto">
                <div className="rounded-lg bg-field-white p-3 shadow-sm">
                  <QRBox text={booking.code} size={176} />
                  <div className="mt-2 flex justify-center">
                    <span className="rounded bg-primary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-field-white">
                      Gate Pass
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <span className="block text-label-md font-bold tracking-widest text-on-surface">
                    TICKET #{booking.code}
                  </span>
                  <p className="mx-auto mt-1 max-w-[200px] text-body-sm leading-tight text-slate-whisper">
                    Tunjukkan ke resepsionis atau scanner gate lapangan.
                  </p>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-mist-shadow p-3">
                    <span className="block text-label-sm text-slate-whisper">Hari &amp; Tanggal</span>
                    <span className="mt-1 block text-label-lg text-on-surface">
                      {dateLabel(booking.date)}
                    </span>
                    <span className="text-label-sm text-court-green-deep">Jadwal Terjadwal</span>
                  </div>
                  <div className="rounded-lg bg-mist-shadow p-3">
                    <span className="block text-label-sm text-slate-whisper">Jam Pertandingan</span>
                    <span className="mt-1 block text-headline-sm tabular-nums text-court-green-deep">
                      {hourLabel(startHour, endHour).replace(" WIB", "")}
                    </span>
                    <span className="text-label-sm text-slate-whisper">WIB</span>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-lg bg-surface-container-low p-3">
                  <div className="flex justify-between gap-3 text-body-sm">
                    <span className="text-slate-whisper">Nama Pemesan</span>
                    <span className="text-label-md text-on-surface">{booking.customerName}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-body-sm">
                    <span className="text-slate-whisper">No. WhatsApp</span>
                    <span className="tabular-nums text-on-surface">
                      {booking.customerPhone ? `+${booking.customerPhone}` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-body-sm">
                    <span className="text-slate-whisper">Metode Bayar</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-label-sm ${
                        paid
                          ? "bg-court-grass-light font-semibold text-court-green-deep"
                          : "bg-pending-light font-semibold text-pending-ink"
                      }`}
                    >
                      {paid ? "QRIS INSTANT LUNAS" : "QRIS BELUM DIBAYAR"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 pt-1.5">
                    <span className="text-label-md text-slate-whisper">Total Dibayar</span>
                    <span className="text-headline-sm tabular-nums text-court-green-deep">
                      {formatRupiah(booking.subtotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fasilitas */}
            <div className="bg-surface-container-low p-5 sm:p-6">
              <h4 className="mb-3 text-label-sm uppercase tracking-wider text-slate-whisper">
                Fasilitas termasuk dalam reservasi:
              </h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FACILITIES.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center gap-2 rounded-lg bg-field-white p-2 shadow-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-court-grass-light">
                      <MIcon name={item.icon} className="text-[18px] text-court-green-deep" />
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-label-sm text-on-surface">
                        {item.title}
                      </span>
                      <span className="truncate text-[11px] text-slate-whisper">{item.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          {/* Tindakan e-ticket */}
          <div className="rounded-xl bg-field-white p-5 shadow-sm">
            <span className="mb-3 block text-label-sm font-semibold uppercase tracking-wider text-slate-whisper">
              Tindakan E-Ticket
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-mist-shadow px-4 text-label-md text-on-surface transition-all hover:bg-surface-variant"
              >
                <IconDownload size={20} className="text-court-green-deep" />
                Unduh E-Ticket
              </button>
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-court-grass-light px-4 text-label-md text-court-green-deep transition-all hover:bg-court-green-deep hover:text-field-white"
              >
                <IconChat size={20} />
                Kirim ke WhatsApp
              </a>
              <a
                href={calendarUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-mist-shadow px-4 text-label-md text-on-surface transition-all hover:bg-surface-variant"
              >
                <IconCalendar size={20} className="text-secondary" />
                Google Calendar
              </a>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {checkedIn ? (
                <span className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-court-grass-light py-3 text-label-lg font-bold text-court-green-deep">
                  <IconCheckCircle size={18} /> Sudah check-in
                  {ticket.checkedInAt && (
                    <span className="font-medium tabular-nums">
                      ·{" "}
                      {new Date(ticket.checkedInAt).toLocaleString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </span>
              ) : (
                booking.status === "terkonfirmasi" && (
                  <span className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-mist-shadow py-3 text-label-md text-slate-whisper">
                    <IconInfo size={16} /> Tunjukkan tiket ke resepsionis untuk check-in
                  </span>
                )
              )}
              <Button variant="secondary" onClick={copyCode} icon={copied ? <IconCheckCircle size={16} /> : <IconCopy size={16} />}>
                {copied ? "Kode tersalin" : "Salin kode"}
              </Button>
            </div>

            <p className="mt-3 flex items-start gap-2 rounded-xl bg-mist-shadow px-3 py-2.5 text-body-sm text-slate-whisper">
              <IconInfo size={14} className="mt-0.5 shrink-0" /> Tiket bisa dibuka tanpa login. Untuk
              akses riwayat, <Link href="/login" className="font-semibold text-court-green-deep hover:underline">masuk</Link>.
            </p>
          </div>
        </div>

        {/* Kanan: panduan, lokasi */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          <div className="rounded-xl bg-field-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-court-grass-light">
                <MIcon name="info" className="text-[22px] text-court-green-deep" />
              </span>
              <div>
                <h3 className="text-headline-sm text-on-surface">Panduan Kedatangan</h3>
                <p className="text-body-sm text-slate-whisper">Prosedur check-in tanpa antre</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                {
                  title: "Hadir 15 Menit Lebih Awal",
                  body: `Datang pukul ${String(Math.max(startHour - 1, 0)).padStart(2, "0")}:45 WIB untuk pemanasan dan pergantian sepatu padel.`,
                },
                {
                  title: "Scan Tiket di Resepsionis",
                  body: `Tunjukkan QR tiket atau kode ${booking.code} — check-in tercatat langsung oleh sistem.`,
                },
                {
                  title: "Sewa Raket di Lobi",
                  body: "Butuh raket atau bola tambahan? Tersedia sewa raket di pro-shop lobi utama.",
                },
              ].map((item, index) => (
                <div key={item.title} className="flex items-start gap-3 rounded-lg bg-surface-container-low p-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-court-green-deep text-label-sm tabular-nums text-field-white">
                    {index + 1}
                  </span>
                  <div>
                    <h5 className="text-label-md text-on-surface">{item.title}</h5>
                    <p className="mt-0.5 text-body-sm leading-relaxed text-slate-whisper">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-pending-light/70 p-3">
              <MIcon name="timer" className="mt-0.5 shrink-0 text-[20px] text-pending-ink" />
              <span className="text-body-sm text-on-surface">
                Pembatalan atau reschedule bebas biaya dilayani maksimal 6 jam sebelum sesi
                dimulai.
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-field-white p-5 shadow-sm sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-headline-sm text-on-surface">Lokasi &amp; Titik Parkir</h4>
                <p className="text-body-sm text-slate-whisper">PadelClub Arena Cilandak</p>
              </div>
              <a
                href="https://maps.google.com/?q=Jl.+TB+Simatupang+No.+18+Cilandak+Jakarta+Selatan"
                target="_blank"
                rel="noreferrer"
                aria-label="Buka rute di Google Maps"
                className="rounded-lg bg-mist-shadow p-2.5 text-court-green-deep transition-colors hover:bg-court-grass-light"
              >
                <MIcon name="route" className="text-[20px]" />
              </a>
            </div>
            <div className="relative h-44 overflow-hidden rounded-lg bg-mist-shadow">
              <Image
                src={ASSETS.mapTicket}
                alt="Peta lokasi PadelClub Arena Cilandak"
                width={1200}
                height={800}
                unoptimized
                className="h-full w-full object-cover transition-transform duration-500"
              />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-on-surface/80 to-transparent p-3">
                <div className="flex items-center gap-1.5 text-label-md text-field-white">
                  <IconMapPin size={16} className="text-court-grass-light" />
                  <span>PadelClub Arena, South Jakarta</span>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-body-sm">
              <div className="flex items-start gap-2">
                <MIcon name="local_parking" className="mt-0.5 shrink-0 text-[18px] text-slate-whisper" />
                <p className="text-slate-whisper">
                  <strong className="text-on-surface">Parkir khusus pemain:</strong> Gratis parkir
                  mobil &amp; motor dengan menunjukkan QR tiket ke pos satpam.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <MIcon name="call" className="mt-0.5 shrink-0 text-[18px] text-slate-whisper" />
                <p className="text-slate-whisper">
                  Resepsionis Arena:{" "}
                  <span className="font-semibold tabular-nums text-on-surface">{HOTLINE}</span>{" "}
                  (standby hingga 23:30)
                </p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-court-green-deep p-5 text-field-white shadow-sm">
            <div className="relative z-10 space-y-1.5">
              <span className="rounded bg-primary-container px-2 py-0.5 text-label-sm uppercase tracking-wider">
                Perlengkapan {court?.name}
              </span>
              <h4 className="text-headline-sm">{court?.description}</h4>
              <p className="text-body-sm leading-relaxed text-field-white/80">
                Lapangan {court?.isIndoor ? "indoor dengan pencahayaan penuh" : "outdoor"} siap
                dipakai sesuai jadwal Anda. Laporkan kendala operasional ke resepsionis untuk
                ditangani segera.
              </p>
            </div>
            <div className="absolute -bottom-6 -right-6 h-32 w-32 rounded-full bg-field-white/10 blur-xl" />
          </div>
        </div>
      </div>

      {/* Strip jaminan */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-xl bg-surface-container p-4 text-body-sm text-slate-whisper sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <MIcon name="verified_user" className="shrink-0 text-[20px] text-court-green-deep" />
          <span>
            Jaminan lapangan 100% siap main. Jika ada kendala operasional, garansi refund 100%
            instan.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-label-sm">
          <span className="text-on-surface font-semibold">Butuh bantuan segera?</span>
          <a
            href={`https://wa.me/${HOTLINE.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-court-green-deep hover:underline"
          >
            WhatsApp Center <MIcon name="open_in_new" className="text-[14px]" />
          </a>
        </div>
      </div>
    </div>
  );
}
