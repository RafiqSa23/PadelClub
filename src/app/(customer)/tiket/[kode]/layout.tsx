import type { Metadata } from "next";
import type { ReactNode } from "react";

type TiketLayoutParams = Promise<{ kode: string }>;

export async function generateMetadata({ params }: { params: TiketLayoutParams }): Promise<Metadata> {
  const { kode } = await params;
  return {
    title: `Tiket ${kode.toUpperCase()}`,
    description: "E-ticket booking lapangan padel — tunangkan QR saat tiba di venue.",
    robots: { index: false, follow: false },
  };
}

export default function TiketKodeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
