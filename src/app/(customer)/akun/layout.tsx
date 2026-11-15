import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pengaturan Akun",
  description: "Kelola profil dan ganti password akun PadelClub.",
};

export default function AkunLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
