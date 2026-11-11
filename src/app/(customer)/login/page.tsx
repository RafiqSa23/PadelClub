"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Input";
import { IconAlert, IconShield, IconTicket } from "@/components/ui/icons";

function safeNextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") ? next : "/riwayat";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        setError(json.message ?? "Email atau password salah.");
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
            <span className="inline-flex rounded-full bg-primary-container px-3 py-1.5 text-label-sm text-on-primary-container">Akses pemain</span>
            <h1 className="mt-8 max-w-sm text-display-mobile text-field-white">Tiket dan riwayat, selalu dekat.</h1>
            <p className="mt-4 max-w-sm text-body-md text-field-white/70">Masuk dengan email dan password untuk melihat booking yang tersimpan di akunmu.</p>
          </div>
          <div className="space-y-3 border-t border-field-white/15 pt-6 text-body-md text-field-white/75">
            <p className="flex items-center gap-2"><IconTicket size={17} /> Buka tiket tanpa login</p>
            <p className="flex items-center gap-2"><IconShield size={17} /> Data tersimpan hanya untuk layanan booking</p>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-line/80 px-5 py-5 sm:px-7 sm:py-6">
            <p className="text-label-sm uppercase tracking-wider text-primary-container">Masuk ke PadelClub</p>
            <h2 className="mt-2 text-headline-lg text-on-surface">Masuk akun</h2>
            <p className="mt-1 text-body-md text-slate-whisper">Gunakan email dan password akunmu.</p>
          </div>

          <form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
            <Field label="Email" htmlFor="email">
              <TextInput
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@email.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <TextInput
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password akun"
                autoComplete="current-password"
              />
            </Field>
            {error && <p className="flex items-center gap-2 text-sm font-semibold text-danger" role="alert"><IconAlert size={16} /> {error}</p>}
            <div className="flex items-start gap-2 rounded-xl bg-court-grass-light px-3 py-2.5 text-body-sm text-court-green-deep"><IconShield size={16} className="mt-0.5 shrink-0" /> Lupa password? Hubungi admin untuk reset — reset mandiri belum tersedia.</div>
            <Button type="submit" fullWidth size="lg" loading={loading}>Masuk</Button>
            <p className="text-center text-body-sm text-slate-whisper">
              Belum punya akun?{" "}
              <Link href="/daftar" className="font-semibold text-primary-container hover:underline">
                Daftar di sini
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
