/**
 * Logic mock (PRNG, generateDaySlots, slotDetail, bookingByCode, createBooking, dll.).
 * Bergantung pada data di `mock-data.ts`; tidak sendiri mendefinisikan data master.
 *
 * @module
 */

import type {
  Booking,
  BookingSource,
  Court,
  PaymentStatus,
  Slot,
} from "./types";
import { hourLabel } from "./format";
import {
  BOOKINGS,
  CLOSURE_REASONS,
  COURTS,
  COURT_HOURS,
  MOCK_OTP,
} from "./mock-data";

const NAME_POOL = [
  "Raka Pratama",
  "Salsabila Zahra",
  "Dimas Anggara",
  "Ayu Lestari",
  "Fajar Nugroho",
  "Nadia Putri",
  "Bimo Sakti",
  "Tari Kusuma",
  "Andi Rahman",
  "Mega Sari",
];

const PHONE_POOL = [
  "0812 3456 7890",
  "0813 8765 4321",
  "0821 1122 3344",
  "0857 9988 7766",
  "0819 4455 6677",
];

/** Kode booking deterministic per (courtId, hour, date) — untuk mock only. */
export function codeForCourtHour(courtId: number, hour: number, date: string): string {
  return `PD-${courtId}${String(hour).padStart(2, "0")}-${date.replaceAll("-", "").slice(2)}`;
}

/** PRNG sederhana seeded dari string tanggal — hasil dapat direproduksi. */
function seeded(dateStr: string) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) % 2147483647;
  return function () {
    h = (h * 16807) % 2147483647;
    return (h - 1) / 2147483646;
  };
}

function courtById(id: number): Court {
  return COURTS.find((c) => c.id === id) ?? COURTS[0];
}

function pick<T>(arr: T[], s: number): T {
  return arr[Math.floor(s * arr.length) % arr.length];
}

function bookingForSlot(slot: Slot): {
  customerName: string;
  customerPhone: string;
  source: BookingSource;
  paymentStatus: PaymentStatus;
  createdAt: string;
} {
  const rand = seeded(`${slot.date}-${slot.courtId}-${slot.hour}`);
  const name = pick(NAME_POOL, rand());
  const phone = pick(PHONE_POOL, rand());
  const paymentStatus: PaymentStatus = slot.status === "terkonfirmasi" ? "paid" : "pending";
  return {
    customerName: name,
    customerPhone: phone,
    source: "online",
    paymentStatus,
    createdAt: `${slot.date}T08:15:00`,
  };
}

/** Acak status slot per (court, hour, date) — 8% tutup, 18% terkonfirmasi, 12% menunggu, sisanya kosong. */
export function generateDaySlots(dateStr: string): Slot[] {
  const rand = seeded(dateStr);
  const slots: Slot[] = [];
  for (const court of COURTS) {
    const hours = businessHours(court.id);
    for (const hour of hours) {
      const roll = rand();
      let slot: Slot;
      if (roll < 0.08) {
        slot = {
          courtId: court.id,
          date: dateStr,
          hour,
          status: "tutup",
          reason: pick(CLOSURE_REASONS, rand()),
        };
      } else if (roll < 0.26) {
        slot = {
          courtId: court.id,
          date: dateStr,
          hour,
          status: "terkonfirmasi",
          code: codeForCourtHour(court.id, hour, dateStr),
        };
      } else if (roll < 0.38) {
        slot = {
          courtId: court.id,
          date: dateStr,
          hour,
          status: "menunggu_pembayaran",
          code: codeForCourtHour(court.id, hour, dateStr),
        };
      } else {
        slot = { courtId: court.id, date: dateStr, hour, status: "kosong" };
      }
      slots.push(slot);
    }
  }
  return slots;
}

export function businessHours(courtId: number): number[] {
  const ch = COURT_HOURS.find((c) => c.courtId === courtId) ?? COURT_HOURS[0];
  const out: number[] = [];
  for (let h = ch.openHour; h < ch.closeHour; h++) out.push(h);
  return out;
}

export interface SlotDetail {
  court: Court;
  start: number;
  end: number;
  label: string;
  reason?: string;
  code?: string;
  customerName?: string;
  customerPhone?: string;
  source?: BookingSource;
  paymentStatus?: PaymentStatus;
  amount?: number;
}

export function slotDetail(slot: Slot): SlotDetail {
  const court = courtById(slot.courtId);
  if (slot.status === "tutup") {
    return {
      court,
      start: slot.hour,
      end: slot.hour + 1,
      label: "Tutup / Maintenance",
      reason: slot.reason,
    };
  }
  const info = bookingForSlot(slot);
  return {
    court,
    start: slot.hour,
    end: slot.hour + 1,
    label: slot.status === "terkonfirmasi" ? "Terkonfirmasi" : "Menunggu Pembayaran",
    reason: undefined,
    ...info,
    code: slot.code ?? codeForCourtHour(slot.courtId, slot.hour, slot.date),
    amount: court.hourlyPrice,
  };
}

const SESSION_KEY = "padelclub_session_bookings";

function readSessionBookings(): Booking[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? "[]") as Booking[];
  } catch {
    return [];
  }
}

function writeSessionBookings(list: Booking[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(list));
}

export function bookingByCode(code: string): Booking | undefined {
  return [...readSessionBookings(), ...BOOKINGS].find((b) => b.code.toLowerCase() === code.toLowerCase());
}

/** Buat booking dummy dan simpan ke sessionStorage (customer flow tanpa DB). */
export function createBooking(input: {
  code: string;
  customerName: string;
  customerPhone: string;
  courtId: number;
  date: string;
  hours: number[];
  status: "menunggu_pembayaran" | "terkonfirmasi";
  paymentStatus: PaymentStatus;
  subtotal: number;
}): Booking {
  const booking: Booking = {
    id: Date.now(),
    code: input.code,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    courtId: input.courtId,
    date: input.date,
    hours: input.hours,
    status: input.status,
    source: "online",
    paymentStatus: input.paymentStatus,
    subtotal: input.subtotal,
    createdAt: new Date().toISOString(),
  };
  writeSessionBookings([...readSessionBookings(), booking]);
  return booking;
}

export function nextAvailableCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789";
  let out = "PD-";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function slotRangeLabel(slot: Slot): string {
  const court = courtById(slot.courtId);
  return `${court.name} · ${hourLabel(slot.hour, slot.hour + 1)}`;
}

export { MOCK_OTP };
