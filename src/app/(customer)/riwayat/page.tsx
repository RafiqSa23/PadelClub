"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { MIcon } from "@/components/ui/MIcon";
import { IconBanknote, IconClock, IconMapPin, IconTicket } from "@/components/ui/icons";
import { dateLabel, formatRupiah, hourLabel, relativeTime, todayString } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Booking, BookingStatus, PaymentStatus } from "@/lib/types";

interface CourtInfo {
  id: number;
  name: string;
  openHour: number;
  closeHour: number;
}

function toPaymentStatus(status: BookingStatus): PaymentStatus {
  if (status === "terkonfirmasi") return "paid";
  if (status === "menunggu_pembayaran") return "pending";
  return "expired";
}

function isUpcoming(booking: Booking) {
  return (
    (booking.status === "terkonfirmasi" || booking.status === "menunggu_pembayaran") &&
    booking.date >= todayString()
  );
}

type Filter = "semua" | "aktif" | "selesai" | "batal";

export default function RiwayatPage() {
  const [filter, setFilter] = useState<Filter>("semua");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courts, setCourts] = useState<CourtInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loadError, setLoadError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [bRes, cRes] = await Promise.all([
          fetch("/api/me/bookings"),
          fetch("/api/courts"),
        ]);
        const bJson = (await bRes.json()) as {
          ok: boolean;
          message?: string;
          bookings?: {
            code: string;
            courtId: number;
            courtName: string;
            date: string;
            status: BookingStatus;
            source: "online" | "walkin";
            subtotal: number;
            createdAt: string;
            hours: number[];
          }[];
        };
        const cJson = (await cRes.json()) as {
          ok: boolean;
          courts?: CourtInfo[];
        };
        if (cancelled) return;
        if (bRes.status === 401) {
          setNeedsLogin(true);
        } else if (!bJson.ok || !bJson.bookings) {
          setLoadError(bJson.message ?? "Gagal memuat riwayat.");
        } else {
          setBookings(
            bJson.bookings.map((item, index) => ({
              id: index,
              code: item.code,
              customerName: "",
              customerPhone: "",
              courtId: item.courtId,
              date: item.date,
              hours: item.hours,
              status: item.status,
              source: item.source,
              paymentStatus: toPaymentStatus(item.status),
              subtotal: item.subtotal,
              createdAt: item.createdAt,
            })),
          );
        }
        if (cJson.ok && cJson.courts) setCourts(cJson.courts);
      } catch {
        if (!cancelled) setLoadError("Tidak dapat terhubung ke server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const upcoming = bookings.filter(isUpcoming);
    const other = bookings.filter((booking) => !isUpcoming(booking));
    const sorted = [...upcoming, ...other].sort((a, b) => {
      if (a.date === b.date) return b.hours[0] - a.hours[0];
      return a.date.localeCompare(b.date);
    });
    if (filter === "aktif") return sorted.filter(isUpcoming);
    if (filter === "selesai")
      return sorted.filter(
        (booking) => booking.date < todayString() && booking.status !== "dibatalkan",
      );
    if (filter === "batal") return sorted.filter((booking) => booking.status === "dibatalkan");
    return sorted;
  }, [bookings, filter]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Akses Pemain"
        title="Riwayat booking"
        description={`${bookings.length} booking tercatat. Booking aktif selalu ditampilkan lebih dulu.`}
        action={<ButtonLink href="/booking">Booking baru</ButtonLink>}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl<Filter>
              value={filter}
              onChange={setFilter}
              ariaLabel="Filter riwayat"
              options={[
                { value: "semua", label: "Semua" },
                { value: "aktif", label: "Aktif" },
                { value: "selesai", label: "Selesai" },
                { value: "batal", label: "Dibatalkan" },
              ]}
            />
            <span className="inline-flex items-center gap-1.5 text-label-sm text-slate-whisper">
              <IconBanknote size={14} /> Pembayaran QRIS terkonfirmasi otomatis.
            </span>
          </div>

          {loading ? (
            <Card>
              <CardBody className="py-10">
                <div className="h-16 animate-pulse rounded-xl bg-mist-shadow" />
                <div className="mt-3 h-16 animate-pulse rounded-xl bg-mist-shadow" />
              </CardBody>
            </Card>
          ) : needsLogin ? (
            <Card>
              <EmptyState
                title="Masuk untuk melihat riwayat"
                description="Riwayat booking tersimpan di akun nomor HP kamu. Masuk dengan OTP untuk melihatnya."
                action={<ButtonLink href="/login">Masuk / daftar</ButtonLink>}
              />
            </Card>
          ) : loadError ? (
            <Card>
              <EmptyState
                title="Riwayat gagal dimuat"
                description={loadError}
                action={<ButtonLink href="/riwayat">Coba lagi</ButtonLink>}
              />
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                title="Belum ada booking"
                description="Slot yang kamu pilih akan muncul di sini setelah checkout."
                action={<ButtonLink href="/booking">Cari slot sekarang</ButtonLink>}
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((booking) => {
                const court = courts.find((item) => item.id === booking.courtId);
                const start = Math.min(...booking.hours);
                const end = Math.max(...booking.hours) + 1;
                const upcoming = isUpcoming(booking);
                const timeInfo = upcoming ? relativeTime(booking.date) : dateLabel(booking.date);
                return (
                  <Card key={booking.code} className={cn("transition-colors", upcoming && "ring-1 ring-court-grass-light")}>
                    <CardBody className="flex items-center justify-between gap-4 p-4 sm:p-5">
                      <Link href={`/tiket/${booking.code}`} className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                              booking.status === "dibatalkan"
                                ? "bg-danger-light text-danger"
                                : booking.status === "menunggu_pembayaran"
                                  ? "bg-pending-light text-pending-ink"
                                  : "bg-court-grass-light text-court-green-deep",
                            )}
                          >
                            <IconTicket size={20} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-label-lg text-on-surface">
                                {court?.name ?? `Lapangan ${booking.courtId}`}
                              </p>
                              {booking.status === "menunggu_pembayaran" && (
                                <Badge tone="amber">{timeInfo} · belum bayar</Badge>
                              )}
                              {booking.status === "dibatalkan" && <Badge tone="red">Dibatalkan</Badge>}
                              {upcoming && booking.status === "terkonfirmasi" && (
                                <Badge tone="blue">{timeInfo}</Badge>
                              )}
                            </div>
                            <p className="mt-1 flex items-center gap-1.5 truncate text-body-sm text-slate-whisper">
                              <IconClock size={13} /> {dateLabel(booking.date)} ·{" "}
                              {hourLabel(start, end)}
                            </p>
                          </div>
                        </div>
                      </Link>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-label-lg tabular-nums text-on-surface">
                          {formatRupiah(booking.subtotal)}
                        </span>
                        <Link
                          href={`/tiket/${booking.code}`}
                          className="text-label-md text-primary-container hover:underline"
                        >
                          Lihat tiket
                        </Link>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Card className="lg:sticky lg:top-24">
          <CardHeader title="Lokasi &amp; jam operasional" subtitle="Jadwal dapat berubah karena maintenance." />
          <CardBody>
            <ul className="space-y-3">
              {courts.slice(0, 4).map((courtHour) => (
                <li
                  key={courtHour.id}
                  className="flex items-start justify-between gap-3 border-b border-line/70 pb-3 last:border-0 last:pb-0"
                >
                  <span className="text-body-md text-on-surface">{courtHour.name}</span>
                  <span className="text-right text-body-sm tabular-nums text-slate-whisper">
                    {courtHour.openHour}:00–{courtHour.closeHour}:00
                  </span>
                </li>
              ))}
              {courts.length === 0 && (
                <li className="text-body-sm text-slate-whisper">Memuat jam operasional…</li>
              )}
            </ul>
            <div className="mt-5 rounded-xl bg-mist-shadow p-3 text-body-sm text-slate-whisper">
              <span className="flex items-center gap-1.5 text-label-md text-on-surface">
                <MIcon name="pin_drop" className="text-[15px] text-primary-container" />
                Butuh bantuan?
              </span>
              <p className="mt-1">
                Pilih slot yang tersedia atau kembali ke beranda untuk informasi klub.
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-slate-whisper">
                <IconMapPin size={13} /> Jl. TB Simatupang No. 18, Cilandak
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
