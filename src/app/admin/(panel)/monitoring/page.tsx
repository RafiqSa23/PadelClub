"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Toggle } from "@/components/ui/Toggle";
import { MIcon } from "@/components/ui/MIcon";
import { Toast } from "@/components/ui/Toast";
import { Brand } from "@/components/layout/Brand";
import { cn } from "@/lib/cn";
import { BOOKINGS, COURTS, businessHours, generateDaySlots } from "@/lib/mock";
import { formatRupiah, todayString } from "@/lib/format";

type Theme = "green" | "amber" | "blue";

const themeStyles: Record<Theme, string> = {
  green: "bg-court-green-deep text-field-white",
  amber: "bg-pending text-on-surface",
  blue: "bg-confirmed text-field-white",
};

const QUICK_LINKS = [
  { icon: "calendar_month", label: "Matriks Slot Booking", path: "/booking" },
  { icon: "confirmation_number", label: "Cek & Unduh E-Ticket", path: "/tiket" },
  { icon: "near_me", label: "Petunjuk Arah & Parkir", path: "/#lokasi" },
];

interface NotifyLog {
  id: number;
  bookingId: number | null;
  code: string | null;
  channel: "whatsapp" | "email";
  type: "tiket" | "pengingat_h1" | "pengingat_h2" | "sisa_pembayaran" | "kadaluarsa";
  status: "terkirim" | "gagal";
  sentAt: string;
  error: string | null;
}

const NOTIFY_TYPE_LABEL: Record<NotifyLog["type"], string> = {
  tiket: "Tiket",
  pengingat_h1: "H-1",
  pengingat_h2: "H-2 jam",
  sisa_pembayaran: "Sisa bayar",
  kadaluarsa: "Kedaluwarsa",
};

export default function AdminMonitoringPage() {
  const [bannerActive, setBannerActive] = useState(true);
  const [bannerText, setBannerText] = useState(
    "Promo Weekend: sesi malam Lapangan 3 & 4 dapat slot favorit lebih awal!",
  );
  const [theme, setTheme] = useState<Theme>("green");
  const [draftBanner, setDraftBanner] = useState(bannerText);
  const [draftTheme, setDraftTheme] = useState<Theme>("green");
  const [advance7, setAdvance7] = useState(true);
  const [otpRequired, setOtpRequired] = useState(true);
  const [holdSlot, setHoldSlot] = useState("10");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [toast, setToast] = useState<string | undefined>();
  const [notifyLogs, setNotifyLogs] = useState<NotifyLog[]>([]);
  const [notifyError, setNotifyError] = useState<string | undefined>();

  // Log notifikasi real (audit F6) — 20 terbaru.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/notifications?limit=20", { cache: "no-store" });
        if (res.status === 401) return;
        const json = (await res.json()) as { ok: boolean; logs?: NotifyLog[] };
        if (!cancelled && json.ok && json.logs) setNotifyLogs(json.logs);
      } catch {
        if (!cancelled) setNotifyError("Log notifikasi gagal dimuat.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const slots = useMemo(() => generateDaySlots(todayString()), []);
  const courts = COURTS.filter((court) => court.isActive);

  const todayBookings = useMemo(() => {
    if (typeof window === "undefined") return BOOKINGS;
    try {
      const session = JSON.parse(
        window.localStorage.getItem("padelclub_session_bookings") ?? "[]",
      ) as typeof BOOKINGS;
      return [...session, ...BOOKINGS];
    } catch {
      return BOOKINGS;
    }
  }, []);

  const bookedToday = todayBookings.filter(
    (booking) => booking.date === todayString() && booking.status !== "dibatalkan",
  );
  const capacity = slots.length;
  const revenue = bookedToday
    .filter((booking) => booking.paymentStatus === "paid")
    .reduce((sum, booking) => sum + booking.subtotal, 0);

  function notify(message: string) {
    setToast(message);
  }

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(message);
    } catch {
      notify("Gagal menyalin ke clipboard.");
    }
  }

  return (
    <AdminShell title="Monitoring & Hub Web Publik">
      {/* Sub-header */}
      <div className="flex flex-col gap-6 rounded-2xl bg-field-white p-5 shadow-sm sm:p-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-headline-md text-on-surface">Monitoring &amp; Hub Web Publik</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-court-grass-light px-2.5 py-0.5 text-label-sm font-bold text-court-green-deep">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Live 142ms
            </span>
          </div>
          <p className="mt-1 text-body-md text-slate-whisper">
            Kelola status etalase online, broadcast promo, dan pratinjau langsung alur pemesanan
            pelanggan secara real-time.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-mist-shadow px-2.5 py-1 text-label-sm text-slate-whisper">
            <MIcon name="info" className="text-[15px]" />
            Panel ini pratinjau demo — kecuali seksi Log Notifikasi yang datanya real. Toggle
            maintenance di bawah nonaktif dan tidak memengaruhi web publik.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1.5">
            <MIcon name="verified" className="text-[18px] text-primary" />
            <span className="text-label-sm font-semibold text-on-surface">
              Web Menerima Reservasi
            </span>
            <span
              title="Kontrol demo — tidak memengaruhi web publik"
              className="ml-1 cursor-not-allowed rounded-full bg-field-white px-2 py-0.5 text-label-sm font-semibold text-slate-whisper opacity-70"
            >
              Mode Maintenance (Demo)
            </span>
          </div>
          <button
            type="button"
            onClick={() => copy(window.location.origin, "Link web publik disalin.")}
            className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-surface-container-high px-4 text-label-md text-on-surface transition-all hover:bg-surface-variant"
          >
            <MIcon name="link" className="text-[18px]" />
            Salin Link
          </button>
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary-container px-5 text-label-md font-bold text-field-white shadow-sm transition-all hover:bg-court-green-deep"
          >
            Buka Web Publik
            <MIcon name="arrow_outward" className="text-[18px]" />
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* KPI */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-field-white p-5 shadow-sm">
            <div className="flex min-w-0 flex-col">
              <span className="text-label-sm uppercase tracking-wider text-slate-whisper">
                Pengunjung Aktif
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-headline-lg text-on-surface">38</span>
                <span className="inline-flex items-center gap-1 text-label-sm font-bold text-primary">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
                  Live Online
                </span>
              </div>
              <span className="mt-1 text-body-sm text-slate-whisper">82% via perangkat mobile</span>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-court-grass-light text-court-green-deep">
              <MIcon name="groups" className="text-[26px]" />
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-field-white p-5 shadow-sm">
            <div className="flex min-w-0 flex-col">
              <span className="text-label-sm uppercase tracking-wider text-slate-whisper">
                Booking Hari Ini
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-headline-lg text-on-surface">{bookedToday.length}</span>
                <span className="text-label-sm font-bold text-court-green-deep">
                  / {capacity} slot
                </span>
              </div>
              <span className="mt-1 text-body-sm text-slate-whisper">
                {formatRupiah(revenue)} (QRIS instan)
              </span>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-court-grass-light text-court-green-deep">
              <MIcon name="trending_up" className="text-[26px]" />
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-field-white p-5 shadow-sm">
            <div className="flex min-w-0 flex-col">
              <span className="text-label-sm uppercase tracking-wider text-slate-whisper">
                Slot Terbooking via Web
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-headline-lg text-court-green-deep">
                  {bookedToday.filter((booking) => booking.source === "online").length}
                </span>
                <span className="text-label-sm text-slate-whisper">/ {capacity} kapasitas</span>
              </div>
              <span className="mt-1 text-body-sm font-semibold text-on-surface">
                {formatRupiah(revenue)} (QRIS instan)
              </span>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-on-surface">
              <MIcon name="sports_tennis" className="text-[26px]" />
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-field-white p-5 shadow-sm">
            <div className="flex min-w-0 flex-col">
              <span className="text-label-sm uppercase tracking-wider text-slate-whisper">
                Latensi QRIS &amp; Tiket
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-headline-lg text-on-surface">11.4s</span>
                <span className="text-label-sm font-bold text-primary">Optimal</span>
              </div>
              <span className="mt-1 text-body-sm text-slate-whisper">
                Rata-rata webhook settlement
              </span>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-on-surface">
              <MIcon name="speed" className="text-[26px]" />
            </span>
          </div>
        </div>

        {/* Workspace */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Log notifikasi (audit F6) */}
          <div className="rounded-2xl bg-field-white p-5 shadow-sm sm:p-6 lg:col-span-12">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <MIcon name="notifications" className="text-[22px] text-court-green-deep" />
                <h2 className="text-headline-sm text-on-surface">Log Notifikasi</h2>
              </div>
              <span className="text-body-sm text-slate-whisper">
                Tiket, pengingat H-1/H-2 jam &amp; kedaluwarsa · 20 terbaru
              </span>
            </div>
            {notifyError ? (
              <p className="mt-3 text-body-sm text-slate-whisper">{notifyError}</p>
            ) : notifyLogs.length === 0 ? (
              <p className="mt-3 text-body-sm text-slate-whisper">
                Belum ada notifikasi terkirim. Pengingat terjadwal jalan tiap 5 menit via cron.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-body-sm">
                  <thead>
                    <tr className="border-b border-line text-label-sm uppercase tracking-wider text-slate-whisper">
                      <th className="py-2 pr-3 font-semibold">Waktu</th>
                      <th className="py-2 pr-3 font-semibold">Kode</th>
                      <th className="py-2 pr-3 font-semibold">Tipe</th>
                      <th className="py-2 pr-3 font-semibold">Kanal</th>
                      <th className="py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifyLogs.map((log) => (
                      <tr key={log.id} className="border-b border-line/60 last:border-0">
                        <td className="py-2 pr-3 tabular-nums text-slate-whisper">
                          {new Date(log.sentAt).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2 pr-3 font-mono text-on-surface">
                          {log.code ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-on-surface">
                          {NOTIFY_TYPE_LABEL[log.type]}
                        </td>
                        <td className="py-2 pr-3 capitalize text-slate-whisper">
                          {log.channel}
                        </td>
                        <td className="py-2">
                          {log.status === "terkirim" ? (
                            <span className="rounded-full bg-court-grass-light px-2 py-0.5 text-label-sm font-bold text-court-green-deep">
                              Terkirim
                            </span>
                          ) : (
                            <span
                              className="rounded-full bg-danger-light px-2 py-0.5 text-label-sm font-bold text-danger"
                              title={log.error ?? ""}
                            >
                              Gagal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Simulator */}
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
            <div className="overflow-hidden rounded-2xl bg-field-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-error/70" />
                    <span className="h-3 w-3 rounded-full bg-pending-amber/80" />
                    <span className="h-3 w-3 rounded-full bg-primary/70" />
                  </div>
                  <div className="flex min-w-0 max-w-xs items-center gap-2 rounded-lg bg-field-white px-3 py-1 shadow-sm md:max-w-sm">
                    <MIcon name="lock" className="text-[16px] text-court-green-deep" />
                    <span className="truncate font-mono text-label-sm text-on-surface">
                      padelclub.id/booking
                    </span>
                    <span className="ml-auto text-[11px] text-slate-whisper/60">Simatupang-HQ</span>
                  </div>
                </div>
                <div className="flex items-center rounded-lg bg-field-white p-0.5 shadow-sm">
                  {(["desktop", "mobile"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewport(mode)}
                      className={cn(
                        "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-label-sm transition-all",
                        viewport === mode
                          ? "bg-court-grass-light font-bold text-court-green-deep"
                          : "text-slate-whisper hover:text-on-surface",
                      )}
                    >
                      <MIcon
                        name={mode === "desktop" ? "desktop_windows" : "smartphone"}
                        className="text-[16px]"
                      />
                      {mode === "desktop" ? "Desktop" : "Mobile"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between bg-court-grass-light px-4 py-2 text-court-green-deep">
                <div className="flex items-center gap-2">
                  <MIcon name="visibility" className="text-[18px]" />
                  <span className="text-label-sm font-bold">
                    Mode Pratinjau Operator: simulasi tampilan pemesan pelanggan
                  </span>
                  <span className="rounded-full bg-field-white/20 px-2 py-0.5 text-label-sm font-bold">
                    Demo
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => notify("Pratinjau dimuat ulang.")}
                  className="cursor-pointer text-label-sm font-bold underline hover:text-primary"
                >
                  Muat Ulang
                </button>
              </div>

              <div className="flex justify-center bg-mist-shadow p-5">
                <div
                  className={cn(
                    "flex w-full flex-col overflow-hidden rounded-xl bg-field-white shadow-md transition-all",
                    viewport === "mobile" ? "max-w-[360px]" : "max-w-full",
                  )}
                >
                  {bannerActive && (
                    <div className={cn("flex items-center justify-center gap-2 px-4 py-2.5 text-center", themeStyles[theme])}>
                      <MIcon name="campaign" className="text-[18px]" />
                      <span className="text-label-md font-bold">{bannerText}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Brand />
                    </div>
                    <div className="hidden items-center gap-4 text-label-md text-slate-whisper sm:flex">
                      <span className="cursor-pointer font-bold text-court-green-deep">
                        Sewa Lapangan
                      </span>
                      <span className="cursor-pointer hover:text-on-surface">Jadwal</span>
                      <span className="cursor-pointer hover:text-on-surface">Lokasi</span>
                    </div>
                    <span className="rounded-full bg-court-grass-light px-3 py-1.5 text-label-sm font-bold text-court-green-deep">
                      Cek E-Ticket
                    </span>
                  </div>

                  <div className="flex flex-col gap-4 p-5">
                    <div className="flex max-w-xl flex-col gap-2">
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-0.5 text-label-sm font-semibold text-on-surface">
                        <MIcon name="bolt" className="text-[14px] text-court-green-deep" />
                        Pemesanan Instan: 3 Klik &amp; 2 Menit
                      </span>
                      <h2 className="text-headline-lg text-on-surface">
                        Sewa Lapangan Padel Cepat &amp; Tanpa Friksi
                      </h2>
                      <p className="text-body-md text-slate-whisper">
                        Pilih lapangan, tentukan waktu main, dan dapatkan QR e-tiket otomatis via
                        WhatsApp.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {courts.slice(0, 2).map((court) => {
                        const hours = businessHours(court.id);
                        const preview = hours
                          .map((hour) => slots.find((slot) => slot.courtId === court.id && slot.hour === hour))
                          .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot))
                          .slice(0, 3);
                        return (
                          <div key={court.id} className="flex flex-col gap-2 rounded-xl bg-mist-shadow p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                                <span className="text-label-md font-bold text-on-surface">
                                  {court.name}
                                </span>
                              </div>
                              <span className="text-label-sm font-bold text-primary">
                                {formatRupiah(court.hourlyPrice)}/jam
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {preview.map((slot) => (
                                <button
                                  key={slot.hour}
                                  type="button"
                                  disabled={slot.status !== "kosong"}
                                  className={cn(
                                    "rounded-lg px-1 py-2 text-center text-label-sm font-bold transition-all",
                                    slot.status === "kosong"
                                      ? "bg-field-white text-court-green-deep shadow-sm hover:bg-court-grass-light"
                                      : slot.status === "terkonfirmasi"
                                        ? "bg-court-green-deep text-field-white"
                                        : "cursor-not-allowed bg-surface-container-high text-slate-whisper opacity-60",
                                  )}
                                >
                                  {String(slot.hour).padStart(2, "0")}:00
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-3">
                      <div className="flex items-center gap-2">
                        <MIcon name="security" className="text-[20px] text-court-green-deep" />
                        <span className="text-body-sm text-slate-whisper">
                          Pemesanan publik dilindungi enkripsi transaksi SSL 256-bit &amp;
                          verifikasi WhatsApp OTP.
                        </span>
                      </div>
                      <span className="text-label-sm font-bold text-court-green-deep">
                        PadelClub Tech
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-5 py-3 text-label-sm text-slate-whisper">
                <span>
                  Resolusi simulator:{" "}
                  <strong className="text-on-surface">
                    {viewport === "desktop" ? "100% (Responsive Desktop)" : "360px (Mobile)"}
                  </strong>
                </span>
                <span>
                  Status:{" "}
                  <strong className="text-on-surface">
                    Production
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Kontrol kanan */}
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
            <div className="flex flex-col gap-4 rounded-2xl bg-field-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <MIcon name="campaign" className="text-[22px] text-court-green-deep" />
                  <h2 className="text-headline-sm text-on-surface">Broadcast Pengumuman Web</h2>
                </div>
                <span className="rounded-full bg-court-grass-light px-2.5 py-0.5 text-label-sm font-bold text-court-green-deep">
                  {bannerActive ? "Aktif di Publik" : "Nonaktif"}
                </span>
              </div>
              <p className="text-body-sm text-slate-whisper">
                Pesan banner muncul di baris paling atas situs publik secara langsung tanpa deploy
                ulang server.
              </p>
              <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-3.5">
                <span className="text-label-md font-bold text-on-surface">
                  Tampilkan banner di web publik
                </span>
                <Toggle checked={bannerActive} onChange={setBannerActive} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="banner-input" className="text-label-sm font-bold text-on-surface">
                  Isi teks pengumuman
                </label>
                <textarea
                  id="banner-input"
                  rows={3}
                  value={draftBanner}
                  onChange={(event) => setDraftBanner(event.target.value)}
                  className="w-full resize-none rounded-xl bg-surface-container-low p-3.5 text-body-md text-on-surface focus:bg-field-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-label-sm font-bold text-on-surface">Tema aksen banner</span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: "green", label: "Hijau Brand", dot: "bg-court-green-deep" },
                      { key: "amber", label: "Oranye Promo", dot: "bg-pending-amber" },
                      { key: "blue", label: "Biru Info", dot: "bg-confirmed-blue" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setDraftTheme(option.key)}
                      className={cn(
                        "flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-label-sm font-bold shadow-sm transition-all",
                        draftTheme === option.key
                          ? "bg-court-grass-light text-court-green-deep"
                          : "bg-surface-container-low text-slate-whisper hover:text-on-surface",
                      )}
                    >
                      <span className={cn("h-2.5 w-2.5 rounded-full", option.dot)} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBannerText(draftBanner);
                  setTheme(draftTheme);
                  notify("Broadcast diterapkan ke web publik.");
                }}
                className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary-container text-label-md font-bold text-field-white shadow-sm transition-all hover:bg-court-green-deep"
              >
                <MIcon name="publish" className="text-[18px]" />
                Terapkan ke Web Publik
              </button>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl bg-field-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2.5">
                <MIcon name="tune" className="text-[22px] text-court-green-deep" />
                <h2 className="text-headline-sm text-on-surface">Aturan Akses Booking Online</h2>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-3.5">
                <div className="min-w-0">
                  <span className="block text-label-md font-bold text-on-surface">
                    Reservasi terbuka H+7 hari
                  </span>
                  <span className="text-body-sm text-slate-whisper">
                    Pelanggan dapat memesan slot hingga 7 hari ke depan
                  </span>
                </div>
                <Toggle checked={advance7} onChange={setAdvance7} className="shrink-0" />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-3.5">
                <div className="min-w-0">
                  <span className="block text-label-md font-bold text-on-surface">
                    Wajib OTP WhatsApp
                  </span>
                  <span className="text-body-sm text-slate-whisper">
                    Cegah bot booking dengan verifikasi kode 6 digit
                  </span>
                </div>
                <Toggle checked={otpRequired} onChange={setOtpRequired} className="shrink-0" />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3.5">
                <div className="min-w-0">
                  <span className="block text-label-md font-bold text-on-surface">
                    Batas hold slot QRIS
                  </span>
                  <span className="text-body-sm text-slate-whisper">
                    Durasi kunci slot saat menunggu bayar
                  </span>
                </div>
                <select
                  value={holdSlot}
                  onChange={(event) => setHoldSlot(event.target.value)}
                  aria-label="Batas hold slot QRIS"
                  className="shrink-0 cursor-pointer rounded-lg bg-field-white px-3 py-1.5 text-label-md font-bold text-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="5">5 Menit</option>
                  <option value="10">10 Menit</option>
                  <option value="15">15 Menit</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl bg-field-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2.5">
                <MIcon name="share" className="text-[22px] text-court-green-deep" />
                <h2 className="text-headline-sm text-on-surface">Tautan Cepat Navigasi Publik</h2>
              </div>
              <p className="text-body-sm text-slate-whisper">
                Salin tautan instan untuk dibagikan ke Instagram Bio, broadcast WhatsApp, atau
                brosur digital.
              </p>
              {QUICK_LINKS.map((item) => (
                <div
                  key={item.path}
                  className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3.5 transition-all hover:bg-surface-container-high"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-court-grass-light text-court-green-deep">
                      <MIcon name={item.icon} className="text-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-label-md font-bold text-on-surface">
                        {item.label}
                      </span>
                      <span className="block truncate font-mono text-body-sm text-slate-whisper">
                        padelclub.id{item.path === "/#lokasi" ? "/lokasi" : item.path}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copy(
                        `${window.location.origin}${item.path}`,
                        `${item.label} disalin.`,
                      )
                    }
                    className="flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-field-white px-3 py-1.5 text-label-sm font-bold text-court-green-deep shadow-sm transition-all hover:bg-court-grass-light"
                  >
                    <MIcon name="content_copy" className="text-[16px]" />
                    Salin
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Toast open={!!toast} message={toast ?? ""} onClose={() => setToast(undefined)} tone="success" />
    </AdminShell>
  );
}
