"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Brand } from "./Brand";
import { MIcon } from "@/components/ui/MIcon";
import { ASSETS } from "@/lib/assets";
import { ADMIN_SESSION_COOKIE } from "@/lib/constants";

const PRIMARY_NAV = [
  { href: "/admin/jadwal", label: "Matrix Slot & Kasir", icon: "grid_view" },
  { href: "/admin/papan-jadwal", label: "Jadwal Publik", icon: "calendar_today" },
  { href: "/admin/scanner", label: "Scanner Tiket", icon: "qr_code_scanner" },
  { href: "/admin/monitoring", label: "Lihat Web Publik", icon: "storefront" },
];

const SECONDARY_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "space_dashboard" },
  { href: "/admin/booking", label: "Booking", icon: "confirmation_number" },
  { href: "/admin/booking/baru", label: "Booking Manual", icon: "add_circle" },
  { href: "/admin/lapangan", label: "Lapangan", icon: "settings" },
  { href: "/admin/laporan", label: "Laporan", icon: "bar_chart" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin/booking") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  href,
  label,
  icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 text-label-lg transition-colors",
        active
          ? "bg-court-grass-light font-semibold text-court-green-deep"
          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
      )}
    >
      <MIcon name={icon} className={cn("text-[20px]", active ? "text-primary-container" : "")} />
      {label}
    </Link>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const router = useRouter();

  function logout() {
    document.cookie = `${ADMIN_SESSION_COOKIE}=; path=/; max-age=0`;
    router.push("/admin");
  }

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/admin/dashboard"
        className="flex items-center gap-3 px-5 pb-4 pt-5"
        onClick={onNavigate}
      >
        <Brand />
        <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-slate-whisper sm:block">
          HQ Management
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navigasi operasional">
        <p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-whisper/70">
          Navigasi Operasional
        </p>
        <div className="space-y-1">
          {PRIMARY_NAV.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={isActivePath(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <p className="px-3 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-whisper/70">
          Panel Lain
        </p>
        <div className="space-y-1">
          {SECONDARY_NAV.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={isActivePath(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <div className="mt-6 space-y-1 border-t border-line/80 pt-3">
          <Link
            href="/"
            onClick={onNavigate}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-label-lg text-on-surface-variant transition-colors hover:bg-mist-shadow hover:text-on-surface"
          >
            <MIcon name="open_in_new" className="text-[20px]" />
            Lihat Situs
          </Link>
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              logout();
            }}
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-label-lg transition-colors hover:bg-error-container/40 hover:text-error"
          >
            <MIcon name="logout" className="text-[20px]" />
            Keluar
          </button>
        </div>
      </nav>

      <div className="p-4">
        <div className="rounded-xl bg-surface-container-low p-4">
          <div className="flex items-center gap-2 text-label-sm text-on-surface-variant">
            <span className="h-2 w-2 rounded-full bg-primary-container animate-pulse" />
            Status Shift
          </div>
          <p className="mt-1 text-label-md text-on-surface">Shift Aktif: Admin - Aditya</p>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ title, children }: { title?: string; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-mist-shadow">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-line/70 bg-field-white lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-on-surface/50 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
          />
          <aside
            id="admin-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigasi admin"
            className="absolute inset-y-0 left-0 w-[min(84vw,300px)] bg-field-white shadow-float"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant hover:bg-mist-shadow"
              aria-label="Tutup"
            >
              <MIcon name="close" className="text-[20px]" />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="fixed inset-x-0 top-0 z-30 h-16 bg-field-white/90 backdrop-blur-xl lg:left-72">
          <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-on-surface-variant hover:bg-mist-shadow lg:hidden"
                aria-label="Buka menu"
                aria-controls="admin-mobile-navigation"
              >
                <MIcon name="menu" className="text-[22px]" />
              </button>
              <span className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full bg-court-grass-light px-3 text-label-sm text-court-green-deep">
                <MIcon name="sensors" className="text-[16px]" />
                <span className="hidden sm:inline">Mode Operasional Live</span>
                <span className="sm:hidden">Live</span>
              </span>
              {title && (
                <span className="hidden min-w-0 truncate text-label-md text-slate-whisper md:inline">
                  {title}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <Link
                href="/admin/booking/baru"
                className="hidden min-h-9 items-center gap-1.5 rounded-lg bg-primary-container px-3.5 text-label-md text-field-white shadow-sm transition-colors hover:bg-court-green-deep sm:inline-flex"
              >
                <MIcon name="bolt" className="text-[16px]" />
                Reservasi Cepat
              </Link>
              <span className="flex items-center gap-2.5">
                <span className="hidden text-right leading-tight sm:block">
                  <span className="block text-label-md text-on-surface">Aditya P.</span>
                  <span className="block text-label-sm text-slate-whisper">Super Admin</span>
                </span>
                <Image
                  src={ASSETS.avatar}
                  alt=""
                  width={72}
                  height={72}
                  unoptimized
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-court-grass-light"
                />
              </span>
            </div>
          </div>
        </header>

        <main className="min-h-screen pt-16">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-6 pt-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
