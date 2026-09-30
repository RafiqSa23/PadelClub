"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Select, TextInput } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toggle } from "@/components/ui/Toggle";
import { MIcon } from "@/components/ui/MIcon";
import { dateLabel, hourLabel, todayString } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Court, Closure } from "@/lib/types";

interface CourtWithHours extends Court {
  openHour: number;
  closeHour: number;
}

interface ClosureRow {
  id: number;
  courtId: number;
  closureDate: string;
  startHour: number | null;
  endHour: number | null;
  reason: string | null;
}

function toClosure(row: ClosureRow): Closure {
  return {
    id: row.id,
    courtId: row.courtId,
    date: row.closureDate,
    startHour: row.startHour,
    endHour: row.endHour,
    reason: row.reason ?? "",
  };
}

export default function AdminLapanganPage() {
  const [courts, setCourts] = useState<CourtWithHours[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CourtWithHours | null>(null);
  const [addingClosure, setAddingClosure] = useState(false);
  const [tambahOpen, setTambahOpen] = useState(false);
  const [closureCourt, setClosureCourt] = useState(1);
  const [closureDate, setClosureDate] = useState(todayString());
  const [closureAllDay, setClosureAllDay] = useState(true);
  const [closureStart, setClosureStart] = useState(9);
  const [closureEnd, setClosureEnd] = useState(12);
  const [closureReason, setClosureReason] = useState("");
  const [editForm, setEditForm] = useState<{
    price: number;
    open: number;
    close: number;
    active: boolean;
  } | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [courtsRes, closuresRes] = await Promise.all([
        fetch("/api/courts", { cache: "no-store" }),
        fetch("/api/admin/closures", { cache: "no-store" }),
      ]);
      if (!courtsRes.ok) throw new Error("Gagal memuat data lapangan.");
      const courtsJson = (await courtsRes.json()) as { courts: CourtWithHours[] };
      setCourts(courtsJson.courts);
      if (closuresRes.ok) {
        const closuresJson = (await closuresRes.json()) as { closures: ClosureRow[] };
        setClosures(closuresJson.closures.map(toClosure));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [courtsRes, closuresRes] = await Promise.all([
          fetch("/api/courts", { cache: "no-store" }),
          fetch("/api/admin/closures", { cache: "no-store" }),
        ]);
        if (!courtsRes.ok) throw new Error("Gagal memuat data lapangan.");
        const courtsJson = (await courtsRes.json()) as { courts: CourtWithHours[] };
        const closuresJson = closuresRes.ok
          ? ((await closuresRes.json()) as { closures: ClosureRow[] })
          : { closures: [] as ClosureRow[] };
        if (cancelled) return;
        setCourts(courtsJson.courts);
        setClosures(closuresJson.closures.map(toClosure));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function openEdit(court: CourtWithHours) {
    setEditing(court);
    setEditForm({
      price: court.hourlyPrice,
      open: court.openHour,
      close: court.closeHour,
      active: court.isActive,
    });
  }

  async function saveCourt() {
    if (!editing || !editForm) return;
    const { price, open, close, active } = editForm;
    try {
      const res = await fetch(`/api/admin/courts/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hourlyPrice: price,
          isActive: active,
          openHour: open,
          closeHour: close,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan. Sesi admin mungkin berakhir.");
      await loadAll();
      setEditing(null);
      setEditForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    }
  }

  async function addClosure() {
    if (!closureReason.trim()) return;
    try {
      const res = await fetch("/api/admin/closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: closureCourt,
          date: closureDate,
          startHour: closureAllDay ? null : closureStart,
          endHour: closureAllDay ? null : closureEnd,
          reason: closureReason.trim(),
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan penutupan.");
      await loadAll();
      setAddingClosure(false);
      setClosureReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan penutupan.");
    }
  }

  async function removeClosure(id: number) {
    try {
      const res = await fetch(`/api/admin/closures/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus penutupan.");
      setClosures((previous) => previous.filter((entry) => entry.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  async function addCourt() {
    try {
      const res = await fetch("/api/admin/courts", { method: "POST" });
      if (!res.ok) throw new Error("Gagal menambah lapangan.");
      await loadAll();
      setTambahOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah lapangan.");
    }
  }

  const sortedClosures = [...closures].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <AdminShell title="Kelola Lapangan">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          eyebrow="Konfigurasi"
          title="Lapangan"
          description="Atur harga, jam operasional, dan penutupan lapangan agar jadwal selalu akurat."
          action={
            <Button onClick={() => setTambahOpen(true)} icon={<MIcon name="add" className="text-[18px]" />}>
              Tambah lapangan
            </Button>
          }
        />

        {/* Kartu lapangan */}
        {error && (
          <p
            className="rounded-xl bg-danger-light px-4 py-3 text-body-md font-semibold text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
        {loading && courts.length === 0 ? (
          <p className="text-body-md text-slate-whisper">Memuat data lapangan…</p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courts.map((court) => {
            const activeClosures = closures.filter(
              (item) => item.courtId === court.id && item.date >= todayString(),
            );

            return (
              <Card key={court.id} className={cn("flex flex-col", !court.isActive && "opacity-70")}>
                <CardBody className="flex flex-1 flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-court-grass-light text-court-green-deep">
                        <MIcon name="pin_drop" className="text-[20px]" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-label-lg text-on-surface">{court.name}</p>
                        <p className="text-body-sm text-slate-whisper">{court.description}</p>
                      </div>
                    </div>
                    <Badge tone={court.isActive ? "green" : "grey"}>
                      {court.isActive ? "Aktif" : "Non aktif"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-mist-shadow p-3.5 text-body-md">
                    <div>
                      <p className="text-body-sm text-slate-whisper">Harga / jam</p>
                      <p className="text-label-lg tabular-nums text-on-surface">
                        Rp {court.hourlyPrice.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div>
                      <p className="text-body-sm text-slate-whisper">Jam operasional</p>
                      <p className="text-label-lg tabular-nums text-on-surface">
                        {hourLabel(court.openHour, court.closeHour)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-body-sm text-slate-whisper">Tipe</p>
                      <p className="text-label-md text-on-surface">
                        {court.isIndoor ? "Indoor" : "Outdoor"}
                      </p>
                    </div>
                  </div>

                  {activeClosures.length > 0 && (
                    <div className="space-y-2">
                      {activeClosures.map((item) => (
                        <p
                          key={item.id}
                          className="flex items-center gap-1.5 rounded-lg bg-closure-light px-2.5 py-2 text-body-sm text-slate-whisper"
                        >
                          <MIcon name="event_busy" className="shrink-0 text-[14px]" />
                          {dateLabel(item.date)} ·{" "}
                          {item.startHour !== null && item.endHour !== null
                            ? hourLabel(item.startHour, item.endHour)
                            : "sehari"}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto">
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      icon={<MIcon name="edit" className="text-[16px]" />}
                      onClick={() => openEdit(court)}
                    >
                      Edit
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>

        {/* Penutupan */}
        <Card>
          <CardHeader
            title="Penutupan / maintenance"
            subtitle="Slot tertutup tidak bisa dipesan pelanggan maupun admin."
            action={
              <Button
                size="sm"
                variant="secondary"
                icon={<MIcon name="add" className="text-[16px]" />}
                onClick={() => setAddingClosure(true)}
              >
                Tutup lapangan
              </Button>
            }
          />
          <CardBody>
            {sortedClosures.length === 0 ? (
              <EmptyState
                title="Belum ada penutupan"
                description="Tidak ada jadwal tutup atau maintenance yang terdaftar."
                className="py-8"
              />
            ) : (
              <div className="divide-y divide-line/70">
                {sortedClosures.map((item) => {
                  const court = courts.find((entry) => entry.id === item.courtId);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-label-lg text-on-surface">
                          {court?.name} · {dateLabel(item.date)}
                          {item.startHour !== null && item.endHour !== null
                            ? ` · ${hourLabel(item.startHour, item.endHour)}`
                            : " · sehari"}
                        </p>
                        <p className="truncate text-body-sm text-slate-whisper">{item.reason}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeClosure(item.id)}
                        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-whisper transition-colors hover:bg-error-container hover:text-error"
                        aria-label="Hapus penutupan"
                      >
                        <MIcon name="delete" className="text-[18px]" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Modal edit lapangan */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : "Edit lapangan"}
      >
        {editing && editForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Harga per jam (Rp)" htmlFor="edit-price">
                <TextInput
                  id="edit-price"
                  type="number"
                  value={editForm.price}
                  min={10000}
                  step={5000}
                  onChange={(event) =>
                    setEditForm({ ...editForm, price: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Status" htmlFor="edit-active">
                <Select
                  id="edit-active"
                  value={editForm.active ? "1" : "0"}
                  onChange={(event) =>
                    setEditForm({ ...editForm, active: event.target.value === "1" })
                  }
                >
                  <option value="1">Aktif</option>
                  <option value="0">Non aktif</option>
                </Select>
              </Field>
              <Field label="Buka (jam)" htmlFor="edit-open">
                <Select
                  id="edit-open"
                  value={editForm.open}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      open: Number(event.target.value),
                      close: Math.max(Number(event.target.value) + 1, editForm.close),
                    })
                  }
                >
                  {Array.from({ length: 15 }, (_, index) => index + 5).map((hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tutup (jam)" htmlFor="edit-close">
                <Select
                  id="edit-close"
                  value={editForm.close}
                  onChange={(event) =>
                    setEditForm({ ...editForm, close: Number(event.target.value) })
                  }
                >
                  {Array.from({ length: 15 }, (_, index) => index + 8).map((hour) => (
                    <option
                      key={hour}
                      value={hour}
                      disabled={hour <= editForm.open}
                    >
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Batal
              </Button>
              <Button onClick={saveCourt}>Simpan</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal tutup lapangan */}
      <Modal open={addingClosure} onClose={() => setAddingClosure(false)} title="Tutup lapangan">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lapangan" htmlFor="cl-court">
              <Select
                id="cl-court"
                value={closureCourt}
                onChange={(event) => setClosureCourt(Number(event.target.value))}
              >
                {courts.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tanggal" htmlFor="cl-date">
              <TextInput
                id="cl-date"
                type="date"
                value={closureDate}
                min={todayString()}
                onChange={(event) => setClosureDate(event.target.value)}
              />
            </Field>
          </div>

          <Toggle
            checked={closureAllDay}
            onChange={setClosureAllDay}
            label="Seluruh hari"
            description="Tutup penuh dari buka sampai tutup"
          />

          {!closureAllDay && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Dari jam" htmlFor="cl-start">
                <Select
                  id="cl-start"
                  value={closureStart}
                  onChange={(event) => setClosureStart(Number(event.target.value))}
                >
                  {Array.from({ length: 15 }, (_, index) => index + 5).map((hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Sampai jam" htmlFor="cl-end">
                <Select
                  id="cl-end"
                  value={closureEnd}
                  onChange={(event) => setClosureEnd(Number(event.target.value))}
                >
                  {Array.from({ length: 15 }, (_, index) => index + 6).map((hour) => (
                    <option key={hour} value={hour} disabled={hour <= closureStart}>
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          <Field label="Alasan singkat" htmlFor="cl-reason">
            <TextInput
              id="cl-reason"
              value={closureReason}
              onChange={(event) => setClosureReason(event.target.value)}
              placeholder="cth: Perbaikan net"
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddingClosure(false)}>
              Batal
            </Button>
            <Button onClick={addClosure} disabled={!closureReason.trim()}>
              Simpan penutupan
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal tambah lapangan */}
      <Modal open={tambahOpen} onClose={() => setTambahOpen(false)} title="Tambah lapangan">
        <div className="space-y-4">
          <p className="text-body-md leading-6 text-slate-whisper">
            Lapangan baru dibuat dengan harga default Rp35.000/jam, jam 08:00–22:00, tipe indoor.
            Atur detailnya lewat tombol Edit.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTambahOpen(false)}>
              Batal
            </Button>
            <Button onClick={addCourt}>Tambah</Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}
