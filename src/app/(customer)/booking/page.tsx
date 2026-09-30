"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Stepper } from "@/components/ui/Stepper";
import { SlotCell } from "@/components/ui/SlotCell";
import { QRBox } from "@/components/ui/QRBox";
import { Countdown } from "@/components/ui/Countdown";
import { OTPInput, PhoneInput, TextInput } from "@/components/ui/Input";
import { StatusLegend } from "@/components/layout/StatusLegend";
import { MIcon } from "@/components/ui/MIcon";
import {
  IconAlert,
  IconArrowRight,
  IconCheckCircle,
  IconChevronLeft,
  IconClock,
  IconInfo,
  IconTrash,
} from "@/components/ui/icons";
import type { Slot, WizardStep } from "@/lib/types";
import { useDaySchedule, useWeekAvailability } from "@/lib/use-schedule";
import {
  addDays,
  dateLabel,
  formatRupiah,
  hourLabel,
  shortDateLabel,
  todayString,
} from "@/lib/format";
import { cn } from "@/lib/cn";

type SelectedSlot = { courtId: number; hour: number };

function relativeDayLabel(offset: number) {
  if (offset === 0) return "Hari Ini";
  if (offset === 1) return "Besok";
  return new Date().toLocaleDateString("id-ID", { weekday: "long" });
}

/** Sisa detik hingga expiry server (dipanggil dari event handler, bukan render). */
function secondsUntilExpiry(iso: string): number {
  return Math.max(60, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
}

export default function BookingPage() {
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(todayString(), i)), []);
  const [date, setDate] = useState(dates[0]);
  const [step, setStep] = useState<WizardStep>("tanggal");
  const [selected, setSelected] = useState<SelectedSlot[]>([]);
  const [slotError, setSlotError] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [authError, setAuthError] = useState<string | undefined>();
  const [simulating, setSimulating] = useState(false);
  const [ticketCode, setTicketCode] = useState<string | undefined>();
  const [otpKey, setOtpKey] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [holdExpiry, setHoldExpiry] = useState<string | undefined>();
  const [holdSeconds, setHoldSeconds] = useState(15 * 60);
  // State pembayaran QRIS real (Batch 4, driver mock).
  const [qrString, setQrString] = useState<string | undefined>();
  const [payOrderId, setPayOrderId] = useState<string | undefined>();
  const [payError, setPayError] = useState<string | undefined>();
  const [payLoading, setPayLoading] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  // Slot real-time dari API (DB). Auto-refresh tiap 10 detik di dalam hook.
  const {
    courts: apiCourts,
    slots,
    loading: slotsLoading,
    error: slotsError,
    refresh: refreshSlots,
  } = useDaySchedule(date);
  const weekAvailability = useWeekAvailability(dates);
  const activeCourts = apiCourts.filter((court) => court.isActive);
  const minPrice =
    activeCourts.length > 0 ? Math.min(...activeCourts.map((c) => c.hourlyPrice)) : 0;
  const selectedCourt = selected[0]?.courtId;
  const court = apiCourts.find((item) => item.id === selectedCourt);
  const sortedSelected = [...selected].sort((a, b) => a.hour - b.hour);
  const subtotal = court ? selected.length * court.hourlyPrice : 0;
  const timeRange =
    sortedSelected.length > 0
      ? `${String(sortedSelected[0].hour).padStart(2, "0")}:00 – ${String(
          sortedSelected[sortedSelected.length - 1].hour + 1,
        ).padStart(2, "0")}:00 WIB`
      : "—";

  function selectDate(value: string) {
    setDate(value);
    setSelected([]);
    setSlotError(undefined);
    setStep("slot");
  }

  function toggleSlot(slot: Slot) {
    // Hanya slot kosong (status server) yang bisa dipilih.
    if (slot.status !== "kosong") return;
    setSlotError(undefined);
    const exists = selected.some(
      (item) => item.courtId === slot.courtId && item.hour === slot.hour,
    );
    if (exists) {
      setSelected((previous) =>
        previous.filter((item) => !(item.courtId === slot.courtId && item.hour === slot.hour)),
      );
      return;
    }
    if (selected.length === 0) {
      setSelected([{ courtId: slot.courtId, hour: slot.hour }]);
      return;
    }
    if (selected[0].courtId !== slot.courtId) {
      setSlotError(
        "Dalam satu transaksi hanya boleh satu lapangan. Ganti ke lapangan lain, atau mulai transaksi baru.",
      );
      return;
    }
    const ordered = [...selected].sort((a, b) => a.hour - b.hour);
    const min = ordered[0].hour;
    const max = ordered[ordered.length - 1].hour;
    if (slot.hour !== min - 1 && slot.hour !== max + 1) {
      setSlotError("Hanya jam berurutan (berdampingan) yang boleh dipilih dalam satu booking.");
      return;
    }
    setSelected([...selected, { courtId: slot.courtId, hour: slot.hour }]);
  }

  function removeSlot(courtId: number, hour: number) {
    setSelected((previous) =>
      previous.filter((item) => !(item.courtId === courtId && item.hour === hour)),
    );
  }

  async function sendOtp() {
    if (!name.trim() || phone.replace(/\D/g, "").length < 9) {
      setAuthError("Isi nama dan nomor HP yang valid.");
      return;
    }
    setAuthError(undefined);
    setOtpLoading(true);
    try {
      const res = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name: name.trim() }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; debugCode?: string };
      if (!json.ok) {
        setAuthError(json.message ?? "Gagal mengirim OTP.");
        return;
      }
      setDevCode(json.debugCode);
      setOtp("");
      setOtpSent(true);
      setOtpKey((value) => value + 1);
    } catch {
      setAuthError("Tidak dapat terhubung ke server.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) {
      setAuthError("Masukkan 6 digit kode OTP.");
      return;
    }
    if (!court) {
      setAuthError("Pilih slot terlebih dahulu.");
      return;
    }
    setAuthError(undefined);
    setOtpLoading(true);
    try {
      const vres = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp, name: name.trim() }),
      });
      const vjson = (await vres.json()) as { ok: boolean; message?: string };
      if (!vjson.ok) {
        setAuthError(vjson.message ?? "Verifikasi gagal.");
        return;
      }
      // Tahan slot di server (menunggu_pembayaran, +15 menit).
      const bres = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: court.id,
          date,
          hours: sortedSelected.map((item) => item.hour),
        }),
      });
      const bjson = (await bres.json()) as {
        ok: boolean;
        message?: string;
        booking?: { code: string; expiresAt: string | null };
      };
      if (!bjson.ok || !bjson.booking) {
        setAuthError(bjson.message ?? "Slot tidak tersedia. Pilih jam lain.");
        refreshSlots();
        return;
      }
      setTicketCode(bjson.booking.code);
      setHoldExpiry(bjson.booking.expiresAt ?? undefined);
      // Countdown mengikuti expiry server (ADR 0006: 15 mnt).
      if (bjson.booking.expiresAt) {
        setHoldSeconds(secondsUntilExpiry(bjson.booking.expiresAt));
      } else {
        setHoldSeconds(15 * 60);
      }
      setAuthError(undefined);
      setIsExpired(false);
      setQrString(undefined);
      setPayOrderId(undefined);
      setPayError(undefined);
      setStep("pembayaran");
      void loadCharge(bjson.booking.code);
    } catch {
      setAuthError("Tidak dapat terhubung ke server.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function loadCharge(code: string) {
    setPayLoading(true);
    setPayError(undefined);
    try {
      const res = await fetch(`/api/payments/${code}/charge`, { method: "POST" });
      const json = (await res.json()) as {
        ok: boolean;
        message?: string;
        payment?: { orderId: string; qrString: string | null };
      };
      if (!json.ok || !json.payment) {
        setPayError(json.message ?? "Gagal membuat QR pembayaran.");
        if (!res.ok && res.status === 409) setIsExpired(true);
        return;
      }
      setQrString(json.payment.qrString ?? undefined);
      setPayOrderId(json.payment.orderId);
    } catch {
      setPayError("Tidak dapat terhubung ke server.");
    } finally {
      setPayLoading(false);
    }
  }

  async function refreshPayStatus(code: string): Promise<string | undefined> {
    try {
      const res = await fetch(`/api/payments/${code}/status`);
      const json = (await res.json()) as {
        ok: boolean;
        booking?: { status: string };
        payment?: { qrString: string | null; orderId: string };
      };
      if (!json.ok || !json.booking) return undefined;
      if (json.payment?.qrString) {
        setQrString(json.payment.qrString);
        setPayOrderId(json.payment.orderId);
      }
      if (json.booking.status === "terkonfirmasi") {
        setStep("selesai");
      } else if (json.booking.status === "dibatalkan") {
        setIsExpired(true);
      }
      return json.booking.status;
    } catch {
      return undefined;
    }
  }

  // Polling fallback tiap 5 detik selama menunggu pembayaran (webhook-first).
  useEffect(() => {
    if (step !== "pembayaran" || !ticketCode || isExpired) return;
    const timer = window.setInterval(() => {
      void refreshPayStatus(ticketCode);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [step, ticketCode, isExpired]);

  /** Simulasi bayar khusus driver mock (hilang saat Midtrans sandbox tiba). */
  async function simulatePay() {
    if (!ticketCode || !payOrderId) return;
    setSimulating(true);
    setPayError(undefined);
    try {
      const res = await fetch("/api/webhooks/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: payOrderId, status: "PAID" }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        setPayError(json.message ?? "Simulasi pembayaran gagal.");
        return;
      }
      await refreshPayStatus(ticketCode);
    } catch {
      setPayError("Tidak dapat terhubung ke server.");
    } finally {
      setSimulating(false);
    }
  }

  function backToSlots() {
    setIsExpired(false);
    setTicketCode(undefined);
    setQrString(undefined);
    setPayOrderId(undefined);
    setSelected([]);
    refreshSlots();
    setStep("slot");
  }

  return (
    <div className="court-grid min-h-screen pb-28 sm:pb-10">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Header: eyebrow + judul + stepper */}
        <div className="flex flex-col gap-5 rounded-2xl bg-field-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-2 text-label-sm uppercase tracking-[0.14em] text-slate-whisper">
              <MIcon name="schedule" className="text-[16px] text-primary-container" />
              Reservasi Instan • Garansi 3 Klik
            </p>
            <h1 className="text-headline-lg text-on-surface sm:text-display-mobile">
              Pilih Jadwal &amp; Lapangan
            </h1>
            <p className="mt-1.5 max-w-xl text-body-md text-slate-whisper">
              Satu booking bisa mencakup beberapa jam berurutan di lapangan yang sama. Harga dan
              status selalu terlihat sebelum melanjutkan.
            </p>
          </div>
          <div className="shrink-0 lg:max-w-md">
            <Stepper current={step} />
          </div>
        </div>

        {/* Pilih hari */}
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-headline-sm text-on-surface">Pilih Hari Bermain</h2>
            <span className="flex items-center gap-1.5 text-label-sm text-slate-whisper">
              <MIcon name="sync" className="text-[15px] text-primary-container" />
              Pembaruan Slot Real-Time (Setiap 10s)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {dates.map((value, index) => {
              const active = value === date && step !== "tanggal";
              const available = weekAvailability[value];
              const parsed = new Date(`${value}T00:00:00`);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectDate(value)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-[104px] cursor-pointer flex-col items-start justify-between rounded-xl p-3 text-left transition-colors duration-150",
                    active
                      ? "bg-primary-container text-field-white shadow-md"
                      : "bg-field-white text-on-surface shadow-sm hover:bg-court-grass-light/60",
                  )}
                >
                  <span
                    className={cn(
                      "text-label-sm",
                      active ? "text-court-grass-light" : "text-slate-whisper",
                    )}
                  >
                    {relativeDayLabel(index)}
                  </span>
                  <span className="mt-1 text-headline-sm tabular-nums">
                    {parsed.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className="mt-2 flex w-full items-center justify-between gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-label-sm",
                        active
                          ? "bg-field-white/20 text-field-white"
                          : "bg-court-grass-light text-court-green-deep",
                      )}
                    >
                      {available === undefined ? "…" : `${available} Slot Ada`}
                    </span>
                    <span
                      className={cn(
                        "text-label-sm tabular-nums",
                        active ? "text-field-white" : "text-slate-whisper",
                      )}
                    >
                      {minPrice > 0 ? formatRupiah(minPrice) : "…"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-5 rounded-2xl bg-field-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-label-sm uppercase tracking-wider text-slate-whisper">
              Status Indikator:
            </span>
            <StatusLegend showDuration />
          </div>
        </div>

        {/* Workspace */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-8">
            {step === "tanggal" && (
              <Card>
                <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-court-grass-light text-court-green-deep">
                    <MIcon name="calendar_month" className="text-[24px]" />
                  </span>
                  <p className="text-headline-sm text-on-surface">Pilih hari untuk mulai</p>
                  <p className="max-w-md text-body-md text-slate-whisper">
                    Tap salah satu kartu tanggal di atas — slot kosong tiap lapangan akan langsung
                    tampil beserta harganya.
                  </p>
                </CardBody>
              </Card>
            )}

            {step === "slot" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-label-md text-slate-whisper">
                    Slot untuk <span className="text-on-surface">{dateLabel(date)}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep("tanggal")}
                    className="cursor-pointer text-label-md text-primary-container hover:underline"
                  >
                    ← Ganti tanggal
                  </button>
                </div>

                {slotsLoading && slots.length === 0 ? (
                  <Card>
                    <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
                      <p className="text-headline-sm text-on-surface">Memuat slot terkini…</p>
                    </CardBody>
                  </Card>
                ) : null}

                {slotsError && (
                  <p
                    className="flex items-center gap-2 rounded-xl bg-danger-light px-4 py-3 text-body-md font-semibold text-danger"
                    role="alert"
                  >
                    <IconAlert size={16} /> {slotsError}{" "}
                    <button
                      type="button"
                      onClick={refreshSlots}
                      className="cursor-pointer underline"
                    >
                      Muat ulang
                    </button>
                  </p>
                )}

                {activeCourts.map((item) => {
                  const hours = [
                    ...new Set(slots.filter((s) => s.courtId === item.id).map((s) => s.hour)),
                  ].sort((a, b) => a - b);
                  const courtSlots = hours
                    .map((hour) => slots.find((s) => s.courtId === item.id && s.hour === hour))
                    .filter((s): s is Slot => Boolean(s));
                  if (courtSlots.length === 0) return null;
                  return (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-2xl bg-field-white p-4 shadow-sm sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-court-grass-light text-court-green-deep">
                            <MIcon name="sports_tennis" className="text-[22px]" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-headline-sm text-on-surface">{item.name}</h3>
                              <span className="rounded bg-secondary-container/25 px-1.5 py-0.5 text-label-sm text-secondary">
                                {item.isIndoor ? "Indoor" : "Outdoor"}
                              </span>
                            </div>
                            <p className="mt-0.5 text-body-sm text-slate-whisper">
                              {item.description} · {hours[0]}:00–
                              {String(hours[hours.length - 1] + 1).padStart(2, "0")}:00
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="block text-label-sm text-slate-whisper">
                            Tarif per jam
                          </span>
                          <p className="text-headline-md tabular-nums text-on-surface">
                            {formatRupiah(item.hourlyPrice)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 overflow-x-auto pb-1">
                        <div className="grid min-w-[640px] grid-flow-col auto-cols-[minmax(86px,1fr)] gap-2">
                          {courtSlots.map((slot) => {
                            const isSelected = selected.some(
                              (s) => s.courtId === slot.courtId && s.hour === slot.hour,
                            );
                            return (
                              <SlotCell
                                key={`${slot.courtId}-${slot.hour}`}
                                slot={slot}
                                selected={isSelected}
                                onSelect={toggleSlot}
                                hint={
                                  slot.status === "kosong"
                                    ? formatRupiah(item.hourlyPrice)
                                    : undefined
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {slotError && (
                  <p
                    className="flex items-center gap-2 rounded-xl bg-danger-light px-4 py-3 text-body-md font-semibold text-danger"
                    role="alert"
                  >
                    <IconAlert size={16} /> {slotError}
                  </p>
                )}
              </>
            )}

            {step === "review" && (
              <Card>
                <CardHeader title="Review order" subtitle={dateLabel(date)} />
                <CardBody>
                  <div className="space-y-2">
                    {court && (
                      <div className="flex items-center justify-between rounded-xl bg-mist-shadow px-4 py-3">
                        <span className="text-label-lg text-on-surface">{court.name}</span>
                        <span className="text-body-sm text-slate-whisper">
                          {formatRupiah(court.hourlyPrice)}/jam
                        </span>
                      </div>
                    )}
                    {sortedSelected.map((item) => (
                      <div
                        key={`${item.courtId}-${item.hour}`}
                        className="flex items-center justify-between rounded-xl border border-line px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-court-grass-light text-court-green-deep">
                            <IconClock size={16} />
                          </span>
                          <div>
                            <p className="text-label-md tabular-nums text-on-surface">
                              {hourLabel(item.hour, item.hour + 1)}
                            </p>
                            <p className="text-body-sm text-slate-whisper">{shortDateLabel(date)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-label-md tabular-nums text-on-surface">
                            {formatRupiah(court?.hourlyPrice ?? 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSlot(item.courtId, item.hour)}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-whisper hover:bg-danger-light hover:text-danger"
                            aria-label={`Hapus jam ${item.hour}:00`}
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-court-grass-light px-4 py-3">
                    <span className="text-label-lg text-court-green-deep">
                      Total ({sortedSelected.length} jam)
                    </span>
                    <span className="text-headline-md tabular-nums text-court-green-deep">
                      {formatRupiah(subtotal)}
                    </span>
                  </div>
                </CardBody>
              </Card>
            )}

            {(step === "identitas" || step === "pembayaran") && (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-headline-sm text-on-surface">
                      {step === "identitas" ? "Checkout cepat" : "Pembayaran QRIS"}
                    </p>
                    <p className="mt-0.5 text-body-sm text-slate-whisper">
                      {court?.name} · {dateLabel(date)} · {sortedSelected.length} jam
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setStep("review")}>
                    Kembali
                  </Button>
                </div>
                <CardBody className="space-y-4">
                  {step === "identitas" ? (
                    <div className="space-y-4">
                      <div>
                        <label
                          className="mb-1.5 block text-label-md text-on-surface"
                          htmlFor="b-name"
                        >
                          Nama Pemesan
                        </label>
                        <TextInput
                          id="b-name"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="cth: Raka Pratama"
                        />
                      </div>
                      <div>
                        <label
                          className="mb-1.5 block text-label-md text-on-surface"
                          htmlFor="b-phone"
                        >
                          Nomor WhatsApp (Untuk E-Ticket &amp; OTP)
                        </label>
                        <PhoneInput
                          id="b-phone"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          placeholder="812 3456 7890"
                        />
                      </div>
                      {otpSent ? (
                        <div className="space-y-3 rounded-xl bg-mist-shadow p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-label-md text-on-surface">Kode Verifikasi (OTP)</p>
                            <button
                              type="button"
                              onClick={() => {
                                void sendOtp();
                              }}
                              className="cursor-pointer text-label-sm text-primary-container hover:underline"
                            >
                              Kirim ulang
                            </button>
                          </div>
                          <OTPInput key={otpKey} value={otp} onChange={setOtp} error={!!authError} />
                          <Button onClick={() => void verifyOtp()} fullWidth size="lg" loading={otpLoading}>
                            Verifikasi &amp; lanjut bayar
                          </Button>
                          <p className="text-body-sm text-slate-whisper">
                            {devCode ? (
                              <>
                                Kode (mode dev):{" "}
                                <span className="tabular-nums text-on-surface">{devCode}</span>
                              </>
                            ) : (
                              "Kode dikirim via WhatsApp. Berlaku 5 menit."
                            )}
                          </p>
                        </div>
                      ) : (
                        <Button onClick={() => void sendOtp()} fullWidth size="lg" loading={otpLoading}>
                          Kirim kode OTP
                        </Button>
                      )}
                      {authError && (
                        <p className="flex items-center gap-2 text-body-md font-semibold text-danger" role="alert">
                          <IconAlert size={16} /> {authError}
                        </p>
                      )}
                    </div>
                  ) : isExpired ? (
                    <div className="flex flex-col items-center gap-4 pt-2 text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-light text-danger">
                        <IconAlert size={26} />
                      </span>
                      <div>
                        <p className="text-headline-sm text-on-surface">
                          Waktu pembayaran habis
                        </p>
                        <p className="mt-1 max-w-sm text-body-md text-slate-whisper">
                          Batas 15 menit terlewati — slot otomatis dibuka kembali. Silakan pilih
                          jam lagi untuk membuat booking baru.
                        </p>
                      </div>
                      <Button onClick={backToSlots} fullWidth size="lg">
                        Pilih slot lagi
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 pt-2">
                      <div className="flex items-center gap-2 text-label-md text-on-surface">
                        <IconClock size={16} /> Selesaikan pembayaran dalam{" "}
                        <Countdown
                          key={holdExpiry ?? "default"}
                          seconds={holdSeconds}
                        />
                      </div>
                      <p className="text-body-sm tabular-nums text-slate-whisper">
                        Kode booking: {ticketCode ?? "—"}
                        {payOrderId ? ` · Order: ${payOrderId}` : ""}
                      </p>
                      {payLoading && !qrString ? (
                        <p className="text-body-md text-slate-whisper">
                          Menyiapkan QR pembayaran…
                        </p>
                      ) : qrString ? (
                        <>
                          <QRBox text={qrString} size={168} />
                          <p className="max-w-full break-all rounded-lg bg-mist-shadow px-3 py-2 font-mono text-body-sm tabular-nums text-slate-whisper">
                            {qrString}
                          </p>
                        </>
                      ) : null}
                      {payError && (
                        <p
                          className="flex items-center gap-2 text-body-md font-semibold text-danger"
                          role="alert"
                        >
                          <IconAlert size={16} /> {payError}
                        </p>
                      )}
                      <div className="text-center">
                        <p className="text-headline-md tabular-nums text-on-surface">
                          {formatRupiah(subtotal)}
                        </p>
                        <p className="mt-1 text-body-md text-slate-whisper">
                          Scan dengan aplikasi e-wallet atau m-banking.
                        </p>
                      </div>
                      <div className="w-full space-y-2">
                        <Button
                          onClick={() => void simulatePay()}
                          fullWidth
                          size="lg"
                          loading={simulating}
                          disabled={!payOrderId}
                        >
                          {simulating ? "Memverifikasi pembayaran…" : "Saya sudah bayar"}
                        </Button>
                        <Button
                          variant="secondary"
                          fullWidth
                          onClick={() =>
                            ticketCode ? void refreshPayStatus(ticketCode) : undefined
                          }
                        >
                          Cek status pembayaran
                        </Button>
                        <Button variant="secondary" fullWidth onClick={() => setStep("identitas")}>
                          Batal pembayaran
                        </Button>
                      </div>
                      <p className="flex items-start gap-2 rounded-xl bg-mist-shadow px-3 py-2.5 text-body-sm text-slate-whisper">
                        <IconInfo size={14} className="mt-0.5 shrink-0" /> Status booking:{" "}
                        <span className="text-on-surface">Menunggu pembayaran</span>. Jika tidak
                        dibayar 15 menit, slot otomatis dibuka kembali.
                      </p>
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
          </div>

          {/* Ringkasan */}
          <aside className="lg:col-span-4">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl bg-field-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-headline-sm text-on-surface">Ringkasan Pesanan</h2>
                  <span className="rounded-full bg-court-grass-light px-2.5 py-1 text-label-sm text-court-green-deep">
                    {sortedSelected.length} Jam Terpilih
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-mist-shadow p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label-md text-on-surface">{court?.name ?? "Belum ada lapangan"}</p>
                      <p className="mt-0.5 text-body-sm text-slate-whisper">{shortDateLabel(date)}</p>
                    </div>
                    <span className="shrink-0 text-label-md tabular-nums text-on-surface">
                      {formatRupiah(subtotal)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sortedSelected.map((item) => (
                      <span
                        key={`${item.courtId}-${item.hour}`}
                        className="inline-flex items-center gap-1 rounded-md bg-primary-container px-2 py-1 text-label-sm text-field-white"
                      >
                        <MIcon name="schedule" className="text-[14px]" />
                        {hourLabel(item.hour, item.hour + 1).replace(" WIB", "")}
                      </span>
                    ))}
                    {sortedSelected.length === 0 && (
                      <span className="text-body-sm text-slate-whisper">
                        Pilih jam terlebih dahulu.
                      </span>
                    )}
                  </div>
                </div>

                <dl className="mt-4 space-y-2.5 text-body-md">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-whisper">Tanggal</dt>
                    <dd className="text-right text-on-surface">{shortDateLabel(date)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-whisper">Durasi</dt>
                    <dd className="tabular-nums text-on-surface">{sortedSelected.length} jam</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-whisper">Slot</dt>
                    <dd className="text-right tabular-nums text-on-surface">{timeRange}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-line pt-3">
                    <dt className="text-label-lg text-on-surface">Total Pembayaran</dt>
                    <dd className="text-headline-md tabular-nums text-court-green-deep">
                      {formatRupiah(subtotal)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 space-y-2">
                  {step === "tanggal" && (
                    <p className="text-center text-body-sm text-slate-whisper">
                      Pilih hari untuk melihat jam yang tersedia.
                    </p>
                  )}
                  {step === "slot" && (
                    <Button
                      fullWidth
                      size="lg"
                      disabled={selected.length === 0}
                      onClick={() => setStep("review")}
                      icon={<IconArrowRight size={18} />}
                    >
                      Lanjut ({sortedSelected.length} jam)
                    </Button>
                  )}
                  {step === "review" && (
                    <Button
                      fullWidth
                      size="lg"
                      onClick={() => setStep("identitas")}
                      icon={<IconArrowRight size={18} />}
                    >
                      Lanjut ke kontak &amp; OTP
                    </Button>
                  )}
                  {step === "identitas" && !otpSent && (
                    <Button fullWidth size="lg" onClick={sendOtp}>
                      Kirim kode OTP
                    </Button>
                  )}
                  {step === "identitas" && otpSent && (
                    <Button fullWidth size="lg" onClick={verifyOtp}>
                      Verifikasi &amp; bayar QRIS
                    </Button>
                  )}
                  {step === "pembayaran" && !isExpired && (
                    <Button
                      fullWidth
                      size="lg"
                      loading={simulating}
                      disabled={!payOrderId}
                      onClick={() => void simulatePay()}
                    >
                      {simulating ? "Memverifikasi…" : "Saya sudah bayar"}
                    </Button>
                  )}
                  {step === "pembayaran" && isExpired && (
                    <Button fullWidth size="lg" onClick={backToSlots}>
                      Pilih slot lagi
                    </Button>
                  )}
                </div>

                <p className="mt-4 flex items-start gap-2 rounded-xl bg-mist-shadow p-3 text-body-sm text-slate-whisper">
                  <MIcon name="shield" className="mt-0.5 text-[16px] text-court-green-deep" />
                  Pembatalan gratis hingga 6 jam sebelum jam bermain. Pengembalian dana 100%
                  otomatis via sistem.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-field-white p-4 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-court-grass-light text-court-green-deep">
                  <MIcon name="pin_drop" className="text-[20px]" />
                </span>
                <div>
                  <p className="text-label-md text-on-surface">PadelClub Arena Cilandak</p>
                  <p className="text-body-sm text-slate-whisper">
                    Jl. TB Simatupang No. 18, Jakarta Selatan
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Bar bawah mobile */}
      {(step === "slot" || step === "review" || step === "identitas") && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-field-white/95 p-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-1">
            <div>
              <p className="text-body-sm text-slate-whisper">Total · {sortedSelected.length} jam</p>
              <p className="text-headline-sm tabular-nums text-on-surface">
                {formatRupiah(subtotal)}
              </p>
            </div>
            <Button
              disabled={step === "slot" && selected.length === 0}
              onClick={() =>
                setStep(
                  step === "slot" ? "review" : step === "review" ? "identitas" : "pembayaran",
                )
              }
              icon={<IconArrowRight size={18} />}
            >
              {step === "slot" ? "Lanjut" : step === "review" ? "Checkout" : "Bayar QRIS"}
            </Button>
          </div>
        </div>
      )}

      {step === "selesai" && ticketCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/55 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardBody className="flex flex-col items-center gap-4 p-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-court-grass-light text-primary-container">
                <IconCheckCircle size={32} />
              </span>
              <div>
                <h2 className="text-headline-md text-on-surface">Booking terkonfirmasi!</h2>
                <p className="mt-1 text-body-md text-slate-whisper">
                  Pembayaran berhasil. Kode booking Anda:
                </p>
                <p className="mt-2 font-mono text-headline-lg tracking-wider text-court-green-deep">
                  {ticketCode}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2">
                <ButtonLink href={`/tiket/${ticketCode}`} fullWidth size="lg">
                  Lihat tiket
                </ButtonLink>
                <ButtonLink href="/" variant="secondary" fullWidth>
                  Kembali ke beranda
                </ButtonLink>
              </div>
              <p className="flex items-center gap-1.5 text-body-sm text-slate-whisper">
                <IconChevronLeft size={14} /> Tiket juga dikirim via WhatsApp &amp; email.
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
