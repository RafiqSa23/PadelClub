"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { Select, TextInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { MIcon } from "@/components/ui/MIcon";
import { addDays, dateLabel, formatRupiah, todayString } from "@/lib/format";
import { cn } from "@/lib/cn";

type Period = "today" | "week" | "month" | "custom";

interface CourtReport {
  courtId: number;
  name: string;
  isIndoor: boolean;
  bookingCount: number;
  revenue: number;
  occupiedSlots: number;
  totalSlots: number;
  occupancyPct: number;
}

interface ReportSummary {
  omzet: number;
  totalBookings: number;
  cancelled: number;
  waiting: number;
  avgOccupancy: number;
}

export default function AdminLaporanPage() {
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState(addDays(todayString(), -6));
  const [to, setTo] = useState(todayString());
  const [courtFilter, setCourtFilter] = useState<"semua" | number>("semua");
  const [courts, setCourts] = useState<CourtReport[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    omzet: 0,
    totalBookings: 0,
    cancelled: 0,
    waiting: 0,
    avgOccupancy: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { start, end } = useMemo(() => {
    if (period === "today") {
      const day = todayString();
      return { start: day, end: day };
    }
    if (period === "week") {
      return { start: addDays(todayString(), -6), end: todayString() };
    }
    if (period === "month") {
      return { start: addDays(todayString(), -29), end: todayString() };
    }
    if (!from || !to || to < from) {
      return { start: addDays(todayString(), -6), end: todayString() };
    }
    return { start: from, end: to };
  }, [period, from, to]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ from: start, to: end });
        if (courtFilter !== "semua") params.set("courtId", String(courtFilter));
        const res = await fetch(`/api/admin/reports?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.status === 401) throw new Error("Sesi admin berakhir. Login ulang.");
        const json = (await res.json()) as {
          ok: boolean;
          message?: string;
          summary?: ReportSummary;
          courts?: CourtReport[];
        };
        if (!json.ok || !json.summary || !json.courts) {
          throw new Error(json.message ?? "Gagal memuat laporan.");
        }
        if (cancelled) return;
        setSummary(json.summary);
        setCourts(json.courts);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat laporan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [start, end, courtFilter]);

  const averageOccupancy = summary.avgOccupancy;

  function exportCsv() {
    const params = new URLSearchParams({ from: start, to: end, format: "csv" });
    if (courtFilter !== "semua") params.set("courtId", String(courtFilter));
    // Unduhan file via anchor (navigasi top-level mengirim cookie sesi admin).
    const link = document.createElement("a");
    link.href = `/api/admin/reports?${params.toString()}`;
    link.download = `laporan-padelclub-${start}-${end}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const periods: Array<{ key: Period; label: string }> = [
    { key: "today", label: "Hari ini" },
    { key: "week", label: "7 hari" },
    { key: "month", label: "30 hari" },
    { key: "custom", label: "Kustom" },
  ];

  return (
    <AdminShell title="Laporan & Rekap">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          eyebrow="Insight operasional"
          title="Laporan"
          description="Pantau pola penggunaan lapangan dan unduh rekap periode pilihanmu."
          action={
            <Button
              onClick={exportCsv}
              variant="secondary"
              icon={<MIcon name="download" className="text-[18px]" />}
            >
              Export CSV
            </Button>
          }
        />

        {/* Filter periode */}
        <Card>
          <CardBody className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Periode"
            >
              {periods.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPeriod(item.key)}
                  className={cn(
                    "min-h-11 cursor-pointer rounded-xl px-3.5 text-label-md transition-colors",
                    period === item.key
                      ? "bg-primary-container text-field-white shadow-sm"
                      : "bg-mist-shadow text-slate-whisper hover:bg-court-grass-light hover:text-court-green-deep",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {period === "custom" && (
                <>
                  <TextInput
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    className="w-40"
                    aria-label="Dari tanggal"
                  />
                  <span className="text-slate-whisper">–</span>
                  <TextInput
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    className="w-40"
                    aria-label="Sampai tanggal"
                  />
                </>
              )}
              <Select
                value={courtFilter}
                onChange={(event) =>
                  setCourtFilter(event.target.value === "semua" ? "semua" : Number(event.target.value))
                }
                className="w-44"
                aria-label="Filter lapangan"
              >
                <option value="semua">Semua lapangan</option>
                {courts.map((court) => (
                  <option key={court.courtId} value={court.courtId}>
                    {court.name}
                  </option>
                ))}
              </Select>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Omzet"
            value={formatRupiah(summary.omzet)}
            sub={`${start} – ${end}`}
            icon={<MIcon name="payments" className="text-[22px]" />}
            accent="court"
          />
          <StatCard
            label="Booking terkonfirmasi"
            value={String(summary.totalBookings)}
            sub="transaksi berhasil"
            icon={<MIcon name="confirmation_number" className="text-[22px]" />}
            accent="blue"
          />
          <StatCard
            label="Dibatalkan"
            value={String(summary.cancelled)}
            sub="pembatalan periode"
            icon={<MIcon name="cancel" className="text-[22px]" />}
            accent="red"
          />
          <StatCard
            label="Okupansi rata-rata"
            value={`${averageOccupancy}%`}
            sub="slot terisi vs tersedia"
            icon={<MIcon name="donut_small" className="text-[22px]" />}
            accent="amber"
          />
        </div>

        <Card>
          <CardHeader
            title="Rekap per lapangan"
            subtitle={`${dateLabel(start)} – ${dateLabel(end)}`}
            action={<Badge tone="neutral">{courts.length} lapangan</Badge>}
          />
          <CardBody>
            {loading ? (
              <div className="space-y-3">
                <div className="h-12 animate-pulse rounded-xl bg-mist-shadow" />
                <div className="h-12 animate-pulse rounded-xl bg-mist-shadow" />
              </div>
            ) : error ? (
              <EmptyState
                title="Laporan gagal dimuat"
                description={error}
                action={<ButtonLink href="/admin/laporan">Coba lagi</ButtonLink>}
              />
            ) : courts.length === 0 ? (
              <EmptyState
                title="Tidak ada data"
                description="Belum ada slot terisi pada periode ini."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-body-md">
                  <thead>
                    <tr className="border-b border-line text-left text-label-sm uppercase tracking-wider text-slate-whisper">
                      <th className="px-4 py-3">Lapangan</th>
                      <th className="px-4 py-3">Booking</th>
                      <th className="px-4 py-3">Omzet</th>
                      <th className="px-4 py-3">Okupansi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courts.map((row) => (
                      <tr
                        key={row.courtId}
                        className="border-b border-line/70 last:border-0 hover:bg-court-grass-light/40"
                      >
                        <td className="px-4 py-4">
                          <p className="text-label-lg text-on-surface">{row.name}</p>
                          <p className="text-body-sm text-slate-whisper">
                            {row.isIndoor ? "Indoor" : "Outdoor"}
                          </p>
                        </td>
                        <td className="px-4 py-4 tabular-nums text-on-surface">
                          {row.bookingCount}
                        </td>
                        <td className="px-4 py-4 text-label-lg tabular-nums text-on-surface">
                          {formatRupiah(row.revenue)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-mist-shadow">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  row.occupancyPct >= 70
                                    ? "bg-error-red"
                                    : row.occupancyPct >= 40
                                      ? "bg-pending-amber"
                                      : "bg-primary-container",
                                )}
                                style={{ width: `${row.occupancyPct}%` }}
                              />
                            </div>
                            <span className="text-body-sm tabular-nums text-slate-whisper">
                              {row.occupancyPct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <p className="text-center text-body-sm text-slate-whisper">
          Angka berbasis data operasional real. Export CSV diunduh langsung dari server.
        </p>
      </div>
    </AdminShell>
  );
}
