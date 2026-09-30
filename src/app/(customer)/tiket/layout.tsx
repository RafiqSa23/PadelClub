import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cek Tiket",
  description: "Cari e-ticket booking padel Anda dengan kode booking yang dikirim via WhatsApp/email.",
};

export default function TiketLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
