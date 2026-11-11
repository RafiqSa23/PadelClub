"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, PhoneInput, TextInput } from "@/components/ui/Input";
import { IconAlert, IconCheckCircle, IconShield } from "@/components/ui/icons";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-constants";
import { isValidPhone } from "@/lib/phone";

function safeNextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") ? next : "/riwayat";
}

export default function DaftarPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Nama wajib diisi.");
      return;
    }
    if (!email.trim()) {
      setError("Email wajib diisi.");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Nomor HP tidak valid (contoh: 0812…).");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, phone }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        setError(json.message ?? "Gagal mendaftar. Periksa data Anda.");
        return;
      }
      router.push(safeNextPath());
      router.refresh();
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
            <span className="inline-flex rounded-full bg-primary-container px-3 py-1.5 text-label-sm text-on-primary-container">Akun pemain</span>
            <h1 className="mt-8 max-w-sm text-display-mobile text-field-white">Sekali daftar, semua booking tersimpan.</h1>
            <p className="mt-4 max-w-sm text-body-md text-field-white/70">Akun aktif langsung — tanpa OTP dan tanpa verifikasi email. Booking berikutnya tinggal masuk.</p>
          </div>
          <div className="space-y-3 border-t border-field-white/15 pt-6 text-body-md text-field-white/75">
            <p className="flex items-center gap-2"><IconCheckCircle size={17} /> Riwayat & tiket melekat ke akun</p>
            <p className="flex items-center gap-2"><IconShield size={17} /> Password disimpan sebagai hash</p>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-line/80 px-5 py-5 sm:px-7 sm:py-6">
            <p className="text-label-sm uppercase tracking-wider text-primary-container">Daftar PadelClub</p>
            <h2 className="mt-2 text-headline-lg text-on-surface">Buat akun pemain</h2>
            <p className="mt-1 text-body-md text-slate-whisper">Isi data di bawah; akun langsung aktif.</p>
          </div>

          <form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
            <Field label="Nama" htmlFor="name" hint="Nama akan tampil di tiket booking.">
              <TextInput id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="cth: Raka Pratama" autoComplete="name" />
            </Field>
            <Field label="Email" htmlFor="email" hint="Dipakai untuk masuk. Tidak ada verifikasi email.">
              <TextInput id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" autoComplete="email" />
            </Field>
            <Field label="Nomor HP" htmlFor="phone" hint="Awalan +62 sudah terisi — cukup tulis 08… atau 812….">
              <PhoneInput id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="812 3456 7890" autoComplete="tel" />
            </Field>
            <Field label="Password" htmlFor="password" hint={`Minimal ${MIN_PASSWORD_LENGTH} karakter.`}>
              <TextInput id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Buat password" autoComplete="new-password" />
            </Field>
            {error && <p className="flex items-center gap-2 text-sm font-semibold text-danger" role="alert"><IconAlert size={16} /> {error}</p>}
            <Button type="submit" fullWidth size="lg" loading={loading}>Daftar & masuk</Button>
            <p className="text-center text-body-sm text-slate-whisper">
              Sudah punya akun?{" "}
              <Link href="/login" className="font-semibold text-primary-container hover:underline">
                Masuk di sini
              </Link>
            </p>
            <div className="border-t border-line/80 pt-4 text-center">
              <ButtonLink href="/tiket" variant="ghost" size="sm">Buka tiket tanpa login</ButtonLink>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
