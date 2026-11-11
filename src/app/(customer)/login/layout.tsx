import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk dengan email dan password untuk mengakses riwayat booking padel Anda.",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
