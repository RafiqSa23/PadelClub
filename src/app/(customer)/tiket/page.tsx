"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Input";
import { MIcon } from "@/components/ui/MIcon";
import { IconAlert, IconSearch } from "@/components/ui/icons";

export default function TicketLookupPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = code.trim().replace(/^#/, "").toUpperCase();
    if (!normalized) {
      setError("Masukkan kode booking Anda.");
      return;
    }
    setError(undefined);
    router.push(`/tiket/${encodeURIComponent(normalized)}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-12 sm:py-20">
      <div className="rounded-2xl bg-field-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-court-grass-light text-court-green-deep">
            <MIcon name="confirmation_number" className="text-[30px]" />
          </span>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-court-grass-light px-3 py-1 text-label-sm uppercase tracking-wider text-court-green-deep">
            Cek Tiket &amp; Konfirmasi
          </span>
          <h1 className="mt-3 text-headline-lg text-on-surface sm:text-display-mobile">
            Cari e-ticket Anda
          </h1>
          <p className="mt-2 max-w-sm text-body-md text-slate-whisper">
            Masukkan kode booking (contoh: PD-A1B2C3) yang dikirim lewat WhatsApp atau email
            setelah pembayaran.
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="code" className="mb-1.5 block text-label-md text-on-surface">
              Kode Booking
            </label>
            <TextInput
              id="code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="cth: PD-A1B2C3"
              autoComplete="off"
            />
          </div>
          {error && (
            <p className="flex items-center gap-2 text-body-md font-semibold text-danger" role="alert">
              <IconAlert size={16} /> {error}
            </p>
          )}
          <Button type="submit" fullWidth size="lg" icon={<IconSearch size={18} />}>
            Lihat tiket
          </Button>
        </form>

        <p className="mt-5 flex items-start gap-2 rounded-xl bg-mist-shadow p-3 text-body-sm text-slate-whisper">
          <MIcon name="info" className="mt-0.5 text-[16px] text-court-green-deep" />
          Tiket dapat dibuka tanpa login. Kode booking juga tersimpan di email konfirmasi.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <ButtonLink href="/booking" fullWidth size="lg">
          Booking slot baru
        </ButtonLink>
        <ButtonLink href="/riwayat" variant="secondary" fullWidth size="lg">
          Lihat riwayat
        </ButtonLink>
      </div>
    </div>
  );
}
