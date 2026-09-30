"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { StatusLegend } from "@/components/layout/StatusLegend";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { MIcon } from "@/components/ui/MIcon";
import { IconPlus } from "@/components/ui/icons";
import { addDays, dateLabel, formatRupiah, hourLabel, todayString } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Court, Slot } from "@/lib/types";
import type { DaySchedule } from "@/lib/slots";

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

const styles: Record<Slot["status"], string> = {
  kosong: "bg-court-grass-light text-court-green-deep hover:ring-2 hover:ring-primary-container/40",
  terkonfirmasi: "bg-primary-container text-field-white",
  menunggu_pembayaran: "bg-pending-light text-pending-ink",
  tutup: "bg-closure-light text-slate-whisper line-through",
};

export default function AdminJadwalPage() {
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(todayString(), index)),
    [],
  );
  const [date, setDate] = useState(dates[0]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookingList, setBookingList] = useState<ScheduleBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  function pickDate(value: string) {
    setLoading(true);
    setSelectedSlot(null);
    setDate(value);
  }

  async function closeSelectedSlot() {
    if (!selectedSlot || selectedSlot.status !== "kosong") return;
    setClosing(true);
    try {
      const res = await fetch("/api/admin/closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: selectedSlot.courtId,
          date,
          startHour: selectedSlot.hour,
          endHour: selectedSlot.hour + 1,
          reason: "Ditutup dari grid jadwal",
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        setError(json.message ?? "Gagal menutup slot.");
        return;
      }
      setSelectedSlot(null);
      setLoading(true);
      const fresh = await fetch(`/api/admin/schedule?date=${date}`, { cache: "no-store" });
      const data = (await fresh.json()) as { schedule: DaySchedule };
      setSlots(
        data.schedule.slots.map((s) => ({
          courtId: s.courtId,
          date,
          hour: s.hour,
          status: s.status,
          code: s.code ?? undefined,
          reason: s.reason ?? undefined,
        })),
      );
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setClosing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/schedule?date=${date}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) throw new Error("Sesi admin berakhir. Login ulang.");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          schedule: DaySchedule;
          bookings: ScheduleBooking[];
        };
        if (cancelled) return;
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
            date,
            hour: s.hour,
            status: s.status,
            code: s.code ?? undefined,
            reason: s.reason ?? undefined,
          })),
        );
        setBookingList(json.bookings);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Refresh otomatis tiap 15 detik agar booking baru muncul tanpa reload (AC F7).
    const timer = window.setInterval(() => {
      fetch(`/api/admin/schedule?date=${date}`, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) return;
          const json = (await res.json()) as {
            schedule: DaySchedule;
            bookings: ScheduleBooking[];
          };
          if (cancelled) return;
          setSlots(
            json.schedule.slots.map((s) => ({
              courtId: s.courtId,
              date,
              hour: s.hour,
              status: s.status,
              code: s.code ?? undefined,
              reason: s.reason ?? undefined,
            })),
          );
          setBookingList(json.bookings);
        })
        .catch(() => undefined);
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [date]);

  const detail = useMemo(() => {
    if (!selectedSlot) return null;
    const court = courts.find((c) => c.id === selectedSlot.courtId);
    if (!court) return null;
    const booking = selectedSlot.code
      ? bookingList.find((b) => b.code === selectedSlot.code)
      : undefined;
    const label =
      selectedSlot.status === "terkonfirmasi"
        ? "Terkonfirmasi"
        : selectedSlot.status === "menunggu_pembayaran"
          ? "Menunggu Pembayaran"
          : selectedSlot.status === "tutup"
            ? "Tutup / Maintenance"
            : "Kosong";
    return {
      court,
      start: selectedSlot.hour,
      end: selectedSlot.hour + 1,
      label,
      reason: selectedSlot.reason,
      code: selectedSlot.code,
      customerName: booking?.customerName,
      customerPhone: booking?.customerPhone,
      paymentStatus: selectedSlot.status === "terkonfirmasi" ? "paid" : "pending",
      amount: court.hourlyPrice,
    };
  }, [selectedSlot, courts, bookingList]);
  const waiting = slots.filter((slot) => slot.status === "menunggu_pembayaran").length;
  const free = slots.filter((slot) => slot.status === "kosong").length;

  return (
    <AdminShell title="Matrix Slot & Kasir">
      <div className="flex w-full flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-5 rounded-2xl bg-field-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-court-grass-light px-3 py-1 text-label-sm uppercase tracking-wider text-court-green-deep">
              <MIcon name="grid_view" className="text-[15px]" />
              Operasional lapangan
            </span>
            <h1 className="mt-2 text-headline-lg text-on-surface sm:text-display-mobile">
              Matrix Slot &amp; Kasir
            </h1>
            <p className="mt-1.5 text-body-md text-slate-whisper">
              Satu papan untuk melihat semua jam tiap lapangan, status bayar, dan membuka detail
              booking.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-xl bg-pending-light px-3 py-2 text-label-sm font-bold text-pending-ink">
              <MIcon name="schedule" className="text-[16px]" />
              {waiting} menunggu bayar
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl bg-court-grass-light px-3 py-2 text-label-sm font-bold text-court-green-deep">
              <MIcon name="event_available" className="text-[16px]" />
              {free} slot kosong
            </span>
            <ButtonLink href="/admin/booking/baru" icon={<IconPlus size={17} />}>
              Booking manual
            </ButtonLink>
          </div>
        </div>

        {/* Date picker + legend */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-mist-shadow p-1 shadow-card">
            {dates.map((value) => {
              const active = value === date;
              const day = new Date(`${value}T00:00:00`);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => pickDate(value)}
                  className={cn(
                    "flex min-h-12 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl px-3 transition-colors",
                    active
                      ? "bg-primary-container text-field-white shadow-sm"
                      : "text-on-surface-variant hover:bg-field-white",
                  )}
                >
                  <span className="text-label-sm uppercase opacity-75">
                    {day.toLocaleDateString("id-ID", { weekday: "short" })}
                  </span>
                  <span className="text-label-lg tabular-nums">{day.getDate()}</span>
                </button>
              );
            })}
          </div>
          <div className="rounded-2xl bg-field-white px-4 py-3 shadow-card">
            <StatusLegend />
          </div>
        </div>

        {/* Matrix */}
        {error && (
          <p
            className="rounded-xl bg-danger-light px-4 py-3 text-body-md font-semibold text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
        <Card>
          <CardHeader
            title={dateLabel(date)}
            subtitle={
              loading ? "Memuat jadwal terkini…" : "Klik slot untuk melihat detail booking"
            }
          />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[920px] border-collapse text-body-md">
              <thead>
                <tr className="border-b border-line bg-mist/70">
                  <th className="sticky left-0 z-10 min-w-48 bg-mist/95 px-4 py-3 text-left text-label-sm uppercase tracking-wider text-slate-whisper">
                    Lapangan
                  </th>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <th
                      key={hour}
                      className="px-1 py-3 text-center text-label-sm tabular-nums text-slate-whisper"
                    >
                      {String(hour).padStart(2, "0")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courts.map((court) => {
                  const hours = [
                    ...new Set(slots.filter((s) => s.courtId === court.id).map((s) => s.hour)),
                  ].sort((a, b) => a - b);
                  return (
                    <tr key={court.id} className="border-b border-line/70 last:border-0">
                      <td className="sticky left-0 z-10 min-w-48 bg-field-white px-4 py-3">
                        <p className="text-label-lg text-on-surface">{court.name}</p>
                        <p className="text-body-sm tabular-nums text-slate-whisper">
                          {formatRupiah(court.hourlyPrice)}/jam ·{" "}
                          {court.isIndoor ? "Indoor" : "Outdoor"}
                        </p>
                      </td>
                      {Array.from({ length: 24 }, (_, hour) => {
                        if (!hours.includes(hour)) {
                          return (
                            <td
                              key={hour}
                              className="px-1 py-1.5 text-center text-body-sm text-slate-whisper/30"
                            >
                              —
                            </td>
                          );
                        }
                        const slot = slots.find(
                          (item) => item.courtId === court.id && item.hour === hour,
                        )!;
                        return (
                          <td key={hour} className="px-1 py-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedSlot(slot)}
                              aria-label={`${court.name} jam ${hour}:00 — ${slot.status}`}
                              className={cn(
                                "h-10 w-full cursor-pointer rounded-lg text-label-sm font-bold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-container",
                                styles[slot.status],
                              )}
                            >
                              {String(hour).padStart(2, "0")}00
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={!!selectedSlot}
        onClose={() => setSelectedSlot(null)}
        title={
          detail ? `${detail.court.name} · ${hourLabel(detail.start, detail.end)}` : "Slot"
        }
      >
        {detail && selectedSlot && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Badge
                tone={
                  selectedSlot.status === "terkonfirmasi"
                    ? "blue"
                    : selectedSlot.status === "menunggu_pembayaran"
                      ? "amber"
                      : selectedSlot.status === "tutup"
                        ? "grey"
                        : "green"
                }
              >
                {detail.label}
              </Badge>
              <span className="text-body-md tabular-nums text-slate-whisper">
                {formatRupiah(detail.amount ?? 0)}/jam
              </span>
            </div>

            {selectedSlot.status === "kosong" ? (
              <div className="space-y-3 rounded-xl bg-mist-shadow p-4 text-body-md text-slate-whisper">
                <p>Slot ini masih kosong dan dapat dipesan.</p>
                <ButtonLink
                  href={`/admin/booking/baru?court=${selectedSlot.courtId}&hour=${selectedSlot.hour}&date=${selectedSlot.date}`}
                  fullWidth
                  size="sm"
                  icon={<IconPlus size={16} />}
                >
                  Buat booking manual
                </ButtonLink>
                <button
                  type="button"
                  onClick={() => void closeSelectedSlot()}
                  disabled={closing}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-field-white px-4 text-label-md text-on-surface transition-colors hover:bg-closure-light disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {closing ? "Menutup…" : "Tutup slot (maintenance)"}
                </button>
              </div>
            ) : (
              <>
                <dl className="space-y-3 text-body-md">
                  {selectedSlot.status === "tutup" && detail.reason ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-whisper">Alasan</dt>
                      <dd className="font-semibold text-on-surface">{detail.reason}</dd>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-whisper">Pemesan</dt>
                        <dd className="font-semibold text-on-surface">{detail.customerName}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-whisper">Nomor HP</dt>
                        <dd className="font-semibold tabular-nums text-on-surface">
                          {detail.customerPhone}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-whisper">Kode</dt>
                        <dd className="font-mono font-semibold text-on-surface">{detail.code}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-whisper">Pembayaran</dt>
                        <dd>
                          {detail.paymentStatus === "paid" ? (
                            <Badge tone="green">Lunas</Badge>
                          ) : (
                            <Badge tone="amber">Menunggu</Badge>
                          )}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>

                {selectedSlot.status === "menunggu_pembayaran" && (
                  <p className="rounded-xl bg-pending-light p-3 text-body-sm text-pending-ink">
                    Konfirmasi manual hanya untuk remediasi (mis. QRIS gagal). Biasanya status
                    terverifikasi otomatis oleh sistem.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}
