import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Riwayat Booking",
  description: "Riwayat booking lapangan padel Anda — cek status, tiket, dan detail pembayaran.",
};

export default function RiwayatLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
