"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/layout/Brand";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Input";
import { MIcon } from "@/components/ui/MIcon";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Isi username dan password.");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        setError(json.message ?? "Login gagal.");
        setLoading(false);
        return;
      }
      router.push("/admin/dashboard");
    } catch {
      setError("Tidak dapat terhubung ke server.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-mist-shadow lg:grid lg:grid-cols-[0.95fr_1.05fr]">
      {/* Panel kiri — ringkasan operasional */}
      <div className="relative hidden overflow-hidden bg-on-surface p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 court-grid opacity-20" />

        <div className="relative">
          <Brand light />
          <p className="mt-3 text-label-sm uppercase tracking-[0.18em] text-white/55">
            Panel pengelola
          </p>
        </div>

        <div className="relative max-w-md">
          <p className="text-display font-extrabold leading-[1.05] tracking-[-0.03em]">
            Satu ruang untuk menjaga setiap lapangan tetap berjalan.
          </p>
          <p className="mt-5 max-w-sm text-body-md leading-6 text-white/70">
            Pantau jadwal, status pembayaran, dan tutup lapangan ketika diperlukan.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-3">
          {[
            { value: "6", label: "modul operasional" },
            { value: "24/7", label: "terpantau" },
            { value: "QRIS", label: "status pembayaran" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/15 bg-white/10 p-3"
            >
              <p className="text-headline-sm text-white">{item.value}</p>
              <p className="mt-1 text-label-sm text-white/70">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form masuk */}
      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:min-h-0">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Brand />
            <p className="mt-2 text-body-md text-slate-whisper">Panel pengelola PadelClub</p>
          </div>

          <div className="rounded-2xl bg-field-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-court-grass-light text-court-green-deep">
                <MIcon name="shield_person" className="text-[22px]" />
              </span>
              <div>
                <p className="text-label-sm uppercase tracking-[0.16em] text-court-green-deep">
                  Akses admin
                </p>
                <h1 className="mt-1 text-headline-md text-on-surface">Masuk ke panel</h1>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <Field label="Username" htmlFor="username">
                <TextInput
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                />
              </Field>
              <Field label="Password" htmlFor="password">
                <TextInput
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </Field>

              {error && (
                <p
                  className="flex items-center gap-2 rounded-xl bg-error-container p-3 text-body-sm font-semibold text-on-error-container"
                  role="alert"
                >
                  <MIcon name="error" className="text-[16px]" />
                  {error}
                </p>
              )}

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={loading}
                icon={<MIcon name="arrow_forward" className="text-[18px]" />}
              >
                {loading ? "Memeriksa…" : "Masuk ke dashboard"}
              </Button>
            </form>

            <div className="mt-6 rounded-xl bg-mist-shadow p-3.5 text-body-sm leading-5 text-slate-whisper">
              <span className="font-semibold text-on-surface">Akun awal (seed)</span>
              <br />
              <span className="font-mono">admin / admin123</span> — ganti password setelah login
              pertama.
            </div>
          </div>

          <div className="mt-5 text-center">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-1.5 text-label-lg text-court-green-deep hover:underline"
            >
              <MIcon name="arrow_back" className="text-[16px]" />
              Kembali ke situs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
