'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Court, Slot } from './types';
import type { DaySchedule } from './slots';

interface ScheduleState {
  courts: Court[];
  slots: Slot[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
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
    status: s.status,
    code: s.code ?? undefined,
    reason: s.reason ?? undefined,
  }));
  return { courts, slots };
}

/** Ambil jadwal 1 tanggal dari API (refresh tiap 10 dtk, sesuai label UI). */
export function useDaySchedule(date: string): ScheduleState {
  const [courts, setCourts] = useState<Court[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setLoading(true);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/slots?date=${date}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { schedule: DaySchedule };
        if (cancelled) return;
        const mapped = mapSchedule(date, json.schedule);
        setCourts(mapped.courts);
        setSlots(mapped.slots);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError('Gagal memuat slot terkini. Coba muat ulang.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const timer = window.setInterval(() => setTick((t) => t + 1), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [date, tick]);

  return { courts, slots, loading, error, refresh };
}

/** Hitung slot kosong untuk strip tanggal (7 tanggal paralel). */
export function useWeekAvailability(dates: string[]): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      dates.map(async (date) => {
        try {
          const res = await fetch(`/api/slots?date=${date}`, { cache: 'no-store' });
          if (!res.ok) return [date, -1] as const;
          const json = (await res.json()) as { schedule: DaySchedule };
          return [date, json.schedule.slots.filter((s) => s.status === 'kosong').length] as const;
        } catch {
          return [date, -1] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setCounts(Object.fromEntries(entries.filter(([, v]) => v >= 0)));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates.join(',')]);

  return counts;
}
