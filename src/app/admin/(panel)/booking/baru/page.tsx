"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, PhoneInput, Select, TextInput } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { MIcon } from "@/components/ui/MIcon";
import { addDays, dateLabel, formatRupiah, hourLabel, todayString } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Court, Slot } from "@/lib/types";
import type { DaySchedule } from "@/lib/slots";

function ManualBookingForm() {
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [courtId, setCourtId] = useState<number>(() => Number(params.get("court")) || 1);
  const [date, setDate] = useState(() => params.get("date") || todayString());
  const [startHour, setStartHour] = useState<number>(() => Number(params.get("hour")) || 18);
  const [duration, setDuration] = useState(1);
  const [payNow, setPayNow] = useState<"paid" | "pending">("paid");
  const [error, setError] = useState<string | undefined>();
  const [created, setCreated] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/courts", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { courts: Court[] };
        if (!cancelled) setCourts(json.courts);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/schedule?date=${date}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { schedule: DaySchedule };
        if (cancelled) return;
        setSlots(
          json.schedule.slots.map((s) => ({
            courtId: s.courtId,
            date,
            hour: s.hour,
            status: s.status,
            code: s.code ?? undefined,
            reason: s.reason ?? undefined,
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [date]);

  const court = courts.find((item) => item.id === courtId);
  const availableHours = useMemo(() => {
    const set = new Set(slots.filter((s) => s.courtId === courtId).map((s) => s.hour));
    return [...set].sort((a, b) => a - b);
  }, [slots, courtId]);
  const hours = Array.from({ length: duration }, (_, index) => startHour + index).filter(
    (hour, index, all) =>
      index === 0 ? true : availableHours.includes(hour) && hour === all[index - 1] + 1,
  );
  const ends = hours.length ? Math.max(...hours) + 1 : startHour + 1;
  const subtotal = hours.length * (court?.hourlyPrice ?? 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (!name.trim() || phone.replace(/\D/g, "").length < 9) {
      setError("Nama dan nomor HP diwajibkan.");
      return;
    }
    if (hours.length === 0) {
      setError("Durasi melewati jam tutup — kurangi jumlah jam.");
      return;
    }
    const conflict = hours.find(
      (hour) =>
        slots.find((slot) => slot.courtId === courtId && slot.hour === hour)?.status !== "kosong",
    );
    if (conflict !== undefined) {
      const slot = slots.find((item) => item.courtId === courtId && item.hour === conflict);
      setError(
        `Jam ${String(conflict).padStart(2, "0")}:00 sudah "${
          slot?.status === "tutup" ? "Tutup" : "Dibooking"
        }". Pilih jam lain.`,
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId,
          date,
          hours,
          name: name.trim(),
          phone: phone.trim(),
          paid: payNow === "paid",
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; booking?: { code: string } };
      if (!json.ok || !json.booking) {
        setError(json.message ?? "Gagal membuat booking.");
        return;
      }
      setCreated(json.booking.code);
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setSaving(false);
    }
  }

  const whatsapp = created
    ? `https://wa.me/6281234567890?text=${encodeURIComponent(
        `Halo ${name}, tiket PadelClub Anda:\nKode ${created}\n${court?.name ?? ""}\n${dateLabel(date)} ${hourLabel(startHour, ends)}`,
      )}`
    : "#";

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader
            title="Form booking manual"
            subtitle="Walk-in / telepon — booking dibuat langsung oleh admin."
          />
          <CardBody>
            <form onSubmit={submit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama" htmlFor="mb-name">
                  <TextInput
                    id="mb-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nama pelanggan"
                  />
                </Field>
                <Field label="Nomor HP" htmlFor="mb-phone">
                  <PhoneInput
                    id="mb-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="812 3456 7890"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Lapangan" htmlFor="mb-court">
                  <Select
                    id="mb-court"
                    value={courtId}
                    onChange={(event) => setCourtId(Number(event.target.value))}
                  >
                    {courts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {formatRupiah(item.hourlyPrice)}/jam
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tanggal" htmlFor="mb-date" hint={`Hari ini: ${dateLabel(todayString())}`}>
                  <TextInput
                    id="mb-date"
                    type="date"
                    value={date}
                    min={todayString()}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Jam mulai" htmlFor="mb-start" hint="Format 24 jam">
                  <Select
                    id="mb-start"
                    value={startHour}
                    onChange={(event) => setStartHour(Number(event.target.value))}
                  >
                    {availableHours.map((hour) => (
                      <option key={hour} value={hour}>
                        {String(hour).padStart(2, "0")}:00
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Durasi" htmlFor="mb-dur">
                  <Select
                    id="mb-dur"
                    value={duration}
                    onChange={(event) => setDuration(Number(event.target.value))}
                  >
                    {[1, 2, 3, 4].map((value) => (
                      <option key={value} value={value}>
                        {value} jam
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div>
                <p className="mb-1.5 text-label-md text-on-surface">Metode pembayaran</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPayNow("paid")}
                    aria-pressed={payNow === "paid"}
                    className={cn(
                      "cursor-pointer rounded-xl border p-3 text-left transition-colors",
                      payNow === "paid"
                        ? "border-primary-container bg-court-grass-light"
                        : "border-line bg-field-white hover:border-primary-container/50",
                    )}
                  >
                    <p className="text-label-lg text-on-surface">Tunai / sudah bayar</p>
                    <p className="mt-1 text-body-sm text-slate-whisper">
                      Langsung terkonfirmasi
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayNow("pending")}
                    aria-pressed={payNow === "pending"}
                    className={cn(
                      "cursor-pointer rounded-xl border p-3 text-left transition-colors",
                      payNow === "pending"
                        ? "border-primary-container bg-court-grass-light"
                        : "border-line bg-field-white hover:border-primary-container/50",
                    )}
                  >
                    <p className="text-label-lg text-on-surface">Belum bayar</p>
                    <p className="mt-1 text-body-sm text-slate-whisper">
                      Menunggu pembayaran / utang
                    </p>
                  </button>
                </div>
              </div>

              {error && (
                <p
                  className="flex items-center gap-2 rounded-xl bg-error-container p-3 text-body-sm font-semibold text-on-error-container"
                  role="alert"
                >
                  <MIcon name="error" className="text-[16px]" />
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" fullWidth loading={saving}>
                {saving ? "Menyimpan…" : `Buat booking (${hours.length} jam)`}
              </Button>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Ringkasan" subtitle="Periksa sebelum menyimpan." />
            <CardBody>
              <dl className="space-y-3 text-body-md">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-whisper">Lapangan</dt>
                  <dd className="font-semibold text-on-surface">{court?.name ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-whisper">Tanggal</dt>
                  <dd className="text-on-surface">{dateLabel(date)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-whisper">Jam</dt>
                  <dd className="tabular-nums text-on-surface">{hourLabel(startHour, ends)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-whisper">Status</dt>
                  <dd>
                    {payNow === "paid" ? (
                      <Badge tone="green">Terkonfirmasi</Badge>
                    ) : (
                      <Badge tone="amber">Menunggu bayar</Badge>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-line pt-3">
                  <dt className="text-label-lg text-on-surface">Total</dt>
                  <dd className="text-label-lg tabular-nums text-court-green-deep">
                    {formatRupiah(subtotal)}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDate(todayString())}
                  className="min-h-11 cursor-pointer rounded-xl border border-line text-label-md text-on-surface transition-colors hover:border-primary-container/50 hover:bg-court-grass-light/60"
                >
                  Hari ini
                </button>
                <button
                  type="button"
                  onClick={() => setDate(addDays(todayString(), 1))}
                  className="min-h-11 cursor-pointer rounded-xl border border-line text-label-md text-on-surface transition-colors hover:border-primary-container/50 hover:bg-court-grass-light/60"
                >
                  Besok
                </button>
              </div>
            </CardBody>
          </Card>

          <div className="flex items-start gap-2 rounded-xl bg-court-grass-light p-4 text-body-sm leading-5 text-court-green-deep">
            <MIcon name="info" className="mt-0.5 shrink-0 text-[16px]" />
            Booking tersimpan ke database dan langsung memblokir slot di halaman customer.
          </div>
        </div>
      </div>

      <Modal
        open={!!created}
        onClose={() => setCreated(null)}
        title="Booking berhasil dibuat"
      >
        {created && (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-court-grass-light text-court-green-deep">
              <MIcon name="check_circle" className="text-[30px]" />
            </span>
            <div>
              <p className="text-headline-sm text-on-surface">Kode: {created}</p>
              <p className="mt-1 text-body-md text-slate-whisper">
                {court?.name} · {dateLabel(date)} · {hourLabel(startHour, ends)}
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2">
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-field-white px-4 text-label-lg text-on-surface transition-colors hover:bg-court-grass-light/60"
              >
                <MIcon name="chat" className="text-[16px]" />
                WhatsApp
              </a>
              <ButtonLink href={`/tiket/${created}`} fullWidth>
                Lihat tiket
              </ButtonLink>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function AdminBookingBaruPage() {
  return (
    <AdminShell title="Booking Manual">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          eyebrow="Operasional"
          title="Booking manual"
          description="Buat reservasi untuk pelanggan walk-in atau pelanggan yang memesan melalui telepon."
        />
        <Suspense
          fallback={
            <div className="rounded-2xl bg-field-white p-6 text-body-md text-slate-whisper shadow-sm">
              Memuat form booking…
            </div>
          }
        >
          <ManualBookingForm />
        </Suspense>
      </div>
    </AdminShell>
  );
}
