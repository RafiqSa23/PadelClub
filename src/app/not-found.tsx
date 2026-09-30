import { ButtonLink } from "@/components/ui/Button";
import { MIcon } from "@/components/ui/MIcon";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mist-shadow px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-court-grass-light text-court-green-deep">
        <MIcon name="search_off" className="text-[28px]" />
      </span>
      <p className="text-display-mobile font-extrabold tracking-[-0.02em] text-court-green-deep">
        404
      </p>
      <h1 className="text-headline-md text-on-surface">Halaman tidak ditemukan</h1>
      <p className="max-w-md text-body-md text-slate-whisper">
        Halaman yang Anda cari tidak ada atau sudah dipindahkan. Coba mulai dari beranda atau
        cari kode tiket Anda.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/">Ke beranda</ButtonLink>
        <ButtonLink href="/tiket" variant="secondary">
          Cek tiket
        </ButtonLink>
      </div>
    </div>
  );
}
