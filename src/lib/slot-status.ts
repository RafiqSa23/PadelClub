import { getDaySchedule, type DaySchedule, type DaySlot } from './slots';

/**
 * Cache + versi jadwal per tanggal.
 *
 * Tujuan: polling 10 detik dari banyak tab tidak lagi menembak DB. Klien
 * mengirim versi terakhir; bila tidak ada perubahan server membalas 304 tanpa
 * query. Saat ada booking/penutupan/kedaluwarsa, penulis memanggil
 * `bumpSlotsVersion()` sehingga cache gugur dan versi naik.
 */

export interface SlotPatch {
  courtId: number;
  hour: number;
  status: DaySlot['status'];
  code?: string | null;
  reason?: string | null;
  expiresAt?: string | null;
}

export type SlotDelta =
  | { kind: 'not-modified' }
  | { kind: 'full'; v: number; schedule: DaySchedule }
  | { kind: 'patch'; v: number; changes: SlotPatch[] };

interface DateState {
  version: number;
  /** Sidik status terakhir yang sudah dilaporkan (untuk menghitung delta). */
  lastSig: Map<string, string> | null;
  /** Riwayat perubahan per versi, supaya klien yang tertinggal tetap dapat. */
  entries: { v: number; changes: SlotPatch[] }[];
  /** Versi tertua yang riwayatnya sudah dibuang; klien di bawah ini dapat full. */
  truncatedBelow: number;
}

const CACHE_TTL_MS = (() => {
  const raw = Number(process.env.SLOTS_CACHE_TTL_MS ?? 5000);
  return Number.isFinite(raw) && raw >= 0 ? raw : 5000;
})();

const MAX_HISTORY = 50;

const states = new Map<string, DateState>();
const cache = new Map<string, { at: number; schedule: DaySchedule }>();

function stateOf(date: string): DateState {
  let state = states.get(date);
  if (!state) {
    state = { version: 0, lastSig: null, entries: [], truncatedBelow: 0 };
    states.set(date, state);
  }
  return state;
}

function keyOf(courtId: number, hour: number): string {
  return `${courtId}:${hour}`;
}

function signature(schedule: DaySchedule): Map<string, string> {
  const map = new Map<string, string>();
  for (const slot of schedule.slots) {
    map.set(keyOf(slot.courtId, slot.hour), `${slot.status}|${slot.code ?? ''}|${slot.expiresAt ?? ''}`);
  }
  return map;
}

function diff(before: Map<string, string>, schedule: DaySchedule): SlotPatch[] {
  const changes: SlotPatch[] = [];
  for (const slot of schedule.slots) {
    const next = `${slot.status}|${slot.code ?? ''}|${slot.expiresAt ?? ''}`;
    if (before.get(keyOf(slot.courtId, slot.hour)) === next) continue;
    changes.push({
      courtId: slot.courtId,
      hour: slot.hour,
      status: slot.status,
      code: slot.code ?? null,
      reason: slot.reason ?? null,
      expiresAt: slot.expiresAt ?? null,
    });
  }
  return changes;
}

/** Bandingkan dengan sidik sebelumnya lalu simpan riwayat perubahan. */
function record(date: string, schedule: DaySchedule): void {
  const state = stateOf(date);
  const sig = signature(schedule);
  if (!state.lastSig) {
    state.lastSig = sig;
    return;
  }
  const changes = diff(state.lastSig, schedule);
  state.lastSig = sig;
  if (changes.length === 0) return;

  const last = state.entries[state.entries.length - 1];
  if (last && last.v === state.version) last.changes = changes;
  else state.entries.push({ v: state.version, changes });

  while (state.entries.length > MAX_HISTORY) {
    const dropped = state.entries.shift();
    if (dropped) state.truncatedBelow = Math.max(state.truncatedBelow, dropped.v + 1);
  }
}

/** Versi jadwal saat ini untuk satu tanggal. */
export function getSlotsVersion(date: string): number {
  return stateOf(date).version;
}

/** Dipanggil setiap ada tulisan yang mengubah ketersediaan slot. */
export function bumpSlotsVersion(date: string): void {
  const state = stateOf(date);
  state.version += 1;
  cache.delete(date);
}

/** Jadwal 1 hari dengan cache pendek (5 detik, bisa diatur via env). */
export async function readDaySchedule(date: string): Promise<DaySchedule> {
  const hit = cache.get(date);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.schedule;

  const schedule = await getDaySchedule(date);
  cache.set(date, { at: Date.now(), schedule });
  record(date, schedule);
  return schedule;
}

/**
 * Delta untuk klien yang memegang versi `clientV`.
 * Versi sama → `not-modified` tanpa menyentuh DB.
 */
export async function getSlotDelta(date: string, clientV: number): Promise<SlotDelta> {
  const state = stateOf(date);

  if (state.lastSig && clientV === state.version) return { kind: 'not-modified' };

  const schedule = await readDaySchedule(date);

  // Versi klien lebih baru dari server (mis. server baru restart) → kirim penuh.
  if (clientV > state.version || clientV < state.truncatedBelow) {
    return { kind: 'full', v: state.version, schedule };
  }

  const changes = state.entries
    .filter((entry) => entry.v > clientV)
    .flatMap((entry) => entry.changes);

  // Belum pernah ada perubahan tercatat → kirim penuh agar klien pasti sinkron.
  if (!state.entries.length && clientV !== state.version) {
    return { kind: 'full', v: state.version, schedule };
  }

  return { kind: 'patch', v: state.version, changes };
}

/** Kosongkan cache & versi (dipakai test agar antar-skenario tidak bocor). */
export function resetSlotsCache(): void {
  states.clear();
  cache.clear();
}
