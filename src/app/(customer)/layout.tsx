import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export const metadata: Metadata = {
  title: {
    default: "PadelClub — Sistem Reservasi Lapangan Padel",
    template: "%s — PadelClub",
  },
  description:
    "Sistem penyewaan lapangan padel standar WPT di Jakarta Selatan dengan reservasi instan & transparan",
};

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-mist-shadow">
      <PublicHeader />
      <main className="flex-1 pt-16">{children}</main>
      <PublicFooter />
    </div>
  );
}
