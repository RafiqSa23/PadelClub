/**
 * Mock data + logic untuk cadangan customer flow tanpa DB.
 *
 * @module
 * Data mentah dipecah ke `mock-data.ts`, logic dipecah ke `mock-logic.ts`.
 * Berkas ini tetap menjadi titik impor satu masuk untuk semua konsumen lama.
 */

// Data (hanya konstanta, tanpa logic)
export {
  BOOKINGS,
  CLOSURES,
  CLOSURE_REASONS,
  COURT_HOURS,
  COURTS,
  HOURS,
  MOCK_OTP,
} from "./mock-data";

// Logic (fungsi yang bergantung pada data di atas)
export {
  businessHours,
  createBooking,
  generateDaySlots,
  nextAvailableCode,
  slotDetail,
  slotRangeLabel,
  type SlotDetail,
} from "./mock-logic";
