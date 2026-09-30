"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Toggle } from "@/components/ui/Toggle";
import { MIcon } from "@/components/ui/MIcon";
import { Toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { addDays, todayString } from "@/lib/format";
import type { Slot, SlotStatus } from "@/lib/types";

interface BoardCourt {
  id: number;
  name: string;
  hourlyPrice: number;
  isIndoor: boolean;
  isActive: boolean;
}

interface BoardBooking {
  code: string;
  courtId: number;
  status: string;
  customerName: string | null;
  hours: number[];
}

const DEFAULT_TICKER =
  "Booking mandiri dapat dilakukan lewat situs PadelClub atau scan QR di meja kasir. Harap check-in 10 menit sebelum jam bermain.";

interface SlotGroup {
  status: SlotStatus;
  start: number;
  end: number;
  reason?: string;
  customerName?: string;
}

function groupSlots(slots: Slot[], namesByCode: Map<string, string>): SlotGroup[] {
  const groups: SlotGroup[] = [];
  for (const slot of slots) {
    const last = groups[groups.length - 1];
    if (last && last.status === slot.status && last.end === slot.hour) {
      last.end = slot.hour + 1;
      continue;
    }
    groups.push({
      status: slot.status,
      start: slot.hour,
      end: slot.hour + 1,
      reason: slot.reason,
      customerName: slot.code ? (namesByCode.get(slot.code) ?? undefined) : undefined,
    });
  }
  return groups;
}

function maskName(name: string) {
  return name
    .split(" ")
    .map((word) => (word.length > 2 ? `${word[0]}***` : word))
    .join(" ");
}

export default function AdminPapanJadwalPage() {
  const dates = useMemo(
    () => [todayString(), addDays(todayString(), 1), addDays(todayString(), 2)],
    [],
  );
  const [date, setDate] = useState(dates[0]);
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [maskNames, setMaskNames] = useState(true);
  const [showTimer, setShowTimer] = useState(true);
  const [showSpec, setShowSpec] = useState(true);
  const [ticker, setTicker] = useState(DEFAULT_TICKER);
  const [draftTicker, setDraftTicker] = useState(DEFAULT_TICKER);
  const [now, setNow] = useState(() => new Date());
  const [toast, setToast] = useState<string | undefined>();
  // Data real dari /api/admin/schedule (read-only, refresh 15 dtk).
  const [courts, setCourts] = useState<BoardCourt[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [namesByCode, setNamesByCode] = useState<Map<string, string>>(new Map());
  const [boardError, setBoardError] = useState<string | undefined>();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/admin/schedule?date=${date}`, { cache: "no-store" });
        const json = (await res.json()) as {
          ok: boolean;
          message?: string;
          schedule?: {
            courts: BoardCourt[];
            slots: Slot[];
          };
          bookings?: BoardBooking[];
        };
        if (cancelled) return;
        if (!json.ok || !json.schedule) {
          setBoardError(json.message ?? "Gagal memuat jadwal.");
          return;
        }
        setCourts(json.schedule.courts.filter((court) => court.isActive));
        setSlots(
          json.schedule.slots.map((slot) => ({ ...slot, date })),
        );
        const names = new Map<string, string>();
        for (const booking of json.bookings ?? []) {
          if (booking.customerName) names.set(booking.code, booking.customerName);
        }
        setNamesByCode(names);
        setBoardError(undefined);
      } catch {
        if (!cancelled) setBoardError("Tidak dapat terhubung ke server.");
      }
    }
    void load();
    const refresh = window.setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [date]);

  const isToday = date === todayString();
  const currentHour = now.getHours();
  const visibleCourts =
    courtFilter === "all" ? courts : courts.filter((court) => String(court.id) === courtFilter);

  const courtData = visibleCourts.map((court) => {
    const courtSlots = slots
      .filter((slot) => slot.courtId === court.id)
      .sort((a, b) => a.hour - b.hour);
    const groups = groupSlots(courtSlots, namesByCode);
    const ongoing = isToday && groups.find((g) => g.start <= currentHour && currentHour < g.end && (g.status === "terkonfirmasi" || g.status === "menunggu_pembayaran"));
    return { court, groups, ongoing };
  });

  const emptyCount = slots.filter((slot) => slot.status === "kosong").length;
  const playingCount = courtData.filter((item) => item.ongoing).length;
  const nextStart = courtData
    .flatMap((item) => item.groups)
    .filter((group) => group.start > currentHour && group.status !== "tutup" && group.status !== "kosong")
    .map((group) => group.start)
    .sort((a, b) => a - b)[0];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast("Tautan papan jadwal disalin.");
    } catch {
      setToast("Gagal menyalin tautan.");
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen?.();
    }
  }

  return (
    <AdminShell title="Papan Jadwal Publik">
      <div className="flex w-full flex-col gap-6">
        {/* Sub-header */}
        <div className="flex flex-col gap-5 rounded-2xl bg-field-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-headline-lg text-on-surface">Papan Jadwal Publik</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-court-grass-light px-3 py-0.5 text-label-sm font-bold text-court-green-deep">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary-container" />
                Live Venue Board • TV Sync Aktif
              </span>
            </div>
            <p className="mt-1.5 text-body-md text-slate-whisper">
              Kontrol layar lobi arena, proyeksi proyektor penonton, dan monitor turnamen
              real-time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {[
              { icon: "sports_tennis", label: "Sedang Main", value: `${playingCount} Court Aktif`, tone: "text-court-green-deep" },
              { icon: "event_available", label: "Slot Kosong", value: `${emptyCount} Slot Tersedia`, tone: "text-primary" },
              { icon: "schedule", label: "Sesi Berikutnya", value: nextStart ? `${String(nextStart).padStart(2, "0")}:00 WIB` : "Tidak ada", tone: "text-confirmed-blue" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2.5 rounded-lg bg-surface-container-low px-3 py-2.5"
              >
                <MIcon name={item.icon} className={`text-[20px] ${item.tone}`} />
                <div className="flex flex-col">
                  <span className="text-label-sm text-slate-whisper">{item.label}</span>
                  <span className="text-data-tabular text-on-surface">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-field-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-lg bg-mist-shadow p-1">
              {dates.map((value, index) => {
                const active = value === date;
                const label =
                  index === 0
                    ? "Hari Ini"
                    : index === 1
                      ? "Besok"
                      : new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        });
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDate(value)}
                    className={cn(
                      "min-h-9 cursor-pointer rounded-lg px-3 text-label-md transition-colors",
                      active ? "bg-field-white text-on-surface shadow-sm" : "text-slate-whisper hover:text-on-surface",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <select
              value={courtFilter}
              onChange={(event) => setCourtFilter(event.target.value)}
              aria-label="Filter lapangan"
              className="cursor-pointer rounded-lg bg-mist-shadow px-3 py-2 text-label-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
            >
              <option value="all">Semua Lapangan ({courts.length})</option>
              {courts.map((court) => (
                <option key={court.id} value={String(court.id)}>
                  {court.name} — {court.isIndoor ? "Indoor" : "Outdoor"}
                </option>
              ))}
            </select>

            <div className="inline-flex items-center gap-2 rounded-lg bg-mist-shadow px-3 py-1.5">
              <Toggle
                checked={maskNames}
                onChange={setMaskNames}
                label="Samarkan nama pemain (privasi)"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-court-green-deep px-4 text-label-md font-semibold text-field-white shadow-sm transition-colors hover:bg-primary"
            >
              <MIcon name="fullscreen" className="text-[18px]" />
              Buka Mode Fullscreen TV (F11)
            </button>
            <button
              type="button"
              onClick={() => setNow(new Date())}
              title="Muat ulang tampilan"
              aria-label="Muat ulang tampilan"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-mist-shadow text-slate-whisper transition-colors hover:text-on-surface"
            >
              <MIcon name="refresh" className="text-[20px]" />
            </button>
          </div>
        </div>

        {/* Frame TV */}
        <section className="flex flex-col rounded-2xl bg-on-surface p-5 shadow-xl sm:p-6">
          {boardError && (
            <p
              className="mb-4 rounded-xl bg-danger-light px-4 py-3 text-body-md font-semibold text-danger"
              role="alert"
            >
              {boardError} Menampilkan data terakhir yang berhasil dimuat.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-whisper/20 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-court-green-deep text-field-white">
                <MIcon name="sports_tennis" className="text-[24px]" />
              </span>
              <div>
                <span className="block text-headline-sm text-field-white">
                  PadelClub Arena Cilandak
                </span>
                <span className="block text-label-sm uppercase tracking-wider text-primary-fixed-dim">
                  Live Lobby Timetable &amp; Spectator Board
                </span>
              </div>
            </div>
            <div className="flex items-center gap-5 text-field-white">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-ping rounded-full bg-primary-container" />
                <span className="text-label-md font-bold">WIB (GMT+7)</span>
              </span>
              <span className="text-display tabular-nums text-field-white">
                {now.toLocaleTimeString("id-ID", { hour12: false })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 py-5 md:grid-cols-2 xl:grid-cols-3">
            {courtData.map(({ court, groups, ongoing }, courtIndex) => (
              <div
                key={court.id}
                className="flex flex-col rounded-xl bg-slate-whisper/10 p-4 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between border-b border-slate-whisper/20 pb-3">
                  <div className="flex flex-col">
                    <span className="text-label-sm uppercase tracking-wider text-primary-fixed-dim">
                      Court {String(courtIndex + 1).padStart(2, "0")}
                    </span>
                    <span className="text-headline-sm text-field-white">{court.name}</span>
                  </div>
                  {showSpec && (
                    <span className="rounded bg-court-green-deep/80 px-2 py-0.5 text-[11px] font-bold uppercase text-field-white">
                      {court.isIndoor ? "Indoor" : "Outdoor"}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  {groups.length === 0 && (
                    <p className="text-body-sm text-slate-whisper">Tidak ada jadwal hari ini.</p>
                  )}
                  {groups.map((group) => {
                    const ongoingGroup = ongoing === group;
                    const playerName = group.customerName
                      ? maskNames
                        ? maskName(group.customerName)
                        : group.customerName
                      : undefined;
                    const remaining = ongoingGroup ? Math.max(0, group.end * 60 - now.getHours() * 60 - now.getMinutes()) : 0;

                    if (group.status === "kosong") {
                      return (
                        <div
                          key={`${group.start}-${group.status}`}
                          className="rounded-xl bg-field-white p-3.5 text-on-surface shadow-lg"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-court-grass-light px-2 py-0.5 text-label-sm font-extrabold text-court-green-deep">
                              <MIcon name="check_circle" className="text-[14px]" />
                              SLOT KOSONG TERBUKA
                            </span>
                            <span className="text-label-sm font-bold text-court-green-deep">
                              Rp {court.hourlyPrice.toLocaleString("id-ID")} / Jam
                            </span>
                          </div>
                          <span className="block text-headline-md text-court-green-deep">
                            {String(group.start).padStart(2, "0")}:00 —{" "}
                            {String(group.end).padStart(2, "0")}:00
                          </span>
                          <p className="mt-1 text-label-sm text-slate-whisper">
                            Siap pakai langsung. Scan QR lobi atau hubungi resepsionis sekarang.
                          </p>
                        </div>
                      );
                    }

                    if (group.status === "tutup") {
                      return (
                        <div
                          key={`${group.start}-${group.status}`}
                          className="rounded-xl bg-closure-grey/20 p-3.5 text-field-white"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-label-sm font-bold text-slate-whisper">
                              <MIcon name="cleaning_services" className="text-[14px]" />
                              PERAWATAN RUTIN
                            </span>
                            <span className="text-label-sm text-slate-whisper">
                              {String(group.end).padStart(2, "0")}:00
                            </span>
                          </div>
                          <span className="block text-headline-sm font-bold">
                            {String(group.start).padStart(2, "0")}:00 —{" "}
                            {String(group.end).padStart(2, "0")}:00
                          </span>
                          <span className="mt-1 block text-label-sm text-slate-whisper">
                            {group.reason}
                          </span>
                        </div>
                      );
                    }

                    if (ongoingGroup) {
                      return (
                        <div
                          key={`${group.start}-${group.status}`}
                          className="relative overflow-hidden rounded-xl bg-court-green-deep p-3.5 text-field-white shadow-md"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-label-sm font-bold text-primary-fixed">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-primary-fixed" />
                              SEDANG BERLANGSUNG
                            </span>
                            {showTimer && (
                              <span className="rounded bg-field-white/20 px-2 py-0.5 text-[12px] font-bold tabular-nums">
                                Sisa {remaining} Menit
                              </span>
                            )}
                          </div>
                          <span className="block text-headline-md tabular-nums">
                            {String(group.start).padStart(2, "0")}:00 —{" "}
                            {String(group.end).padStart(2, "0")}:00
                          </span>
                          {playerName && (
                            <span className="mt-1 block text-label-lg font-semibold text-court-grass-light">
                              {playerName}
                            </span>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`${group.start}-${group.status}`}
                        className={cn(
                          "rounded-xl bg-slate-whisper/20 p-3.5 text-field-white",
                          group.start < currentHour && "opacity-80",
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "text-label-sm font-bold",
                              group.status === "terkonfirmasi"
                                ? "text-confirmed-blue"
                                : "text-slate-whisper",
                            )}
                          >
                            {group.status === "menunggu_pembayaran"
                              ? "MENUNGGU BAYAR"
                              : group.start > currentHour
                                ? "AKAN DATANG"
                                : "TERJADWAL"}
                          </span>
                          <span className="text-label-sm tabular-nums text-slate-whisper">
                            {(group.end - group.start) * 60} Menit
                          </span>
                        </div>
                        <span className="block text-headline-sm font-bold">
                          {String(group.start).padStart(2, "0")}:00 —{" "}
                          {String(group.end).padStart(2, "0")}:00
                        </span>
                        {playerName && (
                          <span className="mt-1 block text-label-md text-surface-container-highest">
                            {playerName}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Ticker */}
          <div className="flex items-center gap-4 overflow-hidden rounded-xl bg-court-green-deep/80 px-5 py-2.5">
            <div className="flex shrink-0 items-center gap-1.5 text-label-md font-bold uppercase tracking-wider text-field-white">
              <MIcon name="campaign" className="text-[18px]" />
              <span>Pengumuman Lobi:</span>
            </div>
            <div className="w-full overflow-hidden whitespace-nowrap">
              <p className="inline-block text-label-md font-medium tracking-wide text-field-white">
                {ticker}
              </p>
            </div>
            <span className="shrink-0 text-label-sm font-bold text-primary-fixed">LOBBY TV #1</span>
          </div>
        </section>

        {/* Panel operator */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col rounded-2xl bg-field-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2.5">
              <MIcon name="tv_gen" className="text-[22px] text-court-green-deep" />
              <h2 className="text-headline-sm text-on-surface">Parameter Monitor Lobi</h2>
            </div>
            <p className="mt-2 text-body-md text-slate-whisper">
              Pengaturan otomatisasi tampilan publik yang disalurkan ke TV HDMI/Chromecast.
            </p>
            <div className="mt-4 space-y-2.5">
              <div className="rounded-lg bg-mist-shadow p-3 transition-colors hover:bg-surface-container-high">
                <Toggle checked={showTimer} onChange={setShowTimer} label="Tampilkan timer sisa menit" />
              </div>
              <div className="rounded-lg bg-mist-shadow p-3 transition-colors hover:bg-surface-container-high">
                <Toggle checked={showSpec} onChange={setShowSpec} label="Tampilkan spesifikasi rumput & court" />
              </div>
              <div className="rounded-lg bg-mist-shadow p-3 transition-colors hover:bg-surface-container-high">
                <Toggle checked={maskNames} onChange={setMaskNames} label="Samarkan nama pemain" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-whisper/10 pt-4">
              <span className="text-label-sm text-slate-whisper">Refresh rate: tiap 15 detik</span>
              <span className="inline-flex items-center gap-1.5 text-label-sm font-bold text-court-green-deep">
                <span className="h-1.5 w-1.5 rounded-full bg-court-green-deep" /> Auto-Sync Aktif
              </span>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl bg-field-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2.5">
              <MIcon name="edit_note" className="text-[22px] text-court-green-deep" />
              <h2 className="text-headline-sm text-on-surface">Siaran Berjalan (Ticker)</h2>
            </div>
            <p className="mt-2 text-body-md text-slate-whisper">
              Pesan pengumuman darurat atau promosi yang tayang di strip bawah layar.
            </p>
            <label htmlFor="ticker" className="mt-4 text-label-sm font-semibold text-on-surface">
              Teks pengumuman TV
            </label>
            <textarea
              id="ticker"
              rows={3}
              value={draftTicker}
              onChange={(event) => setDraftTicker(event.target.value)}
              placeholder="Masukkan pesan siaran lobi..."
              className="mt-1.5 w-full resize-none rounded-lg bg-mist-shadow p-3 text-body-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
            />
            <div className="mt-auto flex justify-end border-t border-slate-whisper/10 pt-4">
              <button
                type="button"
                onClick={() => {
                  setTicker(draftTicker);
                  setToast("Teks ticker TV diperbarui.");
                }}
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-primary-container px-4 text-label-md font-semibold text-field-white shadow-sm transition-colors hover:bg-court-green-deep"
              >
                <MIcon name="publish" className="text-[18px]" />
                Update Teks TV
              </button>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl bg-field-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2.5">
              <MIcon name="cast_connected" className="text-[22px] text-court-green-deep" />
              <h2 className="text-headline-sm text-on-surface">Tautan Layar TV Smart</h2>
            </div>
            <p className="mt-2 text-body-md text-slate-whisper">
              Buka URL ini pada browser Smart TV, Android Box, atau TV stick tanpa perlu login
              admin.
            </p>
            <label htmlFor="tv-url" className="mt-4 text-label-sm font-semibold text-on-surface">
              URL dedicated display lobi
            </label>
            <input
              id="tv-url"
              readOnly
              value="/admin/papan-jadwal"
              className="mt-1.5 w-full select-all rounded-lg bg-mist-shadow p-3 font-mono text-body-sm text-slate-whisper focus:outline-none"
            />
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-container-low p-3">
              <MIcon name="security" className="mt-0.5 text-[20px] text-secondary" />
              <span className="text-body-sm text-slate-whisper">
                Akses publik ini read-only dan otomatis menolak transaksi kasir sensitif.
              </span>
            </div>
            <div className="mt-auto flex items-center justify-end border-t border-slate-whisper/10 pt-4">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-mist-shadow px-4 text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
              >
                <MIcon name="content_copy" className="text-[18px]" />
                Salin Link TV Display
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast open={!!toast} message={toast ?? ""} onClose={() => setToast(undefined)} tone="success" />
    </AdminShell>
  );
}
