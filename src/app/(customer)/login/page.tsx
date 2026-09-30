"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, OTPInput, PhoneInput, TextInput } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { IconAlert, IconCheckCircle, IconShield, IconTicket } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const RESEND_COOLDOWN = 60;

function ResendRow({ onResend }: { onResend: () => void }) {
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  return (
    <div className="flex items-center justify-between gap-3 text-body-md">
      <span className="text-body-md text-slate-whisper">Tidak menerima kode?</span>
      <button
        type="button"
        disabled={cooldown > 0}
        onClick={() => {
          onResend();
          setCooldown(RESEND_COOLDOWN);
        }}
        className={cn("min-h-11 text-label-md", cooldown > 0 ? "cursor-not-allowed text-slate-whisper" : "cursor-pointer text-primary-container hover:underline")}
      >
        {cooldown > 0 ? `Kirim ulang dalam ${cooldown}s` : "Kirim ulang"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  const [step, setStep] = useState<"form" | "otp" | "done">("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpKey, setOtpKey] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();

  async function sendOtp(event?: React.FormEvent) {
    event?.preventDefault();
    if (!name.trim() || phone.replace(/\D/g, "").length < 9) {
      setError("Isi nama dan nomor HP yang valid terlebih dahulu.");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const res = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name: name.trim() }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; debugCode?: string };
      if (!json.ok) {
        setError(json.message ?? "Gagal mengirim OTP.");
        return;
      }
      setDevCode(json.debugCode);
      setStep("otp");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (otp.length !== 6) {
      setError("Masukkan 6 digit kode OTP.");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp, name: name.trim() }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        setError(json.message ?? "Verifikasi gagal. Periksa kembali kode Anda.");
        return;
      }
      setStep("done");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[72vh] items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="grid w-full max-w-5xl items-stretch gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
        <div className="hidden rounded-3xl bg-court-green-deep p-8 text-field-white shadow-float lg:flex lg:flex-col lg:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-primary-container px-3 py-1.5 text-label-sm text-on-primary-container">Akses pemain</span>
            <h1 className="mt-8 max-w-sm text-display-mobile text-field-white">Tiket dan riwayat, selalu dekat.</h1>
            <p className="mt-4 max-w-sm text-body-md text-field-white/70">Masuk dengan nomor HP yang sama untuk melihat booking tanpa perlu mengingat kata sandi.</p>
          </div>
          <div className="space-y-3 border-t border-field-white/15 pt-6 text-body-md text-field-white/75">
            <p className="flex items-center gap-2"><IconTicket size={17} /> Buka tiket tanpa login</p>
            <p className="flex items-center gap-2"><IconShield size={17} /> Data tersimpan hanya untuk layanan booking</p>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-line/80 px-5 py-5 sm:px-7 sm:py-6">
            <p className="text-label-sm uppercase tracking-wider text-primary-container">Masuk ke PadelClub</p>
            <h2 className="mt-2 text-headline-lg text-on-surface">{step === "done" ? "Berhasil masuk" : "Masuk atau daftar"}</h2>
            <p className="mt-1 text-body-md text-slate-whisper">Cukup nomor HP dan kode OTP. Tidak perlu password.</p>
          </div>

          {step === "form" && (
            <form onSubmit={sendOtp} className="space-y-5 p-5 sm:p-7">
              <Field label="Nama" htmlFor="name" hint="Nama akan tampil di tiket booking.">
                <TextInput id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="cth: Raka Pratama" autoComplete="name" />
              </Field>
              <Field label="Nomor HP (WhatsApp)" htmlFor="phone">
                <PhoneInput id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="812 3456 7890" autoComplete="tel" />
              </Field>
              {error && <p className="flex items-center gap-2 text-sm font-semibold text-danger" role="alert"><IconAlert size={16} /> {error}</p>}
              <div className="flex items-start gap-2 rounded-xl bg-court-grass-light px-3 py-2.5 text-body-sm text-court-green-deep"><IconShield size={16} className="mt-0.5 shrink-0" /> Kode OTP dikirim lewat WhatsApp dalam waktu kurang dari 30 detik.</div>
              <Button type="submit" fullWidth size="lg" loading={loading}>Kirim kode OTP</Button>
              <p className="text-center text-body-sm text-slate-whisper">Nomor yang pernah digunakan akan dikenali otomatis.</p>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verify} className="space-y-5 p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <p className="text-body-md text-slate-whisper">Kode dikirim ke <span className="font-semibold text-on-surface">+62 {phone}</span>{" "}<Link href="/login" className="font-semibold text-primary-container hover:underline" onClick={() => setStep("form")}>ubah</Link></p>
                <Badge tone="green">6 digit</Badge>
              </div>
              <OTPInput value={otp} onChange={setOtp} error={!!error} />
              {devCode && (
                <p className="text-body-sm text-slate-whisper">
                  Kode (mode dev): <span className="tabular-nums font-semibold text-on-surface">{devCode}</span>
                </p>
              )}
              {error && <p className="flex items-center gap-2 text-sm font-semibold text-danger" role="alert"><IconAlert size={16} /> {error}</p>}
              <ResendRow key={`otp-${otpKey}`} onResend={() => { setOtp(""); setOtpKey((value) => value + 1); void sendOtp(); }} />
              <Button type="submit" fullWidth size="lg" loading={loading}>Verifikasi & masuk</Button>
            </form>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-5 p-7 text-center sm:p-9">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-court-grass-light text-primary-container"><IconCheckCircle size={32} /></span>
              <div><h3 className="text-headline-md text-on-surface">Halo, {name.split(" ")[0]}!</h3><p className="mt-1 text-body-md text-slate-whisper">Nomor {phone} sudah terhubung ke akun WhatsApp kamu.</p></div>
              <div className="flex w-full flex-col gap-2"><ButtonLink href="/booking" fullWidth size="lg">Cari slot booking</ButtonLink><ButtonLink href="/riwayat" variant="secondary" fullWidth>Lihat riwayat booking</ButtonLink></div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
