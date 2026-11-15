"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TextInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { MIcon } from "@/components/ui/MIcon";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-constants";

interface UserRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  isGuest: boolean;
  anonymizedAt: string | null;
  createdAt: string;
}

async function fetchUsers(q: string): Promise<{
  users?: UserRow[];
  error?: string;
  unauthorized?: boolean;
}> {
  const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  if (res.status === 401) return { unauthorized: true };
  const json = (await res.json()) as { ok: boolean; message?: string; users?: UserRow[] };
  if (!json.ok || !json.users) return { error: json.message ?? "Gagal memuat akun." };
  return { users: json.users };
}

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resetId, setResetId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchUsers("");
        if (cancelled) return;
        if (result.unauthorized) {
          setError("Sesi admin berakhir. Muat ulang halaman dan masuk lagi.");
        } else if (result.error) {
          setError(result.error);
        } else if (result.users) {
          setUsers(result.users);
        }
      } catch {
        if (!cancelled) setError("Tidak dapat terhubung ke server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    setLoading(true);
    try {
      const result = await fetchUsers(query.trim());
      if (result.unauthorized) {
        setError("Sesi admin berakhir. Muat ulang halaman dan masuk lagi.");
      } else if (result.error) {
        setError(result.error);
      } else if (result.users) {
        setUsers(result.users);
      }
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event: React.FormEvent, user: UserRow) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password baru minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        setError(json.message ?? "Gagal mereset password.");
        return;
      }
      setNotice(`Password ${user.name} berhasil direset. Semua sesi user tersebut berakhir.`);
      setResetId(null);
      setNewPassword("");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <AdminShell title="Akun Pemain">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          eyebrow="Akun"
          title="Akun Pemain"
          description="Cari akun pemain lalu reset password bila pemain lupa dan tidak bisa masuk. User bayangan walk-in tidak punya password."
        />

        <Card>
          <CardBody className="space-y-4">
            <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1">
                <span className="mb-1.5 block text-label-md text-on-surface">Cari akun</span>
                <TextInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nama, email, atau nomor HP"
                  autoComplete="off"
                />
              </label>
              <Button type="submit" icon={<MIcon name="search" className="text-[18px]" />}>
                Cari
              </Button>
            </form>

            {error && (
              <p className="rounded-xl bg-danger-light px-4 py-3 text-body-md font-semibold text-danger" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-xl bg-court-grass-light px-4 py-3 text-body-md font-semibold text-court-green-deep" role="status">
                {notice}
              </p>
            )}

            {loading ? (
              <p className="text-body-md text-slate-whisper">Memuat akun…</p>
            ) : users.length === 0 ? (
              <EmptyState
                title="Tidak ada akun"
                description="Coba kata kunci lain, atau belum ada akun yang cocok."
              />
            ) : (
              <div className="divide-y divide-line/70">
                {users.map((user) => (
                  <div key={user.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-label-lg text-on-surface">{user.name}</p>
                          {user.isGuest && <Badge tone="amber">User bayangan</Badge>}
                          {user.anonymizedAt && <Badge tone="red">Anonim</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-body-sm text-slate-whisper">
                          {user.email ?? "Tanpa email"} · {user.phone ?? "Tanpa HP"} · dibuat{" "}
                          {user.createdAt.slice(0, 10)}
                        </p>
                      </div>
                      {user.isGuest ? (
                        <span className="text-body-sm text-slate-whisper">Tidak punya password</span>
                      ) : resetId === user.id ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setResetId(null);
                            setNewPassword("");
                          }}
                        >
                          Batal
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={<MIcon name="password" className="text-[18px]" />}
                          onClick={() => {
                            setResetId(user.id);
                            setNewPassword("");
                            setNotice(null);
                            setError(null);
                          }}
                        >
                          Reset password
                        </Button>
                      )}
                    </div>

                    {resetId === user.id && (
                      <form
                        onSubmit={(event) => resetPassword(event, user)}
                        className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-mist-shadow p-3"
                      >
                        <label className="min-w-0 flex-1">
                          <span className="mb-1.5 block text-label-md text-on-surface">
                            Password baru untuk {user.name}
                          </span>
                          <TextInput
                            type="password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
                            autoComplete="new-password"
                          />
                        </label>
                        <Button type="submit" size="sm" loading={resetLoading}>
                          Simpan
                        </Button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AdminShell>
  );
}
