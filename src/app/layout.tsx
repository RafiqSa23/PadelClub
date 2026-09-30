import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PadelClub - Sistem Reservasi Lapangan Padel",
  description:
    "Sistem penyewaan lapangan padel standar WPT di Jakarta Selatan dengan reservasi instan & transparan",
};

const MATERIAL_SYMBOLS =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={plusJakartaSans.variable}>
      <body className="min-h-full antialiased">
        <link rel="stylesheet" href={MATERIAL_SYMBOLS} />
        {children}
      </body>
    </html>
  );
}
