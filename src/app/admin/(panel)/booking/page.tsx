"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { MIcon } from "@/components/ui/MIcon";
import { dateLabel, formatRupiah, hourLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { BookingStatus } from "@/lib/types";

interface AdminBookingRow {
  code: string;
  courtId: number;
  courtName: string;
  date: string;
  status: BookingStatus;
  source: "online" | "walkin";
  subtotal: number;
  expiresAt: string | null;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  paymentStatus: "pending" | "paid" | "failed" | "expired" | null;
  checkedInAt: string | null;
  hours: number[];
  expiringSoon: boolean;
}

const statusLabel: Record<BookingStatus, string> = {
  terkonfirmasi: "Terkonfirmasi",
  menunggu_pembayaran: "Menunggu bayar",
  dibatalkan: "Dibatalkan",
};

const filters: Array<{ key: "semua" | BookingStatus; label: string }> = [
  { key: "semua", label: "Semua" },
  { key: "terkonfirmasi", label: "Terkonfirmasi" },
  { key: "menunggu_pembayaran", label: "Menunggu" },
  { key: "dibatalkan", label: "Dibatalkan" },
];

export default function AdminBookingPage() {
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ total: 0, menunggu: 0, confirmed: 0, cancelled: 0 });
  const [status, setStatus] = useState<"semua" | BookingStatus>("semua");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<AdminBookingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  async function fetchList(currentStatus: "semua" | BookingStatus, query: string) {
    const params = new URLSearchParams({ status: currentStatus, limit: "50", offset: "0" });
    if (query.trim()) params.set("search", query.trim());
    const res = await fetch(`/api/admin/bookings?${params.toString()}`, { cache: "no-store" });
    if (res.status === 401) throw new Error("Sesi admin berakhir. Login ulang.");
    if (!res.ok) throw new Error("Gagal memuat booking.");
    const json = (await res.json()) as {
      bookings: Array<Omit<AdminBookingRow, "expiringSoon">>;
      total: number;
    };
    const now = Date.now();
    return {
      rows: json.bookings.map((b) => ({
        ...b,
        expiringSoon:
          b.status === "menunggu_pembayaran" &&
          !!b.expiresAt &&
          new Date(b.expiresAt).getTime() - now <= 5 * 60_000,
      })),
      total: json.total,
    };
  }

  async function reload(currentStatus: "semua" | BookingStatus, query: string) {
    try {
      const [list, ...totals] = await Promise.all([
        fetchList(currentStatus, query),
        fetchList("semua", ""),
        fetchList("menunggu_pembayaran", ""),
        fetchList("terkonfirmasi", ""),
        fetchList("dibatalkan", ""),
      ]);
      setBookings(list.rows);
      setTotal(list.total);
      setCounts({
        total: totals[0].total,
        menunggu: totals[1].total,
        confirmed: totals[2].total,
        cancelled: totals[3].total,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat booking.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload(status, search);
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  async function act(code: string, action: "confirm" | "cancel") {    setActing(true);
    try {
      const res = await fetch(`/api/admin/bookings/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        setError(json.message ?? "Aksi gagal.");
        return;
      }
      await reload(status, search);
      setActive(null);
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setActing(false);
    }
  }

  async function checkin(code: string) {
    setActing(true);
    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        message?: string;
        ticket?: { checkedInAt: string | null };
      };
      if (!json.ok) {
        setError(json.message ?? "Check-in gagal.");
        return;
      }
      await reload(status, search);
      setActive((prev) =>
        prev ? { ...prev, checkedInAt: json.ticket?.checkedInAt ?? prev.checkedInAt } : prev,
      );
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setActing(false);
    }
  }

  return (
    <AdminShell title="Booking">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          eyebrow="Manajemen reservasi"
          title="Booking"
          description="Cari, filter, dan kelola status setiap booking dari satu tempat."
          action={
            <ButtonLink
              href="/admin/booking/baru"
              icon={<MIcon name="add_circle" className="text-[18px]" />}
            >
              Booking manual
            </ButtonLink>
          }
        />

        {/* Toolbar cari + filter */}
        <Card>
          <CardBody className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <MIcon
                name="search"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-slate-whisper"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setLoading(true);
                  setSearch(event.target.value);
                }}
                placeholder="Cari nama, HP, kode, lapangan…"
                aria-label="Cari booking"
                className="h-11 w-full rounded-xl border border-line bg-field-white pl-10 pr-3 text-body-md text-on-surface outline-none transition-colors focus:border-primary-container"
              />
            </div>
            <div
              className="flex shrink-0 flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Filter status"
            >
              <MIcon name="filter_list" className="text-[18px] text-slate-whisper" />
              {filters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setStatus(filter.key);
                  }}
                  className={cn(
                    "min-h-11 cursor-pointer rounded-xl px-3.5 text-label-md transition-colors",
                    status === filter.key
                      ? "bg-primary-container text-field-white shadow-sm"
                      : "bg-mist-shadow text-slate-whisper hover:bg-court-grass-light hover:text-court-green-deep",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Statistik ringkas */}
        {error && (
          <p
            className="rounded-xl bg-danger-light px-4 py-3 text-body-md font-semibold text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total booking", value: String(counts.total), tone: "text-on-surface" },
            {
              label: "Menunggu bayar",
              value: String(counts.menunggu),
              tone: "text-pending-ink",
            },
            {
              label: "Terkonfirmasi",
              value: String(counts.confirmed),
              tone: "text-court-green-deep",
            },
            {
              label: "Dibatalkan",
              value: String(counts.cancelled),
              tone: "text-error",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl bg-field-white p-4 shadow-sm"
            >
              <span className="block text-label-sm uppercase tracking-wider text-slate-whisper">
                {item.label}
              </span>
              <span className={cn("mt-1 block text-headline-md tabular-nums", item.tone)}>
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Tabel booking */}
        <Card>
          {!loading && (
            <p className="px-4 pt-4 text-body-sm text-slate-whisper">
              Menampilkan {bookings.length} dari {total} booking
            </p>
          )}
          {loading && bookings.length === 0 ? (
            <p className="p-6 text-body-md text-slate-whisper">Memuat booking…</p>
          ) : bookings.length === 0 ? (
            <EmptyState
              title="Tidak ada booking"
              description="Ubah filter atau cari dengan kata kunci lain."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setStatus("semua");
                  }}
                >
                  Reset filter
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-body-md">
                <thead>
                  <tr className="border-b border-line bg-mist/70 text-left text-label-sm uppercase tracking-wider text-slate-whisper">
                    <th className="px-4 py-3">Kode</th>
                    <th className="px-4 py-3">Pemesan</th>
                    <th className="px-4 py-3">Lapangan</th>
                    <th className="px-4 py-3">Jadwal</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => {
                    const start = Math.min(...booking.hours);
                    const end = Math.max(...booking.hours) + 1;
                    return (
                      <tr
                        key={booking.code}
                        className="border-b border-line/70 last:border-0 hover:bg-court-grass-light/40"
                      >
                        <td className="whitespace-nowrap px-4 py-4 font-mono text-body-sm font-semibold text-court-green-deep">
                          {booking.code}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-label-lg text-on-surface">{booking.customerName ?? "—"}</p>
                          <p className="text-body-sm tabular-nums text-slate-whisper">
                            {booking.customerPhone ?? "—"}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-on-surface">
                          {booking.courtName}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <p className="text-on-surface">{dateLabel(booking.date)}</p>
                          <p className="text-body-sm tabular-nums text-slate-whisper">
                            {hourLabel(start, end)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-label-lg tabular-nums text-on-surface">
                          {formatRupiah(booking.subtotal)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={booking.status}>
                              {statusLabel[booking.status]}
                            </StatusBadge>
                            {booking.status !== "dibatalkan" && (
                              <Badge tone={booking.paymentStatus === "paid" ? "green" : "amber"}>
                                {booking.paymentStatus === "paid" ? "Lunas" : "Belum"}
                              </Badge>
                            )}
                            {booking.expiringSoon && (
                              <Badge tone="amber">Segera kedaluwarsa</Badge>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setActive(booking)}
                            className="min-h-11 cursor-pointer px-2 text-label-lg text-court-green-deep hover:underline"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={active ? `Booking ${active.code}` : "Detail booking"}
        size="md"
      >
        {active && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge status={active.status}>{statusLabel[active.status]}</StatusBadge>
              <Badge tone="neutral">
                {active.source === "walkin" ? "Walk-in" : "Online"}
              </Badge>
            </div>

            <dl className="space-y-3 text-body-md">
              {[
                { term: "Pemesan", value: active.customerName ?? "—", strong: true },
                { term: "Nomor HP", value: active.customerPhone ?? "—", mono: true },
                {
                  term: "Lapangan",
                  value: active.courtName,
                },
                {
                  term: "Jadwal",
                  value: `${dateLabel(active.date)} · ${hourLabel(
                    Math.min(...active.hours),
                    Math.max(...active.hours) + 1,
                  )}`,
                  mono: true,
                },
                { term: "Total", value: formatRupiah(active.subtotal), strong: true, mono: true },
              ].map((row) => (
                <div key={row.term} className="flex justify-between gap-3">
                  <dt className="text-slate-whisper">{row.term}</dt>
                  <dd
                    className={cn(
                      row.strong && "font-semibold text-on-surface",
                      !row.strong && "text-on-surface",
                      row.mono && "tabular-nums",
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-3">
                <dt className="text-slate-whisper">Pembayaran</dt>
                <dd>
                  {active.paymentStatus === "paid" ? (
                    <Badge tone="green">Lunas</Badge>
                  ) : (
                    <Badge tone="amber">Menunggu</Badge>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-whisper">Check-in</dt>
                <dd>
                  {active.checkedInAt ? (
                    <Badge tone="green">Sudah check-in</Badge>
                  ) : (
                    <Badge tone="neutral">Belum</Badge>
                  )}
                </dd>
              </div>
            </dl>

            {active.status === "dibatalkan" && (
              <p className="flex items-center gap-2 rounded-xl bg-error-container p-3 text-body-sm font-semibold text-on-error-container">
                <MIcon name="info" className="text-[16px]" />
                Booking sudah dibatalkan. Slot telah dikembalikan.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {active.status === "menunggu_pembayaran" && (
                <Button
                  onClick={() => void act(active.code, "confirm")}
                  loading={acting}
                >
                  Konfirmasi bayar
                </Button>
              )}
              {active.status === "terkonfirmasi" && !active.checkedInAt && (
                <Button
                  onClick={() => void checkin(active.code)}
                  loading={acting}
                >
                  Tandai check-in
                </Button>
              )}
              {active.status !== "dibatalkan" && (
                <Button
                  variant="outline-danger"
                  onClick={() => void act(active.code, "cancel")}
                  loading={acting}
                >
                  Batalkan booking
                </Button>
              )}
            </div>

            <p className="flex items-center gap-1.5 text-body-sm text-slate-whisper">
              <MIcon name="confirmation_number" className="text-[16px]" />
              Lihat tiket di{" "}
              <Link
                href={`/tiket/${active.code}`}
                className="font-semibold text-court-green-deep hover:underline"
              >
                /tiket/{active.code}
              </Link>
            </p>
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}
