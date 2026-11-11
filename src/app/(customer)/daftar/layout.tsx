import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Daftar Akun",
  description: "Buat akun PadelClub dengan email dan password untuk booking lapangan padel.",
};

export default function DaftarLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
