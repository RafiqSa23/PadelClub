'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Court, Slot, SlotStatus } from './types';
import type { DaySchedule } from './slots';

interface ScheduleState {
  courts: Court[];
  slots: Slot[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Interval polling ringan; server balas 304 bila tak ada perubahan. */
const POLL_MS = 10_000;

interface SlotPatch {
  courtId: number;
  hour: number;
  status: SlotStatus;
  code?: string | null;
  reason?: string | null;
  expiresAt?: string | null;
}

/**
 * Slot `menunggu_pembayaran` yang `expiresAt`-nya lewat langsung dianggap
 * kosong di klien — tanpa request, tanpa menunggu cron.
 */
function effectiveStatus(patch: {
  status: SlotStatus;
  expiresAt?: string | null;
}): SlotStatus {
  if (patch.status !== 'menunggu_pembayaran') return patch.status;
  if (!patch.expiresAt) return patch.status;
  return new Date(patch.expiresAt).getTime() <= Date.now() ? 'kosong' : patch.status;
}

function mapSchedule(date: string, schedule: DaySchedule): { courts: Court[]; slots: Slot[] } {
  const courts: Court[] = schedule.courts.map((c) => ({
    id: c.id,
    name: c.name,
    hourlyPrice: c.hourlyPrice,
    isIndoor: c.isIndoor,
    isActive: c.isActive,
    description: c.description ?? '',
  }));
  const slots: Slot[] = schedule.slots.map((s) => ({
    courtId: s.courtId,
    date,
    hour: s.hour,
    status: effectiveStatus({ status: s.status, expiresAt: s.expiresAt }),
    code: s.code ?? undefined,
    reason: s.reason ?? undefined,
    expiresAt: s.expiresAt ?? undefined,
  }));
  return { courts, slots };
}

/**
 * Jadwal 1 tanggal: grid penuh sekali saat halaman dibuka, lalu polling delta
 * (`/api/slots/status`) yang berhenti di 304 selama tidak ada perubahan.
 */
export function useDaySchedule(date: string): ScheduleState {
  const [courts, setCourts] = useState<Court[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef(-1);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => {
    versionRef.current = -1;
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    function applySchedule(next: DaySchedule): void {
      const mapped = mapSchedule(date, next);
      setCourts(mapped.courts);
      setSlots(mapped.slots);
    }

    function applyPatch(changes: SlotPatch[]): void {
      if (changes.length === 0) return;
      setSlots((prev) => {
        const byKey = new Map(changes.map((c) => [`${c.courtId}:${c.hour}`, c]));
        let touched = false;
        const next = prev.map((slot) => {
          const patch = byKey.get(`${slot.courtId}:${slot.hour}`);
          if (!patch) return slot;
          touched = true;
          return {
            ...slot,
            status: effectiveStatus(patch),
            code: patch.code ?? undefined,
            reason: patch.reason ?? undefined,
            expiresAt: patch.expiresAt ?? undefined,
          };
        });
        return touched ? next : prev;
      });
    }

    async function loadFull(): Promise<void> {
      const res = await fetch(`/api/slots?date=${date}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { schedule: DaySchedule; v?: number };
      if (cancelled) return;
      versionRef.current = typeof json.v === 'number' ? json.v : -1;
      applySchedule(json.schedule);
      setError(null);
    }

    async function poll(): Promise<void> {
      // Tab tidak terlihat → jangan tembak server sama sekali.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const version = versionRef.current;
      if (version < 0) {
        await loadFull();
        return;
      }
      const res = await fetch(`/api/slots/status?date=${date}&v=${version}`, {
        cache: 'no-store',
      });
      if (res.status === 304) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as
        | { v: number; full: true; schedule: DaySchedule }
        | { v: number; full: false; slots: SlotPatch[] };
      if (cancelled) return;
      if (typeof json.v === 'number') versionRef.current = json.v;
      if (json.full) applySchedule(json.schedule);
      else applyPatch(json.slots);
      setError(null);
    }

    loadFull()
      .catch(() => {
        if (!cancelled) setError('Gagal memuat slot terkini. Coba muat ulang.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const timer = window.setInterval(() => {
      void poll().catch(() => {
        // Biarkan diam: poll berikutnya mencoba lagi (jangan spam error di UI).
      });
    }, POLL_MS);

    function onVisibilityChange(): void {
      if (document.visibilityState === 'visible') {
        void poll().catch(() => undefined);
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [date, reloadToken]);

  return { courts, slots, loading, error, refresh };
}

/**
 * Jumlah slot kosong untuk strip tanggal — SATU request untuk seluruh rentang
 * (sebelumnya 7 request × 4 query tiap halaman dibuka).
 */
export function useWeekAvailability(dates: string[]): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const from = dates[0] ?? '';
  const to = dates[dates.length - 1] ?? '';

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;

    fetch(`/api/slots?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { days: { date: string; freeCount: number }[] };
        if (cancelled) return;
        setCounts(Object.fromEntries(json.days.map((day) => [day.date, day.freeCount])));
      })
      .catch(() => {
        // Strip tanggal bersifat pelengkap — biarkan kosong bila gagal.
      });

    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return counts;
}
