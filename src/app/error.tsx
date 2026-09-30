"use client";

import { Button, ButtonLink } from "@/components/ui/Button";
import { MIcon } from "@/components/ui/MIcon";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mist-shadow px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error-container text-error">
        <MIcon name="error" className="text-[28px]" />
      </span>
      <h1 className="text-headline-md text-on-surface">Terjadi kesalahan</h1>
      <p className="max-w-md text-body-md text-slate-whisper">
        Maaf, terjadi kesalahan tak terduga saat memuat halaman. Coba lagi, atau kembali ke
        beranda.
      </p>
      {error.digest && (
        <p className="text-body-sm text-slate-whisper">
          Kode error: <span className="tabular-nums text-on-surface">{error.digest}</span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Coba lagi</Button>
        <ButtonLink href="/" variant="secondary">
          Ke beranda
        </ButtonLink>
      </div>
    </div>
  );
}
