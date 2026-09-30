export type SlotStatus = "kosong" | "terkonfirmasi" | "menunggu_pembayaran" | "tutup";

export type BookingStatus = "menunggu_pembayaran" | "terkonfirmasi" | "dibatalkan";
export type PaymentStatus = "pending" | "paid" | "failed" | "expired";
export type BookingSource = "online" | "walkin";

export interface Court {
  id: number;
  name: string;
  hourlyPrice: number;
  isIndoor: boolean;
  isActive: boolean;
  description: string;
}

export interface CourtHour {
  courtId: number;
  dayOfWeek: number;
  openHour: number;
  closeHour: number;
}

export interface Slot {
  courtId: number;
  date: string;
  hour: number;
  status: SlotStatus;
  code?: string;
  reason?: string;
}

export interface Booking {
  id: number;
  code: string;
  customerName: string;
  customerPhone: string;
  courtId: number;
  date: string;
  hours: number[];
  status: BookingStatus;
  source: BookingSource;
  paymentStatus: PaymentStatus;
  subtotal: number;
  createdAt: string;
  checkedIn?: boolean;
}

export interface Closure {
  id: number;
  courtId: number;
  date: string;
  startHour: number | null;
  endHour: number | null;
  reason: string;
}

export type WizardStep = "tanggal" | "slot" | "review" | "identitas" | "pembayaran" | "selesai";