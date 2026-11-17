"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsQR from "jsqr";
import { AdminShell } from "@/components/layout/AdminShell";
import { MIcon } from "@/components/ui/MIcon";
import { Toast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { dateLabel, hourLabel } from "@/lib/format";
import { extractTicketCode, parseTicketQrPayload } from "@/lib/ticket-qr-format";
import type { BookingStatus, PaymentStatus } from "@/lib/types";

type Mode = "camera" | "manual" | "log";
type CameraState = "idle" | "live" | "denied" | "unavailable" | "error";

interface ScannedTicket {
  code: string;
  courtName: string | null;
  date: string;
  hours: number[];
  status: BookingStatus;
  source: "online" | "walkin";
  paymentStatus: PaymentStatus | string | null;
  customerName: string | null;
  customerPhone: string | null;
  checkedInAt: string | null;
}

interface LogEntry {
  id: number;
  at: number;
  time: string;
  code: string;
  name: string;
  court: string;
  ok: boolean;
  note: string;
}

interface ServerScan {
  id: number;
  code: string;
  customerName: string | null;
  courtName: string | null;
  outcome: "ok" | "already" | "rejected";
  reason: string | null;
  createdAt: string;
}

interface ScanResult {
  ok: boolean;
  title: string;
  subtitle: string;
  booking?: ScannedTicket;
}

/** Waktu WIB dari ISO server (mis. `createdAt` log). */
function wibTime(iso: string) {
  return `${new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

/** Log tersimpan dari server (bertahan setelah reload/pergantian shift). */
async function fetchScanHistory(): Promise<LogEntry[]> {
  const res = await fetch("/api/admin/scans?limit=20", {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { ok: boolean; scans?: ServerScan[] };
  if (!json.ok || !json.scans) return [];

  return json.scans.map((scan) => ({
    id: scan.id,
    at: new Date(scan.createdAt).getTime(),
    time: wibTime(scan.createdAt),
    code: scan.code,
    name: scan.customerName ?? "—",
    court: scan.courtName ?? "—",
    ok: scan.outcome === "ok",
    note:
      scan.outcome === "ok"
        ? "Sukses masuk"
        : scan.outcome === "already"
          ? "Sudah check-in"
          : (scan.reason ?? "Ditolak"),
  }));
}

export default function AdminScannerPage() {
  const [mode, setMode] = useState<Mode>("camera");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<string | undefined>();
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState<string | undefined>();
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [deviceId, setDeviceId] = useState("");
  const [soundOn, setSoundOn] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const validatingRef = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const validateRef = useRef<(raw: string, origin?: "camera" | "manual") => Promise<void>>(
    async () => {},
  );

  function nowWib() {
    return `${new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    })} WIB`;
  }

  /** Bunyi gate: dua nada naik saat lolos, nada rendah saat ditolak. */
  function playGateTone(ok: boolean, force = false) {
    if (!force && !soundOn) return;
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = audioRef.current ?? new AudioCtor();
    audioRef.current = ctx;
    if (ctx.state === "suspended") void ctx.resume();

    const start = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(ok ? 0.25 : 0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (ok ? 0.32 : 0.26));

    if (ok) {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, start);
      osc.frequency.setValueAtTime(1320, start + 0.12);
      osc.start(start);
      osc.stop(start + 0.34);
    } else {
      osc.type = "square";
      osc.frequency.setValueAtTime(200, start);
      osc.start(start);
      osc.stop(start + 0.28);
    }
  }

  // Tutup AudioContext saat halaman ditinggalkan.
  useEffect(() => {
    return () => {
      void audioRef.current?.close();
      audioRef.current = null;
    };
  }, []);

  function pushLog(entry: Omit<LogEntry, "id" | "at" | "time">) {
    const at = Date.now();
    setLog((previous) => [{ id: at, at, time: nowWib(), ...entry }, ...previous].slice(0, 20));
  }

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await fetchScanHistory());
    } catch {
      // Riwayat bersifat tambahan — kegagalan muat tidak mengganggu pemindaian.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchScanHistory()
      .then((scans) => {
        if (!cancelled) setHistory(scans);
      })
      .catch(() => {
        // Riwayat bersifat tambahan.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo(
    () => [...log, ...history].sort((a, b) => b.at - a.at).slice(0, 20),
    [log, history],
  );
  const failedCount = entries.filter((entry) => !entry.ok).length;
  const successCount = entries.filter((entry) => entry.ok).length;
  const inVenue = successCount;

  function deny(
    title: string,
    subtitle: string,
    ticket: ScannedTicket | undefined,
    note: string,
    origin: "client" | "server" = "client",
  ) {
    playGateTone(false);
    setResult({ ok: false, title, subtitle, booking: ticket });
    if (origin === "client") {
      pushLog({
        code: ticket?.code ?? input.trim(),
        name: ticket?.customerName ?? "—",
        court: ticket?.courtName ?? "—",
        ok: false,
        note,
      });
    }
  }

  async function validate(raw: string, origin: "camera" | "manual" = "manual") {
    const signed = parseTicketQrPayload(raw);
    const code = extractTicketCode(raw);
    if (!code) {
      setResult({
        ok: false,
        title: "QR tidak valid",
        subtitle: "Payload QR/kode booking tidak dikenali.",
      });
      return;
    }

    // Kamera wajib membawa payload bertanda tangan; input manual tetap boleh
    // kode polos karena resepsionis adalah aktor tepercaya.
    if (origin === "camera" && !signed) {
      deny(
        "QR tidak valid",
        "Gunakan QR terbaru dari halaman tiket — kode teks polos tidak diterima kamera.",
        undefined,
        "QR tidak valid",
      );
      return;
    }

    const qrPayload = origin === "camera" && signed ? raw.trim() : null;
    const url = `/api/tickets/${encodeURIComponent(code)}${
      qrPayload ? `?qr=${encodeURIComponent(qrPayload)}` : ""
    }`;

    validatingRef.current = true;
    setValidating(true);
    try {
      const res = await fetch(url, {
        cache: "no-store",
        credentials: "include",
      });
      const json = (await res.json()) as {
        ok: boolean;
        message?: string;
        ticket?: ScannedTicket;
      };
      if (!json.ok || !json.ticket) {
        if (res.status === 404) {
          deny("Tiket tidak ditemukan", `Kode "${code}" tidak terdaftar di sistem.`, undefined, "Kode tidak ditemukan");
        } else if (res.status === 403) {
          deny(
            "QR tidak valid",
            json.message ?? "QR tiket tidak valid atau sudah kedaluwarsa.",
            undefined,
            "QR tidak valid",
          );
        } else {
          setResult({
            ok: false,
            title: "Validasi gagal",
            subtitle: json.message ?? "Tidak dapat terhubung ke server.",
          });
        }
        return;
      }
      const ticket = json.ticket;

      if (ticket.status === "dibatalkan") {
        deny("Akses ditolak", "Booking ini telah dibatalkan.", ticket, "Dibatalkan");
        return;
      }
      if (ticket.paymentStatus !== "paid") {
        deny(
          "Belum lunas",
          "Pembayaran belum terverifikasi, minta pemain menyelesaikan pembayaran.",
          ticket,
          "Belum dibayar",
        );
        return;
      }
      if (ticket.checkedInAt) {
        deny("Sudah check-in", "Tiket ini sudah pernah discan sebelumnya.", ticket, "Duplikat scan");
        return;
      }

      // Check-in resmi via API (sumber kebenaran server, idempoten).
      const checkRes = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: ticket.code }),
      });
      const checkJson = (await checkRes.json()) as {
        ok: boolean;
        message?: string;
        ticket?: { checkedInAt: string | null };
      };
      if (!checkJson.ok) {
        if (checkRes.status === 409) {
          deny(
            "Di luar jadwal check-in",
            checkJson.message ?? "Check-in hanya bisa pada hari-H sesuai jam sesi.",
            ticket,
            "Di luar jadwal",
            "server",
          );
          void loadHistory();
          return;
        }
        deny("Check-in gagal", checkJson.message ?? "Coba lagi.", ticket, "Check-in gagal", "server");
        void loadHistory();
        return;
      }

      const checked: ScannedTicket = {
        ...ticket,
        checkedInAt: checkJson.ticket?.checkedInAt ?? new Date().toISOString(),
      };
      const start = Math.min(...checked.hours);
      const end = Math.max(...checked.hours) + 1;
      setResult({
        ok: true,
        title: "Tiket valid & diizinkan masuk",
        subtitle: `Access Granted • ${checked.courtName ?? ""} ${hourLabel(start, end)}`,
        booking: checked,
      });
      void loadHistory();
      setToast(`Check-in ${checked.customerName ?? checked.code} berhasil.`);
      playGateTone(true);
    } catch {
      setResult({
        ok: false,
        title: "Validasi gagal",
        subtitle: "Tidak dapat terhubung ke server.",
      });
    } finally {
      validatingRef.current = false;
      setValidating(false);
    }
  }

  // Simpan fungsi validate terbaru supaya loop kamera tidak memakai closure basi.
  useEffect(() => {
    validateRef.current = validate;
  });

  // Nyalakan/matikan kamera sesuai mode + kamera yang dipilih.
  useEffect(() => {
    if (mode !== "camera") return;
    let cancelled = false;
    const video = videoRef.current;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          if (cancelled) return;
          setCameraState("unavailable");
          setCameraError("Browser tidak mendukung kamera. Butuh HTTPS atau localhost.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        if (cancelled) return;
        setCameraState("live");
        setCameraError(undefined);

        const list = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (cancelled) return;
        setCameras(
          list
            .filter((item) => item.kind === "videoinput")
            .map((item, index) => ({
              id: item.deviceId,
              label: item.label || `Kamera ${index + 1}`,
            })),
        );
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setCameraState("denied");
          setCameraError("Izin kamera ditolak. Aktifkan izin kamera di browser lalu muat ulang.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setCameraState("unavailable");
          setCameraError("Kamera tidak ditemukan. Gunakan input manual.");
        } else {
          setCameraState("error");
          setCameraError("Kamera gagal dimulai. Gunakan input manual.");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (video) video.srcObject = null;
    };
  }, [mode, deviceId]);

  // Decode frame kamera ~8 fps; kode sama diabaikan 8 detik supaya tidak spam.
  useEffect(() => {
    if (mode !== "camera" || cameraState !== "live") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let frame = 0;
    let lastDecode = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - lastDecode < 120 || validatingRef.current) return;
      lastDecode = now;
      if (!video.videoWidth || !video.videoHeight) return;

      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(image.data, image.width, image.height, {
        inversionAttempts: "dontInvert",
      });
      if (!found) return;

      const code = extractTicketCode(found.data);
      if (!code) return;
      const previous = lastScanRef.current;
      const at = Date.now();
      if (previous && previous.code === code && at - previous.at < 8000) return;
      lastScanRef.current = { code, at };
      setInput(code);
      void validateRef.current(found.data, "camera");
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cameraState, mode]);

  const court = result?.booking ? { name: result.booking.courtName ?? "—" } : undefined;

  const modes: Array<{ key: Mode; icon: string; label: string }> = [
    { key: "camera", icon: "photo_camera", label: "Camera Live" },
    { key: "manual", icon: "keyboard", label: "Input Manual" },
    { key: "log", icon: "history", label: "Log Riwayat" },
  ];

  const cameraTitle =
    cameraState === "live"
      ? "Arahkan QR tiket ke bingkai"
      : cameraState === "denied"
        ? "Izin kamera ditolak"
        : cameraState === "unavailable"
          ? "Kamera tidak tersedia"
          : cameraState === "error"
            ? "Kamera gagal dimulai"
            : "Menyiapkan kamera…";
  const cameraHint =
    cameraState === "live"
      ? "Pemindaian otomatis — tidak perlu menekan tombol."
      : cameraState === "idle"
        ? "Izinkan akses kamera saat browser meminta."
        : cameraError;

  return (
    <AdminShell title="Scanner Tiket">
      <div className="flex w-full flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-5 rounded-2xl bg-field-white p-5 shadow-sm sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-headline-md text-on-surface">Scanner Tiket &amp; Akses Turnstile</h1>
              <span className="inline-flex items-center gap-2 rounded-full bg-court-grass-light px-3 py-0.5 text-label-sm text-court-green-deep">
                <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
                Terminal Gate-01 Aktif • Turnstile Terhubung (Online)
              </span>
            </div>
            <p className="mt-1.5 text-body-sm text-slate-whisper">
              Stasiun validasi tiket otomatis QR &amp; pass fisik resepsionis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-5 rounded-xl bg-mist-shadow px-5 py-2.5">
              <div className="flex flex-col">
                <span className="text-label-sm text-slate-whisper">Terverifikasi (log)</span>
                <span className="text-headline-sm text-court-green-deep">
                  {successCount}{" "}
                  <span className="text-label-sm font-medium text-slate-whisper">Tiket</span>
                </span>
              </div>
              <div className="h-8 w-px bg-surface-variant" />
              <div className="flex flex-col">
                <span className="text-label-sm text-slate-whisper">Pemain di Venue</span>
                <span className="text-headline-sm text-confirmed-blue">
                  {inVenue}{" "}
                  <span className="text-label-sm font-medium text-slate-whisper">Orang</span>
                </span>
              </div>
              <div className="h-8 w-px bg-surface-variant" />
              <div className="flex flex-col">
                <span className="text-label-sm text-slate-whisper">Gagal / Expired</span>
                <span className="text-headline-sm text-error">{failedCount}</span>
              </div>
            </div>

            <div className="inline-flex rounded-xl bg-mist-shadow p-1">
              {modes.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMode(item.key)}
                  className={cn(
                    "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-label-md transition-all",
                    mode === item.key
                      ? "bg-court-green-deep text-field-white shadow-sm"
                      : "text-slate-whisper hover:text-on-surface",
                  )}
                >
                  <MIcon name={item.icon} className="text-[18px]" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Kiri */}
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-6">
            {mode === "camera" && (
              <div className="overflow-hidden rounded-2xl bg-field-white shadow-sm">
                <div className="flex items-center justify-between gap-3 bg-court-grass-light/40 px-5 py-3">
                  <div className="flex items-center gap-2 text-court-green-deep">
                    <MIcon name="videocam" className="text-[20px]" />
                    <span className="text-label-md font-bold">Viewport Scanner Optik</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-label-sm font-bold",
                        cameraState === "live"
                          ? "bg-court-green-deep text-field-white"
                          : "bg-mist-shadow text-slate-whisper",
                      )}
                    >
                      {cameraState === "live" ? "Kamera aktif — pindai otomatis" : "Kamera nonaktif"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        cameraState === "live" ? "animate-pulse bg-primary" : "bg-slate-whisper",
                      )}
                    />
                    <select
                      aria-label="Pilih kamera"
                      value={deviceId}
                      onChange={(event) => setDeviceId(event.target.value)}
                      disabled={cameras.length === 0}
                      className="max-w-52 cursor-pointer truncate rounded-lg bg-field-white px-2 py-1 text-label-sm text-on-surface shadow-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">Kamera default</option>
                      {cameras.map((camera) => (
                        <option key={camera.id} value={camera.id}>
                          {camera.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-inverse-surface">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    aria-label="Pratinjau kamera scanner"
                    className={cn(
                      "h-full w-full object-cover transition-opacity",
                      cameraState === "live" ? "opacity-100" : "opacity-0",
                    )}
                  />

                  {cameraState !== "live" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-field-white/10 text-primary-fixed">
                        <MIcon
                          name={cameraState === "denied" ? "videocam_off" : "qr_code_scanner"}
                          className="text-[34px]"
                        />
                      </span>
                      <div className="flex max-w-sm flex-col gap-1">
                        <span className="text-label-md font-semibold text-field-white">
                          {cameraTitle}
                        </span>
                        <span className="text-body-sm text-slate-whisper">{cameraHint}</span>
                      </div>
                    </div>
                  )}

                  {cameraState === "live" && (
                    <div className="pointer-events-none absolute flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
                      <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl shadow-[-2px_-2px_0_0_var(--color-primary-fixed-dim)]" />
                      <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl shadow-[2px_-2px_0_0_var(--color-primary-fixed-dim)]" />
                      <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl shadow-[-2px_2px_0_0_var(--color-primary-fixed-dim)]" />
                      <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl shadow-[2px_2px_0_0_var(--color-primary-fixed-dim)]" />
                      <span className="absolute inset-x-2 top-1/2 h-0.5 animate-bounce bg-primary-fixed/80" />
                    </div>
                  )}

                  <canvas ref={canvasRef} className="hidden" aria-hidden />

                  <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-lg bg-inverse-surface/85 px-4 py-1.5 backdrop-blur-md">
                    <div className="flex min-w-0 items-center gap-2">
                      <MIcon
                        name={cameraState === "live" ? "check_circle" : "info"}
                        className="text-[18px] text-primary-fixed"
                      />
                      <span className="truncate text-label-sm text-field-white">
                        {cameraState === "live" ? "Pemindaian QR otomatis" : "Pakai input manual bila kamera gagal"}
                      </span>
                    </div>
                    <span className="shrink-0 text-data-tabular text-primary-fixed">
                      {cameraState === "live" ? "LIVE" : "OFFLINE"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-2xl bg-field-white p-5 shadow-sm">
              <span className="text-label-sm font-bold uppercase tracking-wider text-slate-whisper">
                Validasi manual tanpa kamera
              </span>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <MIcon
                    name="pin"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-whisper"
                  />
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void validate(input);
                    }}
                    placeholder="Ketik kode booking (contoh: PD-A1B2C3)"
                    aria-label="Kode booking"
                    className="w-full rounded-lg bg-surface-container-low py-2.5 pl-10 pr-3 text-data-tabular text-on-surface focus:outline-none focus:ring-2 focus:ring-court-green-deep"
                  />
                </div>
                <Button
                  onClick={() => void validate(input)}
                  loading={validating}
                  icon={<MIcon name="verified" className="text-[18px]" />}
                  className="shrink-0"
                >
                  Validasi
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl bg-field-white p-5 shadow-sm">
              <span className="text-label-sm font-bold uppercase tracking-wider text-slate-whisper">
                Kontrol akses pintu &amp; override resepsionis
              </span>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setToast("Turnstile dibuka manual (emergency).")}
                  className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl bg-error-container p-4 text-center text-label-sm font-bold text-error transition-all hover:bg-error/20"
                >
                  <MIcon name="lock_open" className="text-[24px]" />
                  Buka Turnstile Manual (Emergency)
                </button>
                <button
                  type="button"
                  onClick={() => setToast("Tes pintu turnstile dijalankan.")}
                  className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl bg-surface-container-low p-4 text-center text-label-sm font-semibold text-on-surface transition-all hover:bg-surface-container-high"
                >
                  <MIcon name="door_sliding" className="text-[24px] text-court-green-deep" />
                  Tes Buka Pintu Turnstile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !soundOn;
                    setSoundOn(next);
                    if (next) playGateTone(true, true);
                    setToast(next ? "Suara gate diaktifkan." : "Suara gate dimatikan.");
                  }}
                  className={cn(
                    "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl p-4 text-center text-label-sm font-semibold transition-all",
                    soundOn
                      ? "bg-court-grass-light text-court-green-deep hover:bg-court-grass-light/70"
                      : "bg-surface-container-low text-slate-whisper hover:bg-surface-container-high",
                  )}
                >
                  <MIcon
                    name={soundOn ? "volume_up" : "volume_off"}
                    className="text-[24px] text-tertiary"
                  />
                  {soundOn ? "Suara Gate Aktif (klik tes)" : "Suara Gate Nonaktif"}
                </button>
              </div>
            </div>
          </div>

          {/* Kanan */}
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-6">
            {mode !== "log" ? (
              <div className="flex flex-col gap-5 rounded-2xl bg-field-white p-5 shadow-sm">
                {result ? (
                  <>
                    <div
                      className={cn(
                        "flex items-center justify-between gap-4 rounded-xl p-5 shadow-md",
                        result.ok ? "bg-court-green-deep text-field-white" : "bg-error-container text-error",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <span
                          className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                            result.ok ? "bg-field-white/15 text-field-white" : "bg-field-white/60",
                          )}
                        >
                          <MIcon name={result.ok ? "check_circle" : "error"} className="text-[30px]" />
                        </span>
                        <div className="min-w-0">
                          <span className="block text-headline-sm uppercase tracking-tight">
                            {result.title}
                          </span>
                          <span
                            className={cn(
                              "block text-label-sm uppercase tracking-wider",
                              result.ok ? "text-primary-fixed" : "text-error/80",
                            )}
                          >
                            {result.subtitle}
                          </span>
                        </div>
                      </div>
                      <div className="hidden flex-col items-end sm:flex">
                        <span className={cn("text-label-sm", result.ok ? "text-field-white/70" : "text-error/70")}>
                          Waktu Scan
                        </span>
                        <span className="text-data-tabular font-bold">{nowWib()}</span>
                      </div>
                    </div>

                    {result.booking && (
                      <div className="flex flex-col gap-4 rounded-xl bg-court-grass-light/40 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="block text-label-sm uppercase tracking-wider text-slate-whisper">
                              Kode booking &amp; tipe pass
                            </span>
                            <span className="block text-headline-md text-court-green-deep">
                              #{result.booking.code}
                            </span>
                            <span className="text-label-sm font-medium text-slate-whisper">
                              {result.booking.source === "walkin" ? "Walk-in pass" : "Online booking"} •{" "}
                              {result.booking.hours.length} jam bermain
                            </span>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-label-sm font-bold",
                              result.booking.paymentStatus === "paid"
                                ? "bg-court-green-deep text-field-white"
                                : "bg-pending text-on-surface",
                            )}
                          >
                            {result.booking.paymentStatus === "paid" ? "Lunas (QRIS)" : "Belum dibayar"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="flex flex-col rounded-lg bg-field-white p-3.5">
                            <span className="text-label-sm text-slate-whisper">
                              Nama Pemesan (PIC)
                            </span>
                            <span className="text-label-lg text-on-surface">
                              {result.booking.customerName}
                            </span>
                            <span className="mt-0.5 text-body-sm tabular-nums text-slate-whisper">
                              {result.booking.customerPhone
                                ? `+${result.booking.customerPhone}`
                                : "—"}
                            </span>
                          </div>
                          <div className="flex flex-col rounded-lg bg-field-white p-3.5">
                            <span className="text-label-sm text-slate-whisper">Sesi &amp; Lapangan</span>
                            <span className="text-label-lg text-court-green-deep">{court?.name}</span>
                            <span className="mt-0.5 text-body-sm font-semibold text-on-surface">
                              {dateLabel(result.booking.date)} •{" "}
                              {hourLabel(
                                Math.min(...result.booking.hours),
                                Math.max(...result.booking.hours) + 1,
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 rounded-lg bg-field-white p-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <MIcon name="timer" className="text-[22px] text-court-green-deep" />
                            <div className="min-w-0">
                              <span className="block text-label-sm text-slate-whisper">
                                Status masuk saat ini
                              </span>
                              <span className="block truncate text-label-md font-bold text-on-surface">
                                {result.ok
                                  ? `Check-in pertama (${nowWib()} — tepat waktu)`
                                  : "Menunggu tindakan resepsionis"}
                              </span>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-md bg-court-grass-light px-2 py-1 text-label-sm font-bold text-court-green-deep">
                            {result.ok ? "Gate Ready" : "Hold"}
                          </span>
                        </div>

                        <div className="flex flex-col gap-2.5">
                          <span className="text-label-sm font-bold uppercase tracking-wider text-slate-whisper">
                            Fasilitas tambahan untuk diserahkan resepsionis:
                          </span>
                          {[
                            { icon: "sports_tennis", title: "Bola padel (1 kaleng)", note: "Termasuk paket sewa", status: "Sudah Diambil", active: false },
                            { icon: "pin", title: "Kunci loker digital RFID", note: "Loker lantai 1", status: "Siap Serah Terima", active: true },
                            { icon: "water_bottle", title: "Handuk bersih & air mineral", note: "Complimentary pemain", status: "Tersedia di Meja", active: false },
                          ].map((item) => (
                            <div
                              key={item.title}
                              className={cn(
                                "flex items-center justify-between gap-3 rounded-lg p-3.5",
                                item.active ? "bg-court-grass-light/60" : "bg-surface-container-low",
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <MIcon name={item.icon} className="text-[20px] text-court-green-deep" />
                                <div className="min-w-0">
                                  <span className="block truncate text-label-md font-bold text-on-surface">
                                    {item.title}
                                  </span>
                                  <span className="block truncate text-body-sm text-slate-whisper">
                                    {item.note}
                                  </span>
                                </div>
                              </div>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2.5 py-0.5 text-label-sm font-bold",
                                  item.active
                                    ? "bg-court-green-deep text-field-white"
                                    : "bg-court-grass-light text-court-green-deep",
                                )}
                              >
                                {item.status}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button
                            fullWidth
                            size="lg"
                            icon={<MIcon name="sensor_door" className="text-[22px]" />}
                            onClick={() => setToast(`Gate ${court?.name ?? ""} dibuka.`)}
                          >
                            Buka Gate {court?.name ?? "Lapangan"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="lg"
                            icon={<MIcon name="print" className="text-[20px]" />}
                            onClick={() => window.print()}
                          >
                            Cetak Struk
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-xl bg-mist-shadow p-10 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-court-grass-light text-court-green-deep">
                      <MIcon name="qr_code_scanner" className="text-[28px]" />
                    </span>
                    <p className="text-headline-sm text-on-surface">Belum ada pindaian</p>
                    <p className="max-w-sm text-body-md text-slate-whisper">
                      Arahkan QR tiket pemain ke kamera, atau ketik kode booking di kolom validasi
                      manual.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {/* Riwayat pindaian */}
            <div className="flex flex-col gap-3 rounded-2xl bg-field-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <MIcon name="format_list_bulleted" className="text-[22px] text-court-green-deep" />
                  <span className="text-headline-sm text-on-surface">
                    Riwayat 5 Pemindaian Terakhir
                  </span>
                </div>
                <span className="text-label-sm text-slate-whisper">{entries.length} total log</span>
              </div>

              {entries.length === 0 ? (
                <EmptyState
                  title="Belum ada log shift"
                  description="Riwayat pemindaian tiket pada shift ini akan tampil di sini."
                  className="py-8"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="rounded-lg bg-surface-container-low text-label-sm uppercase tracking-wider text-slate-whisper">
                        <th className="rounded-l-lg px-3 py-2 font-semibold">Waktu</th>
                        <th className="px-3 py-2 font-semibold">ID Booking</th>
                        <th className="px-3 py-2 font-semibold">Nama Pemesan</th>
                        <th className="px-3 py-2 font-semibold">Lapangan</th>
                        <th className="rounded-r-lg px-3 py-2 text-right font-semibold">
                          Status Masuk
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-low text-body-md">
                      {entries.slice(0, 5).map((entry) => (
                        <tr key={entry.id} className="transition-colors hover:bg-mist-shadow">
                          <td className="px-3 py-2.5 font-bold tabular-nums text-on-surface">
                            {entry.time}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2.5 font-semibold tabular-nums",
                              entry.ok ? "text-court-green-deep" : "text-error",
                            )}
                          >
                            #{entry.code}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-on-surface">{entry.name}</td>
                          <td className="px-3 py-2.5 text-slate-whisper">{entry.court}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label-sm font-bold",
                                entry.ok
                                  ? "bg-court-grass-light text-court-green-deep"
                                  : "bg-error-container text-error",
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  entry.ok ? "bg-primary" : "bg-error",
                                )}
                              />
                              {entry.note}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Toast open={!!toast} message={toast ?? ""} onClose={() => setToast(undefined)} tone="success" />
    </AdminShell>
  );
}
