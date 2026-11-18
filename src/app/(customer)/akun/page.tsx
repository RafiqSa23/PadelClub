"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Input";
import { MIcon } from "@/components/ui/MIcon";
import { IconAlert, IconCheckCircle, IconShield } from "@/components/ui/icons";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-constants";
import type { SessionUser } from "@/lib/session-types";
import { invalidateCurrentUser } from "@/lib/use-current-user";

export default function AkunPage() {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null | undefined>(undefined);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/auth/me");
        if (cancelled) return;
        if (res.status === 401) {
          router.push("/login?next=/akun");
          return;
        }
        const json = (await res.json()) as { ok: boolean; user?: SessionUser };
        setMe(json.ok && json.user ? json.user : null);
      } catch {
        if (!cancelled) setMe(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSuccess(false);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password baru minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }
    if (newPassword !== confirm) {
      setError("Konfirmasi password baru tidak sama.");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        setError(json.message ?? "Gagal mengganti password.");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLogoutError(undefined);
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("logout gagal");
      // Beri tahu navbar (hook) supaya status sesi langsung jadi "Masuk".
      invalidateCurrentUser();
      router.push("/");
      router.refresh();
    } catch {
      setLogoutError("Gagal keluar. Coba lagi.");
      setLoggingOut(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-10 sm:py-16">
      <div>
        <p className="text-label-sm uppercase tracking-wider text-primary-container">Akun pemain</p>
        <h1 className="mt-1 text-headline-lg text-on-surface">Pengaturan akun</h1>
        <p className="mt-1 text-body-md text-slate-whisper">
          Kelola profil dan ganti password akunmu.
        </p>
      </div>

      <Card>
        <div className="border-b border-line/80 px-5 py-4 sm:px-6">
          <p className="text-label-lg text-on-surface">Profil</p>
        </div>
        <div className="space-y-2 px-5 py-4 text-body-md text-slate-whisper sm:px-6">
          {me === undefined ? (
            <div className="h-12 animate-pulse rounded-xl bg-mist-shadow" />
          ) : me === null ? (
            <p className="flex items-center gap-2 text-danger" role="alert">
              <IconAlert size={16} /> Gagal memuat profil.
            </p>
          ) : (
            <>
              <p>
                <span className="text-slate-whisper/70">Nama:</span>{" "}
                <span className="font-semibold text-on-surface">{me.name}</span>
              </p>
              <p>
                <span className="text-slate-whisper/70">Email:</span>{" "}
                <span className="font-semibold text-on-surface">{me.email ?? "—"}</span>
              </p>
              <p>
                <span className="text-slate-whisper/70">Nomor HP:</span>{" "}
                <span className="font-semibold text-on-surface">{me.phone ?? "—"}</span>
              </p>
            </>
          )}
        </div>
      </Card>

      <Card>
        <div className="border-b border-line/80 px-5 py-4 sm:px-6">
          <p className="text-label-lg text-on-surface">Ganti password</p>
          <p className="mt-1 text-body-sm text-slate-whisper">
            Masukkan password lama lalu password baru. Perangkat lain akan otomatis keluar.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4 px-5 py-4 sm:px-6">
          <Field label="Password lama" htmlFor="current">
            <TextInput
              id="current"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Password saat ini"
              autoComplete="current-password"
            />
          </Field>
          <Field label="Password baru" htmlFor="new" hint={`Minimal ${MIN_PASSWORD_LENGTH} karakter.`}>
            <TextInput
              id="new"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Password baru"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Ulangi password baru" htmlFor="confirm">
            <TextInput
              id="confirm"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Ulangi password baru"
              autoComplete="new-password"
            />
          </Field>
          {error && (
            <p className="flex items-center gap-2 text-sm font-semibold text-danger" role="alert">
              <IconAlert size={16} /> {error}
            </p>
          )}
          {success && (
            <p className="flex items-center gap-2 text-sm font-semibold text-court-green-deep" role="status">
              <IconCheckCircle size={16} /> Password berhasil diganti.
            </p>
          )}
          <Button type="submit" fullWidth size="lg" loading={loading}>
            Simpan password baru
          </Button>
          <p className="flex items-start gap-2 rounded-xl bg-mist-shadow px-3 py-2.5 text-body-sm text-slate-whisper">
            <IconShield size={16} className="mt-0.5 shrink-0" /> Lupa password dan tidak bisa masuk?
            Hubungi admin untuk reset. Reset mandiri belum tersedia.
          </p>
        </form>
      </Card>

      <Card>
        <div className="border-b border-line/80 px-5 py-4 sm:px-6">
          <p className="text-label-lg text-on-surface">Sesi</p>
          <p className="mt-1 text-body-sm text-slate-whisper">
            Keluar dari akun ini di perangkat ini.
          </p>
        </div>
        <div className="space-y-3 px-5 py-4 sm:px-6">
          {logoutError && (
            <p className="flex items-center gap-2 text-sm font-semibold text-danger" role="alert">
              <IconAlert size={16} /> {logoutError}
            </p>
          )}
          <Button
            variant="outline-danger"
            size="md"
            loading={loggingOut}
            onClick={logout}
            icon={<MIcon name="logout" className="text-[18px]" />}
          >
            Keluar
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/riwayat" variant="ghost" size="sm">
          Riwayat booking
        </ButtonLink>
        <ButtonLink href="/tiket" variant="ghost" size="sm">
          Cek tiket
        </ButtonLink>
        <Link href="/" className="text-body-sm text-slate-whisper hover:underline">
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
