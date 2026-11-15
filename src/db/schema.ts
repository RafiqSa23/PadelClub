import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const bookingStatusEnum = pgEnum('booking_status', [
  'menunggu_pembayaran',
  'terkonfirmasi',
  'dibatalkan',
]);

export const bookingSourceEnum = pgEnum('booking_source', ['online', 'walkin']);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'expired',
]);

export const users = pgTable(
  'users',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    // Akun pemain (ADR 0009): email + password. User bayangan walk-in tidak punya keduanya.
    email: text(),
    passwordHash: text(),
    // Nomor HP tidak unik & tidak diverifikasi (tanpa OTP).
    phone: text(),
    name: text().notNull(),
    // Walk-in/telepon (ADR 0011): dianonimisasi otomatis setelah 7 hari.
    isGuest: boolean().notNull().default(false),
    anonymizedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    index('users_guest_created_idx').on(t.isGuest, t.createdAt),
    index('users_phone_idx').on(t.phone),
  ],
);

// Sesi pemain (ADR 0009): token opaque di cookie, hash SHA-256 di DB.
export const userSessions = pgTable(
  'user_sessions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('user_sessions_expires_idx').on(t.expiresAt)],
);

// Rate-limit fixed-window lintas-instance (ADR 0012): dipakai endpoint sensitif
// (auth, booking, check-in) agar batas tetap berlaku di beberapa instance.
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text().primaryKey(),
    count: integer().notNull().default(0),
    windowStart: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rate_limits_window_idx').on(t.windowStart)],
);

export const courts = pgTable('courts', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  hourlyPrice: integer().notNull(),
  isActive: boolean().notNull().default(true),
  isIndoor: boolean().notNull().default(false),
  description: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const courtHours = pgTable(
  'court_hours',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    courtId: integer()
      .notNull()
      .references(() => courts.id, { onDelete: 'cascade' }),
    dayOfWeek: integer().notNull(),
    openTime: text().notNull(),
    closeTime: text().notNull(),
  },
  (t) => [uniqueIndex('court_hours_court_day_unique').on(t.courtId, t.dayOfWeek)],
);

export const bookings = pgTable(
  'bookings',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    code: text().notNull().unique(),
    courtId: integer()
      .notNull()
      .references(() => courts.id),
    userId: integer().references(() => users.id),
    // Nama/HP tamu untuk walk-in atau booking sebelum user terdaftar penuh.
    guestName: text(),
    guestPhone: text(),
    bookingDate: date().notNull(),
    status: bookingStatusEnum().notNull().default('menunggu_pembayaran'),
    source: bookingSourceEnum().notNull().default('online'),
    subtotal: integer().notNull(),
    // Batas pembayaran server-side (ADR 0006: 15 menit sejak invoice dibuat).
    expiresAt: timestamp({ withTimezone: true }),
    checkedInAt: timestamp({ withTimezone: true }),
    checkedInBy: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Cron expire: `status = 'menunggu_pembayaran' AND expiresAt < now()`.
    index('bookings_status_expires_idx').on(t.status, t.expiresAt),
    // `/api/me/bookings` + join admin.
    index('bookings_user_idx').on(t.userId),
    // Grid jadwal harian + filter tanggal di panel admin.
    index('bookings_date_idx').on(t.bookingDate),
    // Daftar booking admin (urut terbaru).
    index('bookings_created_idx').on(t.createdAt),
  ],
);

export const bookingSlots = pgTable(
  'booking_slots',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    bookingId: integer()
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    courtId: integer()
      .notNull()
      .references(() => courts.id),
    slotDate: date().notNull(),
    hour: integer().notNull(),
  },
  (t) => [
    uniqueIndex('booking_slots_court_date_hour_unique').on(
      t.courtId,
      t.slotDate,
      t.hour,
    ),
    // Join booking → slot (grid jadwal, detail booking, tiket).
    index('booking_slots_booking_idx').on(t.bookingId),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    bookingId: integer()
      .notNull()
      .references(() => bookings.id),
    gateway: text().notNull(),
    gatewayRef: text().unique(),
    // order_id untuk korelasi webhook (Midtrans) / mock driver.
    orderId: text().unique(),
    amount: integer().notNull(),
    status: paymentStatusEnum().notNull().default('pending'),
    qrisPayload: jsonb(),
    expiresAt: timestamp({ withTimezone: true }),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Webhook + cron expire: cari payment pending milik satu booking.
    index('payments_booking_status_idx').on(t.bookingId, t.status),
  ],
);

export const closures = pgTable(
  'closures',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    courtId: integer()
      .notNull()
      .references(() => courts.id),
    closureDate: date().notNull(),
    startHour: integer(),
    endHour: integer(),
    reason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Grid jadwal per tanggal; join per lapangan.
    index('closures_date_court_idx').on(t.closureDate, t.courtId),
  ],
);

// Auth admin (pengganti cookie demo). Password di-hash (scrypt).
export const admins = pgTable('admins', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  username: text().notNull().unique(),
  passwordHash: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    adminId: integer()
      .notNull()
      .references(() => admins.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Pembersihan sesi kedaluwarsa.
    index('admin_sessions_expires_idx').on(t.expiresAt),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  sessions: many(userSessions),
}));

export const courtsRelations = relations(courts, ({ many }) => ({
  hours: many(courtHours),
  bookings: many(bookings),
  slots: many(bookingSlots),
  closures: many(closures),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  court: one(courts, { fields: [bookings.courtId], references: [courts.id] }),
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  slots: many(bookingSlots),
  payments: many(payments),
}));

export const courtHoursRelations = relations(courtHours, ({ one }) => ({
  court: one(courts, { fields: [courtHours.courtId], references: [courts.id] }),
}));

export const bookingSlotsRelations = relations(bookingSlots, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingSlots.bookingId],
    references: [bookings.id],
  }),
  court: one(courts, { fields: [bookingSlots.courtId], references: [courts.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
}));

export const closuresRelations = relations(closures, ({ one }) => ({
  court: one(courts, { fields: [closures.courtId], references: [courts.id] }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
}));

export const adminsRelations = relations(admins, ({ many }) => ({
  sessions: many(adminSessions),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  admin: one(admins, {
    fields: [adminSessions.adminId],
    references: [admins.id],
  }),
}));