import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Jadwal & Booking",
  description:
    "Pilih tanggal, lapangan, dan jam untuk booking lapangan padel — bayar via QRIS, tiket langsung terkirim.",
};

export default function BookingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
