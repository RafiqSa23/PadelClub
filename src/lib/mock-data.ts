/**
 * Data referensi dummy untuk mock (jadwal, lapangan, booking, penutupan).
 * Berkas ini HANYA berisi konstanta/data — tanpa logic.
 *
 * @module
 */

import type {
  Booking,
  Closure,
  Court,
  CourtHour,
} from "./types";
import { addDays, todayString } from "./format";

/** Data referensi lapangan (dummy untuk halaman customer yang belum hubung DB). */
export const COURTS: Court[] = [
  { id: 1, name: "Lapangan 1", hourlyPrice: 35000, isIndoor: false, isActive: true, description: "Outdoor, pasir sintetis" },
  { id: 2, name: "Lapangan 2", hourlyPrice: 35000, isIndoor: false, isActive: true, description: "Outdoor, pasir sintetis" },
  { id: 3, name: "Lapangan 3", hourlyPrice: 40000, isIndoor: true, isActive: true, description: "Indoor, pencahayaan penuh" },
  { id: 4, name: "Lapangan 4", hourlyPrice: 40000, isIndoor: true, isActive: true, description: "Indoor, pencahayaan penuh" },
  { id: 5, name: "Lapangan 5", hourlyPrice: 30000, isIndoor: false, isActive: true, description: "Outdoor, tamanasi" },
  { id: 6, name: "Lapangan 6", hourlyPrice: 45000, isIndoor: true, isActive: true, description: "Glass Court — favorit" },
];

/** Jam buka tutup per lapangan per hari (0 = Minggu). Data dummy. */
export const COURT_HOURS: CourtHour[] = [
  { courtId: 1, dayOfWeek: 0, openHour: 7, closeHour: 23 },
  { courtId: 2, dayOfWeek: 0, openHour: 8, closeHour: 22 },
  { courtId: 3, dayOfWeek: 0, openHour: 8, closeHour: 22 },
  { courtId: 4, dayOfWeek: 0, openHour: 8, closeHour: 22 },
  { courtId: 5, dayOfWeek: 0, openHour: 9, closeHour: 21 },
  { courtId: 6, dayOfWeek: 0, openHour: 7, closeHour: 23 },
];

export const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Alasan penutupan lapangan dummy. */
export const CLOSURE_REASONS = [
  "Perbaikan net",
  "Pengecatan ulang",
  "Perbaikan pencahayaan",
  "Servis AC (indoor)",
  "Aktivitas klub",
];

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
    createdAt: `${addDays(todayString(), 1)}T09:01:00`,
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
    createdAt: `${addDays(todayString(), -2)}T06:40:00`,
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
    createdAt: `${addDays(todayString(), -5)}T10:12:00`,
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
    createdAt: `${addDays(todayString(), 1)}T14:30:00`,
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
    createdAt: `${addDays(todayString(), -1)}T08:00:00`,
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
