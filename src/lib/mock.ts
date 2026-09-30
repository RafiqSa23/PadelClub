import type { Booking, BookingSource, Closure, Court, CourtHour, PaymentStatus, Slot } from "./types";
import { addDays, hourLabel, todayString } from "./format";

export const COURTS: Court[] = [
  { id: 1, name: "Lapangan 1", hourlyPrice: 35000, isIndoor: false, isActive: true, description: "Outdoor, pasir sintetis" },
  { id: 2, name: "Lapangan 2", hourlyPrice: 35000, isIndoor: false, isActive: true, description: "Outdoor, pasir sintetis" },
  { id: 3, name: "Lapangan 3", hourlyPrice: 40000, isIndoor: true, isActive: true, description: "Indoor, pencahayaan penuh" },
  { id: 4, name: "Lapangan 4", hourlyPrice: 40000, isIndoor: true, isActive: true, description: "Indoor, pencahayaan penuh" },
  { id: 5, name: "Lapangan 5", hourlyPrice: 30000, isIndoor: false, isActive: true, description: "Outdoor, tamanasi" },
  { id: 6, name: "Lapangan 6", hourlyPrice: 45000, isIndoor: true, isActive: true, description: "Glass Court — favorit" },
];

export const COURT_HOURS: CourtHour[] = [
  { courtId: 1, dayOfWeek: 0, openHour: 7, closeHour: 23 },
  { courtId: 2, dayOfWeek: 0, openHour: 8, closeHour: 22 },
  { courtId: 3, dayOfWeek: 0, openHour: 8, closeHour: 22 },
  { courtId: 4, dayOfWeek: 0, openHour: 8, closeHour: 22 },
  { courtId: 5, dayOfWeek: 0, openHour: 9, closeHour: 21 },
  { courtId: 6, dayOfWeek: 0, openHour: 7, closeHour: 23 },
];

export const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const MOCK_OTP = "123456";

function courtById(id: number): Court {
  return COURTS.find((c) => c.id === id) ?? COURTS[0];
}

function seeded(dateStr: string) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) % 2147483647;
  return function () {
    h = (h * 16807) % 2147483647;
    return (h - 1) / 2147483646;
  };
}

const CLOSURE_REASONS = [
  "Perbaikan net",
  "Pengecatan ulang",
  "Perbaikan pencahayaan",
  "Servis AC (indoor)",
  "Aktivitas klub",
];

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

function pick<T>(arr: T[], s: number): T {
  return arr[Math.floor(s * arr.length) % arr.length];
}

function codeForCourtHour(courtId: number, hour: number, date: string): string {
  return `PD-${courtId}${String(hour).padStart(2, "0")}-${date.replaceAll("-", "").slice(2)}`;
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

export const BOOKINGS: Booking[] = [
  {
    id: 1,
    code: "PD-A1B2C3",
    customerName: "Raka Pratama",
    customerPhone: "0812 3456 7890",
    courtId: 1,
    date: todayString(),
    hours: [18, 19],
    status: "terkonfirmasi",
    source: "online",
    paymentStatus: "paid",
    subtotal: 70000,
    createdAt: `${todayString()}T07:22:00`,
  },
  {
    id: 2,
    code: "PD-77K9PL",
    customerName: "Salsabila Zahra",
    customerPhone: "0813 8765 4321",
    courtId: 2,
    date: addDays(todayString(), 1),
    hours: [20, 21],
    status: "menunggu_pembayaran",
    source: "online",
    paymentStatus: "pending",
    subtotal: 70000,
    createdAt: addDays(todayString(), 1) + "T09:01:00",
  },
  {
    id: 3,
    code: "PD-X2Y3Z4",
    customerName: "Dimas Anggara",
    customerPhone: "0821 1122 3344",
    courtId: 3,
    date: addDays(todayString(), -2),
    hours: [9, 10, 11],
    status: "terkonfirmasi",
    source: "walkin",
    paymentStatus: "paid",
    subtotal: 120000,
    createdAt: addDays(todayString(), -2) + "T06:40:00",
    checkedIn: true,
  },
  {
    id: 4,
    code: "PD-56QWER",
    customerName: "Ayu Lestari",
    customerPhone: "0857 9988 7766",
    courtId: 5,
    date: addDays(todayString(), -5),
    hours: [16],
    status: "dibatalkan",
    source: "online",
    paymentStatus: "expired",
    subtotal: 30000,
    createdAt: addDays(todayString(), -5) + "T10:12:00",
  },
  {
    id: 5,
    code: "PD-777ABC",
    customerName: "Fajar Nugroho",
    customerPhone: "0819 4455 6677",
    courtId: 6,
    date: addDays(todayString(), 2),
    hours: [10, 11, 12],
    status: "terkonfirmasi",
    source: "online",
    paymentStatus: "paid",
    subtotal: 135000,
    createdAt: addDays(todayString(), 1) + "T14:30:00",
  },
  {
    id: 6,
    code: "PD-998ZZY",
    customerName: "Nadia Putri",
    customerPhone: "0812 5555 1234",
    courtId: 4,
    date: addDays(todayString(), -1),
    hours: [19],
    status: "terkonfirmasi",
    source: "walkin",
    paymentStatus: "paid",
    subtotal: 40000,
    createdAt: addDays(todayString(), -1) + "T08:00:00",
    checkedIn: true,
  },
];

export const CLOSURES: Closure[] = [
  {
    id: 1,
    courtId: 3,
    date: todayString(),
    startHour: 10,
    endHour: 16,
    reason: "Perbaikan pencahayaan",
  },
  {
    id: 2,
    courtId: 5,
    date: addDays(todayString(), 1),
    startHour: null,
    endHour: null,
    reason: "Pengecatan ulang seluruh lapangan",
  },
  {
    id: 3,
    courtId: 6,
    date: addDays(todayString(), -1),
    startHour: 9,
    endHour: 12,
    reason: "Aktivitas klub",
  },
];

export function bookingByCode(code: string): Booking | undefined {
  const session = readSessionBookings();
  return [...session, ...BOOKINGS].find((b) => b.code.toLowerCase() === code.toLowerCase());
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