import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Masuk & Daftar",
  description:
    "Masuk atau daftar hanya dengan nomor HP dan OTP untuk mengakses riwayat booking padel Anda.",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
