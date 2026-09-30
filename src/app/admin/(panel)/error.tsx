"use client";

import { Button, ButtonLink } from "@/components/ui/Button";
import { MIcon } from "@/components/ui/MIcon";
import { AdminShell } from "@/components/layout/AdminShell";

export default function AdminPanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AdminShell title="Kesalahan">
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl bg-field-white px-6 py-16 text-center shadow-sm">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error-container text-error">
          <MIcon name="error" className="text-[28px]" />
        </span>
        <h1 className="text-headline-md text-on-surface">Panel gagal dimuat</h1>
        <p className="max-w-md text-body-md text-slate-whisper">
          Terjadi kesalahan saat memuat halaman admin. Coba lagi, atau kembali ke dashboard.
        </p>
        {error.digest && (
          <p className="text-body-sm text-slate-whisper">
            Kode error: <span className="tabular-nums text-on-surface">{error.digest}</span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Coba lagi</Button>
          <ButtonLink href="/admin/dashboard" variant="secondary">
            Ke dashboard
          </ButtonLink>
        </div>
      </div>
    </AdminShell>
  );
}
