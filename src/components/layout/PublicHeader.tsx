"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Brand, BrandMark } from "./Brand";
import { MIcon } from "@/components/ui/MIcon";
import { COURTS } from "@/lib/mock";

const ACTIVE_COURTS = COURTS.filter((court) => court.isActive).length;

const NAV = [
  { href: "/", label: "Beranda" },
  { href: "/booking", label: "Jadwal & Booking" },
  { href: "/tiket", label: "Cek Tiket" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/admin", label: "Admin Portal" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/admin") return pathname === "/admin" || pathname.startsWith("/admin/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-field-white/95 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Beranda PadelClub" className="shrink-0">
            <Brand />
          </Link>
          <span className="hidden shrink-0 items-center gap-2 rounded-full bg-court-grass-light px-3 py-1.5 text-label-sm text-court-green-deep xl:inline-flex">
            <span className="h-2 w-2 rounded-full bg-primary-container animate-pulse" />
            {ACTIVE_COURTS} Lapangan Aktif
          </span>
        </div>

        <nav className="hidden items-center lg:flex" aria-label="Navigasi utama">
          {NAV.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-label-md transition-colors",
                  active
                    ? "bg-primary-container text-field-white shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/login"
            className="hidden min-h-11 items-center gap-1.5 rounded-lg bg-primary-container px-4 text-label-md text-field-white shadow-sm transition-colors hover:bg-court-green-deep sm:inline-flex"
          >
            Masuk
            <MIcon name="arrow_forward" className="text-[18px]" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant hover:bg-mist-shadow lg:hidden"
            aria-label="Buka menu navigasi"
            aria-expanded={open}
          >
            <MIcon name="menu" className="text-[22px]" />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-on-surface/50 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigasi utama"
            className="absolute inset-y-0 right-0 flex w-[min(84vw,320px)] flex-col bg-field-white p-5 shadow-float"
          >
            <div className="flex items-center justify-between">
              <BrandMark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant hover:bg-mist-shadow"
                aria-label="Tutup"
              >
                <MIcon name="close" className="text-[20px]" />
              </button>
            </div>
            <nav className="mt-6 flex flex-col gap-1" aria-label="Navigasi utama (mobile)">
              {NAV.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-label-lg transition-colors",
                      active
                        ? "bg-court-grass-light text-court-green-deep"
                        : "text-on-surface-variant hover:bg-mist-shadow",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-auto flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-container text-label-lg text-field-white"
            >
              Masuk
              <MIcon name="arrow_forward" className="text-[18px]" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
