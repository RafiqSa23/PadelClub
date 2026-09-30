"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { MIcon } from "@/components/ui/MIcon";
import { Toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { addDays, dateLabel, formatRupiah, hourLabel, todayString } from "@/lib/format";
import type { Court, Slot } from "@/lib/types";
import type { DaySchedule } from "@/lib/slots";

const BUCKETS = [6, 8, 10, 12, 14, 16, 18, 20, 22];

function shortName(name: string) {
  const parts = name.split(" ");
  if (parts.length === 1) return name;
  return `${parts[0]} ${parts[1][0]}.`;
}

interface Cell {
  slot: Slot | null;
  label: string;
  sub: string;
}

interface ScheduleBooking {
  id: number;
  code: string;
  courtId: number;
  status: string;
  source: string;
  subtotal: number;
  customerName: string | null;
  customerPhone: string | null;
  hours: number[];
}

interface OverviewKpi {
  omzet: number;
  occupancy: number;
  totalSlots: number;
  occupiedSlots: number;
  freeSlots: number;
  totalBookings: number;
  confirmed: number;
  waiting: number;
  cancelled: number;
  expiringCount: number;
}

interface ClosureRow {
  id: number;
  courtId: number;
  closureDate: string;
  startHour: number | null;
  endHour: number | null;
  reason: string | null;
}

export default function AdminDashboardPage() {
  const [offset, setOffset] = useState(0);
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [toast, setToast] = useState<string | undefined>();
  const [courts, setCourts] = useState<Court[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookingList, setBookingList] = useState<ScheduleBooking[]>([]);
  const [kpi, setKpi] = useState<OverviewKpi | null>(null);
  const [closures, setClosures] = useState<ClosureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const date = addDays(todayString(), offset);

  function applySchedule(
    day: string,
    json: { schedule: DaySchedule; bookings: ScheduleBooking[] },
  ) {
    setCourts(
      json.schedule.courts.map((c) => ({
        id: c.id,
        name: c.name,
        hourlyPrice: c.hourlyPrice,
        isIndoor: c.isIndoor,
        isActive: c.isActive,
        description: c.description ?? "",
      })),
    );
    setSlots(
      json.schedule.slots.map((s) => ({
        courtId: s.courtId,
        date: day,
        hour: s.hour,
        status: s.status,
        code: s.code ?? undefined,
        reason: s.reason ?? undefined,
      })),
    );
    setBookingList(json.bookings);
  }

  async function load(day: string) {
    try {
      const [schedRes, overRes] = await Promise.all([
        fetch(`/api/admin/schedule?date=${day}`, { cache: "no-store" }),
        fetch(`/api/admin/overview?date=${day}`, { cache: "no-store" }),
      ]);
      if (schedRes.status === 401 || overRes.status === 401) {
        setToast("Sesi admin berakhir. Login ulang.");
        return;
      }
      if (schedRes.ok) {
        applySchedule(
          day,
          (await schedRes.json()) as { schedule: DaySchedule; bookings: ScheduleBooking[] },
        );
      }
      if (overRes.ok) {
        const json = (await overRes.json()) as {
          kpi: OverviewKpi;
          closures: ClosureRow[];
        };
        setKpi(json.kpi);
        setClosures(json.closures);
      }
    } catch {
      setToast("Gagal memuat dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [schedRes, overRes] = await Promise.all([
          fetch(`/api/admin/schedule?date=${date}`, { cache: "no-store" }),
          fetch(`/api/admin/overview?date=${date}`, { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (schedRes.status === 401 || overRes.status === 401) {
          setToast("Sesi admin berakhir. Login ulang.");
          return;
        }
        if (schedRes.ok) {
          const json = (await schedRes.json()) as {
            schedule: DaySchedule;
            bookings: ScheduleBooking[];
          };
          if (cancelled) return;
          applySchedule(date, json);
        }
        if (overRes.ok) {
          const json = (await overRes.json()) as {
            kpi: OverviewKpi;
            closures: ClosureRow[];
          };
          if (cancelled) return;
          setKpi(json.kpi);
          setClosures(json.closures);
        }
      } catch {
        if (!cancelled) setToast("Gagal memuat dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const timer = window.setInterval(() => void load(date), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function actOnBooking(code: string, action: "confirm" | "cancel") {
    setActing(true);
    try {
      const res = await fetch(`/api/admin/bookings/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        setToast(json.message ?? "Aksi gagal.");
        return;
      }
      setActiveSlot(null);
      await load(date);
    } catch {
      setToast("Tidak dapat terhubung ke server.");
    } finally {
      setActing(false);
    }
  }

  const bookingByCode = (code?: string) =>
    code ? bookingList.find((b) => b.code === code) : undefined;

  const confirmedCount = kpi?.confirmed ?? 0;
  const pendingBookings = bookingList.filter((b) => b.status === "menunggu_pembayaran");
  const freeCount = kpi?.freeSlots ?? 0;
  const occupied = kpi?.occupiedSlots ?? 0;
  const occupancy = kpi?.occupancy ?? 0;
  const omzet = kpi?.omzet ?? 0;
  const totalSlots = kpi?.totalSlots ?? 0;

  const cellsFor = (courtId: number): Array<Cell | null> =>
    BUCKETS.map((bucket) => {
      const pair = [bucket, bucket + 1]
        .map((hour) => slots.find((slot) => slot.courtId === courtId && slot.hour === hour))
        .filter((slot): slot is Slot => Boolean(slot));
      if (pair.length === 0) return null;
      const notable =
        pair.find((slot) => slot.status === "menunggu_pembayaran") ??
        pair.find((slot) => slot.status === "terkonfirmasi") ??
        pair.find((slot) => slot.status === "tutup") ??
        pair[0];
      const court = courts.find((c) => c.id === courtId);
      if (notable.status === "kosong") {
        return {
          slot: notable,
          label: "+ Isi Manual",
          sub: formatRupiah(court?.hourlyPrice ?? 0),
        };
      }
      if (notable.status === "tutup") {
        return { slot: notable, label: notable.reason ?? "Perawatan", sub: "Maintenance" };
      }
      const booking = bookingByCode(notable.code);
      return {
        slot: notable,
        label: shortName(booking?.customerName ?? "—"),
        sub:
          notable.status === "menunggu_pembayaran"
            ? "Menunggu bayar"
            : `Lunas · ${hourLabel(Math.min(...pair.map((s) => s.hour)), Math.max(...pair.map((s) => s.hour)) + 1).replace(" WIB", "")}`,
      };
    });

  const detail = activeSlot
    ? (() => {
        const court = courts.find((c) => c.id === activeSlot.courtId);
        if (!court) return null;
        const booking = bookingByCode(activeSlot.code);
        const label =
          activeSlot.status === "terkonfirmasi"
            ? "Terkonfirmasi"
            : activeSlot.status === "menunggu_pembayaran"
              ? "Menunggu Pembayaran"
              : activeSlot.status === "tutup"
                ? "Tutup / Maintenance"
                : "Kosong";
        return {
          court,
          start: activeSlot.hour,
          end: activeSlot.hour + 1,
          label,
          reason: activeSlot.reason,
          code: activeSlot.code,
          customerName: booking?.customerName,
          customerPhone: booking?.customerPhone,
          paymentStatus: activeSlot.status === "terkonfirmasi" ? "paid" : "pending",
          amount: court.hourlyPrice,
        };
      })()
    : null;
  const todayClosures = closures;

  const cellTone = (slot: Slot) => {
    if (slot.status === "terkonfirmasi") return "bg-confirmed text-field-white";
    if (slot.status === "menunggu_pembayaran") return "bg-pending text-on-surface animate-pulse";
    if (slot.status === "tutup") return "bg-closure text-field-white";
    return "border border-primary-container/30 bg-field-white text-court-green-deep hover:bg-court-grass-light";
  };

  return (
    <AdminShell title="Dashboard">
      <div className="flex w-full flex-col gap-6">
        {/* Command header */}
        <div className="flex flex-col gap-5 rounded-2xl bg-field-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-court-grass-light text-court-green-deep shadow-sm">
              <MIcon name="sports_tennis" className="text-[28px]" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-headline-md text-on-surface">Manajemen Slot Lapangan</span>
                <span className="rounded-full bg-court-grass-light px-2.5 py-0.5 text-label-sm text-court-green-deep">
                  Live Sync ON
                </span>
              </div>
              <span className="text-body-sm text-slate-whisper">
                PadelClub Arena Cilandak • Shift Pagi-Malam (06:00 - 23:00)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-lg bg-mist-shadow p-1">
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setOffset((value) => Math.max(0, value - 1));
                }}
                disabled={offset === 0}
                aria-label="Hari sebelumnya"
                className="cursor-pointer rounded p-1.5 text-slate-whisper transition-colors hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
              >
                <MIcon name="chevron_left" className="text-[20px]" />
              </button>
              <span className="flex items-center gap-1.5 px-2 text-label-md text-on-surface">
                <MIcon name="event" className="text-[18px] text-court-green-deep" />
                {dateLabel(date)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setOffset((value) => Math.min(6, value + 1));
                }}
                disabled={offset === 6}
                aria-label="Hari berikutnya"
                className="cursor-pointer rounded p-1.5 text-slate-whisper transition-colors hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
              >
                <MIcon name="chevron_right" className="text-[20px]" />
              </button>
            </div>

            <ButtonLink
              href="/admin/booking/baru"
              icon={<MIcon name="add_circle" className="text-[18px]" />}
            >
              Booking Walk-In / Manual
            </ButtonLink>
            <ButtonLink href="/admin/lapangan" icon={<MIcon name="build" className="text-[18px]" />}>
              Set Maintenance
            </ButtonLink>
            <ButtonLink href="/admin/laporan" icon={<MIcon name="file_download" className="text-[18px]" />}>
              Ekspor
            </ButtonLink>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-field-white p-5 shadow-sm">
            <div className="flex min-w-0 flex-col">
              <span className="text-label-sm uppercase tracking-wider text-slate-whisper">
                Total Omzet Hari Ini
              </span>
              <span className="mt-1 text-headline-lg text-court-green-deep">
                {formatRupiah(omzet)}
              </span>
              <span className="mt-2 flex items-center gap-1.5 text-label-sm font-semibold text-primary-container">
                <MIcon name="trending_up" className="text-[16px]" />
                {confirmedCount} booking terkonfirmasi{loading ? "…" : ""}
              </span>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-court-grass-light text-primary-container">
              <MIcon name="payments" className="text-[24px]" />
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-field-white p-5 shadow-sm">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-label-sm uppercase tracking-wider text-slate-whisper">
                Okupansi Lapangan
              </span>
              <span className="mt-1 flex items-baseline gap-2 text-headline-lg text-on-surface">
                {occupancy}%
                <span className="text-body-sm text-slate-whisper">/ target 80%</span>
              </span>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-mist-shadow">
                <div
                  className={cn(
                    "h-full rounded-full",
                    occupancy >= 80 ? "bg-primary-container" : "bg-pending",
                  )}
                  style={{ width: `${occupancy}%` }}
                />
              </div>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-court-grass-light text-court-green-deep">
              <MIcon name="pie_chart" className="text-[24px]" />
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-field-white p-5 shadow-sm">
            <div className="flex min-w-0 flex-col">
              <span className="text-label-sm uppercase tracking-wider text-slate-whisper">
                Slot Terisi Real-Time
              </span>
              <span className="mt-1 flex items-baseline gap-1.5 text-headline-lg text-on-surface">
                {occupied}
                <span className="text-headline-sm text-slate-whisper">/ {totalSlots}</span>
                <span className="text-label-sm font-semibold text-court-green-deep">Slot</span>
              </span>
              <span className="mt-2 flex items-center gap-1.5 text-body-sm text-slate-whisper">
                <span className="h-2 w-2 rounded-full bg-confirmed-blue" />
                {freeCount} slot kosong tersisa
              </span>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container text-secondary">
              <MIcon name="calendar_today" className="text-[24px]" />
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-field-white p-5 shadow-sm">
            <div className="flex min-w-0 flex-col">
              <span className="text-label-sm uppercase tracking-wider text-slate-whisper">
                Menunggu Verifikasi Kasir
              </span>
              <span className="mt-1 flex items-baseline gap-2 text-headline-lg text-pending-amber">
                {pendingBookings.length}
                <span className="text-body-sm text-slate-whisper">Pemesanan hold</span>
              </span>
              <span className="mt-2 flex items-center gap-1.5 text-body-sm font-medium text-pending-amber">
                <MIcon name="timer" className="animate-pulse text-[16px]" />
                Batas pembayaran &lt; 15 menit
              </span>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tertiary-fixed text-tertiary">
              <MIcon name="hourglass_top" className="text-[24px]" />
            </span>
          </div>
        </div>

        {/* Matrix + side feed */}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-4 rounded-2xl bg-field-white p-5 shadow-sm xl:col-span-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-headline-sm text-on-surface">
                  Interactive Court Schedule Matrix
                </span>
                <span className="text-body-sm text-slate-whisper">
                  (Klik sel untuk intervensi operator)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-label-sm">
                {[
                  { color: "bg-field-white border border-primary-container/40", label: "Available" },
                  { color: "bg-confirmed-blue", label: "Confirmed" },
                  { color: "bg-pending-amber", label: "Pending Hold" },
                  { color: "bg-closure-grey", label: "Maintenance" },
                ].map((item) => (
                  <span key={item.label} className="flex items-center gap-1.5">
                    <span className={cn("h-3 w-3 rounded", item.color)} />
                    <span className="text-slate-whisper">{item.label}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="w-full overflow-x-auto pb-1">
              <div className="flex min-w-[880px] flex-col gap-2">
                <div className="grid grid-cols-10 gap-1 rounded-lg bg-mist-shadow py-1 text-center text-label-sm text-slate-whisper">
                  <div className="pl-3 text-left font-semibold text-on-surface">Lapangan</div>
                  {BUCKETS.map((bucket) => (
                    <div key={bucket}>
                      {String(bucket).padStart(2, "0")}:00
                      {bucket >= 18 && <span className="text-[10px] text-pending-amber"> ★</span>}
                    </div>
                  ))}
                </div>

                {courts.map((court) => (
                  <div
                    key={court.id}
                    className="grid grid-cols-10 items-center gap-1 rounded-lg bg-surface-bright p-1.5"
                  >
                    <div className="flex flex-col pl-2">
                      <span className="text-label-lg leading-tight text-court-green-deep">
                        {court.name}
                      </span>
                      <span className="text-label-sm text-slate-whisper">
                        {court.isIndoor ? "Indoor" : "Outdoor"}
                      </span>
                    </div>
                    {cellsFor(court.id).map((cell, index) =>
                      cell ? (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setActiveSlot(cell.slot)}
                          className={cn(
                            "truncate rounded-lg p-2 text-left text-left shadow-sm transition-all",
                            cellTone(cell.slot!),
                          )}
                        >
                          <span className="block truncate text-data-tabular">{cell.label}</span>
                          <span className="block truncate text-[10px] opacity-80">{cell.sub}</span>
                        </button>
                      ) : (
                        <span key={index} className="rounded-lg p-2 text-center text-body-sm text-slate-whisper/30">
                          —
                        </span>
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-court-grass-light p-3">
              <div className="flex items-center gap-2">
                <MIcon name="info" className="text-[20px] text-court-green-deep" />
                <span className="text-body-sm text-court-green-deep">
                  Slot <strong>Pending</strong> otomatis kedaluwarsa bila tidak dibayar dalam 15
                  menit. Kasir boleh &quot;Override / Isi Manual&quot; jika tamu sudah di depan
                  kasir.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void load(date);
                }}
                className="flex cursor-pointer items-center gap-1 text-label-sm font-semibold text-court-green-deep hover:underline"
              >
                <MIcon name="sync" className="text-[16px]" /> Force Refresh
              </button>
            </div>
          </div>

          {/* Side panel */}
          <div className="flex min-w-0 flex-col gap-5 xl:col-span-4">
            <Card>
              <CardHeader
                title="Antrean Kasir &amp; Walk-In"
                action={<Badge tone="green">{pendingBookings.length} antrean</Badge>}
              />
              <CardBody className="space-y-2.5">
                {pendingBookings.length === 0 ? (
                  <EmptyState
                    title="Antrean kosong"
                    description="Tidak ada booking menunggu pembayaran saat ini."
                    className="py-8"
                  />
                ) : (
                  pendingBookings.slice(0, 3).map((booking) => {
                    const court = courts.find((item) => item.id === booking.courtId);
                    const start = Math.min(...booking.hours);
                    const end = Math.max(...booking.hours) + 1;
                    return (
                      <div
                        key={booking.code}
                        className="flex flex-col gap-2 rounded-xl bg-surface-bright p-3.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 animate-ping rounded-full bg-pending-amber" />
                            <span className="truncate text-label-md text-on-surface">
                              {booking.customerName ?? "—"} ({court?.name})
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-tertiary-fixed px-2 py-0.5 text-[11px] font-semibold text-tertiary">
                            {booking.source === "walkin" ? "Walk-in" : "Hold Web"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-body-sm text-slate-whisper">
                          <span className="tabular-nums">
                            {hourLabel(start, end).replace(" WIB", "")}
                          </span>
                          <span className="font-bold tabular-nums text-on-surface">
                            {formatRupiah(booking.subtotal)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => void actOnBooking(booking.code, "confirm")}
                            className="flex-1 cursor-pointer rounded-lg bg-primary-container py-1.5 text-label-sm font-semibold text-field-white transition-all hover:bg-court-green-deep disabled:opacity-50"
                          >
                            Verifikasi Bayar Kasir
                          </button>
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => void actOnBooking(booking.code, "cancel")}
                            className="cursor-pointer rounded-lg bg-mist-shadow px-2.5 py-1.5 text-label-sm text-slate-whisper transition-all hover:bg-error-container hover:text-on-error-container disabled:opacity-50"
                          >
                            Lepas
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                <Link
                  href="/admin/booking"
                  className="block w-full rounded-lg bg-mist-shadow py-2 text-center text-label-md text-on-surface-variant transition-colors hover:bg-surface-variant"
                >
                  Buka seluruh riwayat transaksi
                </Link>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Status Lapangan Fisik"
                action={
                  <span className="text-label-sm font-semibold text-court-green-deep">
                    {courts.filter((court) => court.isActive).length} / {courts.length} Operasional
                  </span>
                }
              />
              <CardBody className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  {courts.map((court) => {
                    const closed = todayClosures.find((closure) => closure.courtId === court.id);
                    return (
                      <div
                        key={court.id}
                        className={cn(
                          "flex flex-col gap-1 rounded-lg p-2.5",
                          closed ? "bg-surface-container" : "bg-court-grass-light",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "text-label-md",
                              closed ? "text-tertiary" : "text-court-green-deep",
                            )}
                          >
                            {court.name}
                          </span>
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              closed ? "bg-pending-amber" : "bg-primary-container",
                            )}
                          />
                        </div>
                        <span className="text-[11px] text-slate-whisper">
                          {closed ? closed.reason : "Lampu & jaring 100% OK"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setToast("Form insiden lapangan dibuka (demo).")}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-1.5 text-label-sm text-error transition-colors hover:bg-error-container/30"
                >
                  <MIcon name="report_problem" className="text-[16px]" />
                  Catat Insiden / Kerusakan Alat Lapangan
                </button>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal detail slot */}
      <Modal
        open={!!activeSlot}
        onClose={() => setActiveSlot(null)}
        title={detail ? `Detail Kontrol Slot · ${detail.court.name}` : "Detail Kontrol Slot"}
      >
        {detail && activeSlot && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl bg-surface-bright p-4">
              <div className="flex items-center justify-between">
                <span className="text-label-sm uppercase text-slate-whisper">Status saat ini</span>
                <Badge
                  tone={
                    activeSlot.status === "terkonfirmasi"
                      ? "blue"
                      : activeSlot.status === "menunggu_pembayaran"
                        ? "amber"
                        : activeSlot.status === "tutup"
                          ? "grey"
                          : "green"
                  }
                >
                  {detail.label}
                </Badge>
              </div>
              {activeSlot.status !== "tutup" && activeSlot.status !== "kosong" && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-body-md text-slate-whisper">Pemesan:</span>
                    <span className="text-label-md text-on-surface">{detail.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-body-md text-slate-whisper">Nomor HP:</span>
                    <span className="text-data-tabular text-on-surface">
                      {detail.customerPhone}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-body-md text-slate-whisper">Metode &amp; status bayar:</span>
                    <span
                      className={cn(
                        "text-body-md font-semibold",
                        detail.paymentStatus === "paid"
                          ? "text-court-green-deep"
                          : "text-pending-ink",
                      )}
                    >
                      {detail.paymentStatus === "paid" ? "Lunas (QRIS)" : "Menunggu pembayaran"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-body-md text-slate-whisper">Slot:</span>
                    <span className="text-body-md text-on-surface">
                      {hourLabel(detail.start, detail.end)}
                    </span>
                  </div>
                </>
              )}
              {activeSlot.status === "tutup" && detail.reason && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body-md text-slate-whisper">Alasan:</span>
                  <span className="text-body-md font-semibold text-on-surface">
                    {detail.reason}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-label-md font-semibold text-on-surface">
                Tindakan cepat operator:
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                {activeSlot.status === "kosong" && (
                  <>
                    <Link
                      href={`/admin/booking/baru?court=${activeSlot.courtId}&hour=${activeSlot.hour}&date=${date}`}
                      className="flex items-center gap-2 rounded-lg bg-court-grass-light p-2.5 text-label-sm font-semibold text-court-green-deep transition-all hover:bg-primary-fixed"
                    >
                      <MIcon name="add_circle" className="text-[18px]" />
                      Booking Manual
                    </Link>
                    <Link
                      href="/admin/lapangan"
                      className="flex items-center gap-2 rounded-lg bg-mist-shadow p-2.5 text-label-sm font-semibold text-on-surface transition-all hover:bg-surface-variant"
                    >
                      <MIcon name="build" className="text-[18px] text-closure-grey" />
                      Tutup / Maintenance
                    </Link>
                  </>
                )}
                {activeSlot.status === "menunggu_pembayaran" && detail.code && (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => void actOnBooking(detail.code!, "confirm")}
                    className="flex cursor-pointer items-center gap-2 rounded-lg bg-court-grass-light p-2.5 text-label-sm font-semibold text-court-green-deep transition-all hover:bg-primary-fixed disabled:opacity-50"
                  >
                    <MIcon name="verified" className="text-[18px]" />
                    Konfirmasi Bayar
                  </button>
                )}
                {(activeSlot.status === "menunggu_pembayaran" ||
                  activeSlot.status === "terkonfirmasi") &&
                  detail.code && (
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => void actOnBooking(detail.code!, "cancel")}
                      className="flex cursor-pointer items-center gap-2 rounded-lg bg-error-container p-2.5 text-label-sm font-semibold text-on-error-container transition-all hover:bg-error-red hover:text-field-white disabled:opacity-50"
                    >
                      <MIcon name="cancel" className="text-[18px]" />
                      Batalkan Booking
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => setToast("Kirim tiket via WhatsApp tersedia di Batch 6 (notifikasi).")}
                  className="flex cursor-pointer items-center gap-2 rounded-lg bg-mist-shadow p-2.5 text-label-sm font-semibold text-on-surface transition-all hover:bg-surface-variant"
                >
                  <MIcon name="chat" className="text-[18px] text-primary-container" />
                  Kirim Tiket WA
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
              <Button variant="ghost" onClick={() => setActiveSlot(null)}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Toast open={!!toast} message={toast ?? ""} onClose={() => setToast(undefined)} tone="success" />
    </AdminShell>
  );
}
