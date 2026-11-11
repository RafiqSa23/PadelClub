"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Stepper } from "@/components/ui/Stepper";
import { SlotCell } from "@/components/ui/SlotCell";
import { QRBox } from "@/components/ui/QRBox";
import { Countdown } from "@/components/ui/Countdown";
import { PhoneInput, TextInput } from "@/components/ui/Input";
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
import { isValidPhone } from "@/lib/phone";
import {
  findSnapScript,
  notifySnapReady,
  SNAP_SCRIPT_ATTR,
  useSnapReady,
} from "@/lib/use-snap";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"masuk" | "daftar">("masuk");
  const [authError, setAuthError] = useState<string | undefined>();
  const [simulating, setSimulating] = useState(false);
  const [ticketCode, setTicketCode] = useState<string | undefined>();
  const [authLoading, setAuthLoading] = useState(false);
  const [holdExpiry, setHoldExpiry] = useState<string | undefined>();
  const [holdSeconds, setHoldSeconds] = useState(15 * 60);
  // State pembayaran (Batch 4 mock → P1 Midtrans sandbox → ADR 0008 Snap popup).
  const [qrString, setQrString] = useState<string | undefined>();
  const [qrImageUrl, setQrImageUrl] = useState<string | undefined>();
  const [snapToken, setSnapToken] = useState<string | undefined>();
  const [snapRedirectUrl, setSnapRedirectUrl] = useState<string | undefined>();
  const [payGateway, setPayGateway] = useState<string | undefined>();
  const [payOrderId, setPayOrderId] = useState<string | undefined>();
  const [payError, setPayError] = useState<string | undefined>();
  const [payInfo, setPayInfo] = useState<string | undefined>();
  const [payFailed, setPayFailed] = useState<string | undefined>();
  const snapReady = useSnapReady();
  const [payLoading, setPayLoading] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const router = useRouter();
  // Guard anti-redirect ganda (polling 5 dtk bisa deteksi sukses berulang).
  const hasRedirected = useRef(false);
  const redirectTimer = useRef<number | undefined>(undefined);
  // Guard auto-buka popup Snap sekali per token (tidak dibuka ulang saat re-render).
  const autoOpenedFor = useRef<string | null>(null);

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

  async function createBooking() {
    if (!court) {
      setAuthError("Pilih slot terlebih dahulu.");
      return;
    }
    setAuthError(undefined);
    setAuthLoading(true);
    try {
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
      setPayInfo(undefined);
      setPayFailed(undefined);
      autoOpenedFor.current = null;
      setStep("pembayaran");
      void loadCharge(bjson.booking.code);
    } catch {
      setAuthError("Tidak dapat terhubung ke server.");
    } finally {
      setAuthLoading(false);
    }
  }

  /** Cek sesi lebih dulu — akun yang sudah login langsung membuat booking. */
  async function goCheckout() {
    setAuthError(undefined);
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        await createBooking();
        return;
      }
      setStep("identitas");
    } catch {
      setStep("identitas");
    } finally {
      setAuthLoading(false);
    }
  }

  async function submitAccount() {
    if (authMode === "daftar" && !name.trim()) {
      setAuthError("Nama wajib diisi.");
      return;
    }
    if (!email.trim() || !password) {
      setAuthError("Email dan password wajib diisi.");
      return;
    }
    if (authMode === "daftar" && password.length < 8) {
      setAuthError("Password minimal 8 karakter.");
      return;
    }
    if (authMode === "daftar" && !isValidPhone(phone)) {
      setAuthError("Nomor HP tidak valid (contoh: 0812…).");
      return;
    }
    setAuthError(undefined);
    setAuthLoading(true);
    try {
      const endpoint = authMode === "daftar" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        authMode === "daftar"
          ? { name: name.trim(), email: email.trim(), password, phone }
          : { email: email.trim(), password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        setAuthError(json.message ?? "Gagal masuk. Periksa data Anda.");
        return;
      }
      await createBooking();
    } catch {
      setAuthError("Tidak dapat terhubung ke server.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadCharge(code: string) {
    setPayLoading(true);
    setPayError(undefined);
    setPayInfo(undefined);
    setPayFailed(undefined);
    try {
      const res = await fetch(`/api/payments/${code}/charge`, { method: "POST" });
      const json = (await res.json()) as {
        ok: boolean;
        message?: string;
        payment?: {
          orderId: string;
          qrString: string | null;
          qrImageUrl?: string | null;
          snapToken?: string | null;
          redirectUrl?: string | null;
          gateway?: string;
        };
      };
      if (!json.ok || !json.payment) {
        setPayError(json.message ?? "Gagal membuat pembayaran.");
        if (!res.ok && res.status === 409) setIsExpired(true);
        return;
      }
      setQrString(json.payment.qrString ?? undefined);
      setQrImageUrl(json.payment.qrImageUrl ?? undefined);
      setSnapToken(json.payment.snapToken ?? undefined);
      setSnapRedirectUrl(json.payment.redirectUrl ?? undefined);
      setPayGateway(json.payment.gateway);
      setPayOrderId(json.payment.orderId);
    } catch {
      setPayError("Tidak dapat terhubung ke server.");
    } finally {
      setPayLoading(false);
    }
  }

  const refreshPayStatus = useCallback(async (code: string): Promise<string | undefined> => {
    try {
      const res = await fetch(`/api/payments/${code}/status`);
      const json = (await res.json()) as {
        ok: boolean;
        booking?: { status: string };
        payment?: {
          qrString: string | null;
          qrImageUrl?: string | null;
          snapToken?: string | null;
          redirectUrl?: string | null;
          orderId: string;
          gateway?: string;
        };
      };
      if (!json.ok || !json.booking) return undefined;
      if (json.payment?.qrString) {
        setQrString(json.payment.qrString);
        setPayOrderId(json.payment.orderId);
      }
      if (json.payment?.qrImageUrl) setQrImageUrl(json.payment.qrImageUrl);
      if (json.payment?.snapToken) {
        setSnapToken(json.payment.snapToken);
        setPayOrderId(json.payment.orderId);
      }
      if (json.payment?.redirectUrl) setSnapRedirectUrl(json.payment.redirectUrl);
      if (json.payment?.gateway) setPayGateway(json.payment.gateway);
      if (json.booking.status === "terkonfirmasi") {
        setPayFailed(undefined);
        setPayError(undefined);
        setStep("selesai");
        // Auto-redirect ke tiket setelah pembayaran berhasil (sekali saja).
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          setRedirecting(true);
          window.clearTimeout(redirectTimer.current);
          redirectTimer.current = window.setTimeout(() => {
            router.replace(`/tiket/${code}`);
          }, 1800);
        }
      } else if (json.booking.status === "dibatalkan") {
        setIsExpired(true);
      }
      return json.booking.status;
    } catch {
      return undefined;
    }
  }, [router]);

  // Bersihkan timer redirect saat halaman dilepas.
  useEffect(() => {
    return () => window.clearTimeout(redirectTimer.current);
  }, []);

  // Muat snap.js Midtrans saat pembayaran Snap aktif (ADR 0008).
  // Ketersediaan client key dihitung saat render (bukan setState di effect).
  const snapConfigured = (process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "").length > 0;
  const snapLoading = payGateway === "midtrans" && snapConfigured && !snapReady;
  useEffect(() => {
    if (payGateway !== "midtrans" || !snapConfigured || snapReady) return;
    // Skrip sudah ada di DOM (dimuat komponen lain / percobaan sebelumnya):
    // jangan buat ulang — cukup tunggu event load lalu beri tahu React.
    const existing = findSnapScript();
    if (existing) {
      const notify = () => notifySnapReady();
      existing.addEventListener("load", notify, { once: true });
      return () => existing.removeEventListener("load", notify);
    }
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "";
    const snapSrc =
      process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true"
        ? "https://app.midtrans.com/snap/snap.js"
        : "https://app.sandbox.midtrans.com/snap/snap.js";
    const script = document.createElement("script");
    script.src = snapSrc;
    script.async = true;
    script.setAttribute("data-client-key", clientKey);
    script.setAttribute(SNAP_SCRIPT_ATTR, "1");
    script.onload = () => notifySnapReady();
    script.onerror = () => {
      setPayError("Gagal memuat jendela pembayaran Midtrans. Periksa koneksi lalu muat ulang.");
    };
    document.body.appendChild(script);
  }, [payGateway, snapConfigured, snapReady]);

  /** Buka popup Snap; sukses/pending dicek ulang via status server. */
  const payWithSnap = useCallback(() => {
    if (!snapToken || !ticketCode) return;
    if (!window.snap) {
      setPayError("Jendela pembayaran belum siap. Tunggu sebentar lalu coba lagi.");
      return;
    }
    setPayError(undefined);
    setPayInfo(undefined);
    setPayFailed(undefined);
    window.snap.pay(snapToken, {
      onSuccess: () => {
        void refreshPayStatus(ticketCode);
      },
      onPending: () => {
        setPayInfo("Pembayaran diterima Midtrans dan sedang diproses — halaman ini otomatis lanjut begitu lunas.");
        void refreshPayStatus(ticketCode);
      },
      onError: () => {
        setPayFailed("Pembayaran gagal diproses oleh Midtrans. Coba lagi atau pilih metode lain.");
      },
      onClose: () => {
        setPayInfo("Jendela pembayaran ditutup — pembayaranmu belum selesai. Klik tombol bayar untuk lanjut.");
      },
    });
  }, [snapToken, ticketCode, refreshPayStatus]);

  // Buka popup Snap otomatis sekali setelah token + snap.js siap.
  // Bila browser memblokir popup, tombol bayar + link tab baru tetap tersedia.
  useEffect(() => {
    if (step !== "pembayaran" || isExpired || payFailed) return;
    if (payGateway !== "midtrans" || !snapToken || !snapReady) return;
    if (typeof window === "undefined" || !window.snap) return;
    if (autoOpenedFor.current === snapToken) return;
    autoOpenedFor.current = snapToken;
    payWithSnap();
  }, [step, isExpired, payFailed, payGateway, snapToken, snapReady, payWithSnap]);

  /** Ulangi pembayaran setelah gagal — ambil token baru lalu buka popup lagi. */
  function retryPay() {
    if (!ticketCode) return;
    setPayFailed(undefined);
    setPayError(undefined);
    setPayInfo(undefined);
    autoOpenedFor.current = null;
    void loadCharge(ticketCode);
  }

  // Polling fallback tiap 5 detik selama menunggu pembayaran (webhook-first).
  useEffect(() => {
    if (step !== "pembayaran" || !ticketCode || isExpired) return;
    const timer = window.setInterval(() => {
      void refreshPayStatus(ticketCode);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [step, ticketCode, isExpired, refreshPayStatus]);

  /** Simulasi bayar — tombolnya hanya tampil saat driver mock. */
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
    window.clearTimeout(redirectTimer.current);
    hasRedirected.current = false;
    setRedirecting(false);
    setIsExpired(false);
    setTicketCode(undefined);
    setQrString(undefined);
    setQrImageUrl(undefined);
    setSnapToken(undefined);
    setSnapRedirectUrl(undefined);
    setPayGateway(undefined);
    setPayOrderId(undefined);
    setPayInfo(undefined);
    setPayFailed(undefined);
    autoOpenedFor.current = null;
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
                      {step === "identitas" ? "Akun pemesan" : "Pembayaran"}
                    </p>
                    <p className="mt-0.5 text-body-sm text-slate-whisper">
                      {court?.name} · {dateLabel(date)} · {timeRange} · {sortedSelected.length} jam
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setStep("review")}>
                    Kembali
                  </Button>
                </div>
                <CardBody className="space-y-4">
                  {step === "identitas" ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-mist-shadow p-1">
                        <button
                          type="button"
                          onClick={() => setAuthMode("masuk")}
                          className={cn(
                            "cursor-pointer rounded-lg py-2 text-label-md transition-colors",
                            authMode === "masuk"
                              ? "bg-field-white text-on-surface shadow-sm"
                              : "text-slate-whisper",
                          )}
                        >
                          Masuk
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthMode("daftar")}
                          className={cn(
                            "cursor-pointer rounded-lg py-2 text-label-md transition-colors",
                            authMode === "daftar"
                              ? "bg-field-white text-on-surface shadow-sm"
                              : "text-slate-whisper",
                          )}
                        >
                          Daftar
                        </button>
                      </div>

                      {authMode === "daftar" && (
                        <>
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
                              autoComplete="name"
                            />
                          </div>
                          <div>
                            <label
                              className="mb-1.5 block text-label-md text-on-surface"
                              htmlFor="b-phone"
                            >
                              Nomor HP
                            </label>
                            <PhoneInput
                              id="b-phone"
                              value={phone}
                              onChange={(event) => setPhone(event.target.value)}
                              placeholder="812 3456 7890"
                            />
                            <p className="mt-1.5 text-body-sm text-slate-whisper">
                              Awalan +62 sudah terisi — cukup tulis 08… atau 812….
                            </p>
                          </div>
                        </>
                      )}

                      <div>
                        <label
                          className="mb-1.5 block text-label-md text-on-surface"
                          htmlFor="b-email"
                        >
                          Email
                        </label>
                        <TextInput
                          id="b-email"
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="nama@email.com"
                          autoComplete="email"
                        />
                      </div>
                      <div>
                        <label
                          className="mb-1.5 block text-label-md text-on-surface"
                          htmlFor="b-password"
                        >
                          Password
                        </label>
                        <TextInput
                          id="b-password"
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Minimal 8 karakter"
                          autoComplete={authMode === "daftar" ? "new-password" : "current-password"}
                        />
                      </div>

                      <Button onClick={() => void submitAccount()} fullWidth size="lg" loading={authLoading}>
                        {authMode === "daftar" ? "Daftar & lanjut bayar" : "Masuk & lanjut bayar"}
                      </Button>
                      <p className="text-body-sm text-slate-whisper">
                        Booking & riwayat tersimpan di akun. Tidak ada OTP; lupa password direset
                        oleh admin.
                      </p>
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
                  ) : payFailed ? (
                    <div className="flex flex-col items-center gap-4 pt-2 text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-light text-danger">
                        <IconAlert size={26} />
                      </span>
                      <div>
                        <p className="text-headline-sm text-on-surface">
                          Pembayaran gagal
                        </p>
                        <p className="mt-1 max-w-sm text-body-md text-slate-whisper">
                          {payFailed}
                        </p>
                        <p className="mt-2 text-body-sm tabular-nums text-slate-whisper">
                          Kode booking: <span className="font-semibold text-on-surface">{ticketCode ?? "—"}</span>
                          {payOrderId ? ` · Order: ${payOrderId}` : ""}
                        </p>
                      </div>
                      <div className="w-full space-y-2">
                        <Button onClick={retryPay} fullWidth size="lg" loading={payLoading}>
                          Coba lagi
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
                        <Button
                          variant="secondary"
                          fullWidth
                          onClick={() => {
                            setPayFailed(undefined);
                            setStep("review");
                          }}
                        >
                          Kembali
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 pt-2">
                      <div className="flex w-full flex-wrap items-center justify-center gap-2 rounded-xl bg-pending-light/60 px-4 py-2.5 text-label-md text-on-surface">
                        <IconClock size={16} /> Selesaikan pembayaran dalam{" "}
                        <Countdown
                          key={holdExpiry ?? "default"}
                          seconds={holdSeconds}
                        />
                      </div>
                      <p className="text-body-sm tabular-nums text-slate-whisper">
                        Kode booking: <span className="font-semibold text-on-surface">{ticketCode ?? "—"}</span>
                        {payOrderId ? ` · Order: ${payOrderId}` : ""}
                      </p>
                      {payLoading && !qrString && !qrImageUrl && !snapToken ? (
                        <p className="text-body-md text-slate-whisper">
                          Menyiapkan pembayaran…
                        </p>
                      ) : snapToken ? (
                        <div className="w-full rounded-xl border border-line bg-field-white px-4 py-5 text-center shadow-sm">
                          <p className="text-label-sm uppercase tracking-wider text-slate-whisper">
                            Total pembayaran
                          </p>
                          <p className="mt-1 text-headline-lg tabular-nums text-on-surface">
                            {formatRupiah(subtotal)}
                          </p>
                          <p className="mt-1 text-body-sm text-slate-whisper">
                            {court?.name} · {dateLabel(date)} · {timeRange}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                            {["QRIS", "VA Bank", "E-Wallet", "Kartu", "Gerai Retail"].map((method) => (
                              <span
                                key={method}
                                className="rounded-md bg-mist-shadow px-2 py-1 text-label-sm font-medium text-on-surface"
                              >
                                {method}
                              </span>
                            ))}
                          </div>
                          <p className="mt-3 flex items-center justify-center gap-1.5 text-body-sm text-slate-whisper">
                            <MIcon name="shield" className="text-[16px] text-court-green-deep" />
                            Pembayaran aman via Midtrans — pilih metodemu di langkah berikut.
                          </p>
                        </div>
                      ) : qrImageUrl ? (
                        <>
                          {/* QR asli Midtrans — bisa dipindai e-wallet/m-banking. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={qrImageUrl}
                            alt="Kode QRIS pembayaran"
                            width={200}
                            height={200}
                            className="rounded-lg border border-line bg-white p-2"
                          />
                          <p className="max-w-full break-all rounded-lg bg-mist-shadow px-3 py-2 font-mono text-body-sm tabular-nums text-slate-whisper">
                            {qrString}
                          </p>
                          <p className="text-headline-md tabular-nums text-on-surface">
                            {formatRupiah(subtotal)}
                          </p>
                        </>
                      ) : qrString ? (
                        <>
                          <QRBox text={qrString} size={168} />
                          <p className="max-w-full break-all rounded-lg bg-mist-shadow px-3 py-2 font-mono text-body-sm tabular-nums text-slate-whisper">
                            {qrString}
                          </p>
                          <p className="text-headline-md tabular-nums text-on-surface">
                            {formatRupiah(subtotal)}
                          </p>
                          <p className="text-body-md text-slate-whisper">
                            Scan dengan aplikasi e-wallet atau m-banking.
                          </p>
                        </>
                      ) : null}
                      {payError && (
                        <p
                          className="flex w-full items-center gap-2 rounded-xl bg-danger-light px-4 py-3 text-body-md font-semibold text-danger"
                          role="alert"
                        >
                          <IconAlert size={16} /> {payError}
                        </p>
                      )}
                      {payInfo && !payError && (
                        <p className="flex w-full items-start gap-2 rounded-xl bg-mist-shadow px-4 py-3 text-body-md text-on-surface">
                          <IconInfo size={16} className="mt-0.5 shrink-0" /> {payInfo}
                        </p>
                      )}
                      <div className="w-full space-y-2">
                        {payGateway === "midtrans" ? (
                          <>
                            {!snapConfigured && (
                              <p
                                className="flex items-start gap-2 rounded-xl bg-pending-light/70 px-4 py-3 text-body-md font-semibold text-pending-ink"
                                role="alert"
                              >
                                <IconAlert size={16} className="mt-0.5 shrink-0" /> Pembayaran
                                belum bisa dibuka otomatis — client key Midtrans belum diisi
                                di .env (tambah NEXT_PUBLIC_MIDTRANS_CLIENT_KEY lalu
                                restart dev server). Sementara itu pakai tautan tab baru di
                                bawah.
                              </p>
                            )}
                            {snapLoading && (
                              <p className="text-center text-body-sm text-slate-whisper">
                                Membuka jendela pembayaran Midtrans…
                              </p>
                            )}
                            <Button
                              onClick={payWithSnap}
                              fullWidth
                              size="lg"
                              loading={payLoading}
                              disabled={!snapToken || !snapConfigured || snapLoading}
                            >
                              Bayar {formatRupiah(subtotal)} Sekarang
                            </Button>
                            {snapRedirectUrl ? (
                              <p className="rounded-xl bg-mist-shadow px-3 py-2.5 text-center text-body-sm text-slate-whisper">
                                Jendela tidak terbuka atau popup terblokir?{" "}
                                <a
                                  href={snapRedirectUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-primary-container underline"
                                >
                                  buka halaman bayar Midtrans di tab baru
                                </a>
                                {" "}— bayar di sana, halaman ini otomatis lanjut ke tiket.
                              </p>
                            ) : null}
                            <p className="flex items-start gap-2 rounded-xl bg-mist-shadow px-3 py-2.5 text-body-sm text-slate-whisper">
                              <IconInfo size={14} className="mt-0.5 shrink-0" /> Setelah
                              membayar, halaman otomatis pindah ke tiket begitu pembayaran
                              terkonfirmasi.
                            </p>
                          </>
                        ) : (
                          <Button
                            onClick={() => void simulatePay()}
                            fullWidth
                            size="lg"
                            loading={simulating}
                            disabled={!payOrderId}
                          >
                            {simulating ? "Memverifikasi pembayaran…" : "Saya sudah bayar"}
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          fullWidth
                          onClick={() =>
                            ticketCode ? void refreshPayStatus(ticketCode) : undefined
                          }
                        >
                          Cek status pembayaran
                        </Button>
                        <Button variant="secondary" fullWidth onClick={() => setStep("review")}>
                          Kembali
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
                      loading={authLoading}
                      onClick={() => void goCheckout()}
                      icon={<IconArrowRight size={18} />}
                    >
                      Lanjut ke pembayaran
                    </Button>
                  )}
                  {step === "pembayaran" && !isExpired && payGateway === "midtrans" && (
                    <Button
                      fullWidth
                      size="lg"
                      loading={payLoading}
                      disabled={!snapToken || !snapConfigured || snapLoading}
                      onClick={payWithSnap}
                    >
                      Bayar {formatRupiah(subtotal)} Sekarang
                    </Button>
                  )}
                  {step === "pembayaran" && !isExpired && payGateway !== "midtrans" && (
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
              {step === "slot" ? "Lanjut" : step === "review" ? "Checkout" : "Bayar"}
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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-court-grass-light px-3 py-1 text-label-sm font-bold uppercase tracking-wider text-court-green-deep">
                  Lunas
                </span>
                <h2 className="mt-2 text-headline-md text-on-surface">Pembayaran berhasil!</h2>
                <p className="mt-1 text-body-md text-slate-whisper">
                  Slot kamu terkunci. Kode booking:
                </p>
                <p className="mt-2 font-mono text-headline-lg tracking-wider text-court-green-deep">
                  {ticketCode}
                </p>
              </div>
              <dl className="w-full space-y-2 rounded-xl bg-mist-shadow p-4 text-left text-body-md">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-whisper">Lapangan</dt>
                  <dd className="text-right font-medium text-on-surface">{court?.name ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-whisper">Jadwal</dt>
                  <dd className="text-right tabular-nums text-on-surface">{shortDateLabel(date)} · {timeRange}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-line pt-2">
                  <dt className="text-slate-whisper">Total dibayar</dt>
                  <dd className="text-right font-bold tabular-nums text-court-green-deep">
                    {formatRupiah(subtotal)}
                  </dd>
                </div>
              </dl>
              <div className="flex w-full flex-col gap-2">
                <ButtonLink href={`/tiket/${ticketCode}`} fullWidth size="lg">
                  Lihat tiket
                </ButtonLink>
                <ButtonLink href="/" variant="secondary" fullWidth>
                  Kembali ke beranda
                </ButtonLink>
              </div>
              <p className="flex items-center gap-1.5 text-body-sm text-slate-whisper">
                {redirecting ? (
                  <>Mengalihkan ke tiket…</>
                ) : (
                  <><IconChevronLeft size={14} /> Tiket juga dikirim via WhatsApp &amp; email.</>
                )}
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
