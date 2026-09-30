import Link from "next/link";
import { MIcon } from "@/components/ui/MIcon";

const COLUMNS = [
  {
    title: "Jam Operasional",
    body: ["Senin - Minggu"],
    strong: "06:00 - 23:00 WIB",
    note: "Slot malam dilengkapi sistem pencahayaan 1000 Lux LED.",
  },
  {
    title: "Lokasi & Kontak",
    body: ["Jl. TB Simatupang No. 18, Cilandak, Jakarta Selatan 12430"],
    strong: "Hotline WhatsApp: +62 811-2345-7890",
    note: "Email: booking@padelclub.id",
  },
];

const QUICK_LINKS = [
  { label: "Beranda", href: "/" },
  { label: "Jadwal Lapangan", href: "/booking" },
  { label: "Cek E-Ticket", href: "/tiket" },
  { label: "Portal Operator", href: "/admin" },
];

export function PublicFooter() {
  return (
    <footer className="mt-16 w-full bg-field-white shadow-[0_-1px_8px_rgba(0,0,0,0.03)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <span className="font-display text-headline-sm tracking-[-0.03em] text-court-green-deep">
              Padel<span className="text-on-surface">Club</span>
            </span>
            <p className="text-body-sm leading-relaxed text-slate-whisper">
              Sistem penyewaan lapangan padel standar WPT di Jakarta Selatan dengan reservasi
              instan &amp; transparan.
            </p>
            <span className="inline-flex items-center gap-1.5 text-label-sm text-court-green-deep">
              <MIcon name="verified" className="text-[16px]" />
              Fasilitas Terverifikasi PBPI
            </span>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title} className="space-y-2">
              <h4 className="text-label-lg text-on-surface">{column.title}</h4>
              {column.body.map((line) => (
                <p key={line} className="text-body-sm text-slate-whisper">
                  {line}
                </p>
              ))}
              <p className="text-data-tabular text-court-green-deep">{column.strong}</p>
              <p className="pt-1 text-body-sm text-slate-whisper">{column.note}</p>
            </div>
          ))}

          <div className="space-y-2">
            <h4 className="text-label-lg text-on-surface">Navigasi Cepat</h4>
            <ul className="space-y-1 text-body-sm text-slate-whisper">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-primary-container">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-mist-shadow pt-6 text-body-sm text-slate-whisper sm:flex-row">
          <span>© {new Date().getFullYear()} PadelClub Indonesia. Hak Cipta Dilindungi.</span>
          <span className="text-label-sm">Garansi Pemesanan 3 Klik &amp; 2 Menit</span>
        </div>
      </div>
    </footer>
  );
}
