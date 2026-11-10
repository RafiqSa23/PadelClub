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

export const notificationChannelEnum = pgEnum('notification_channel', [
  'whatsapp',
  'email',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'tiket',
  'pengingat_h1',
  'pengingat_h2',
  'sisa_pembayaran',
  'kadaluarsa',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'terkirim',
  'gagal',
]);

export const users = pgTable('users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  phone: text().notNull().unique(),
  name: text().notNull(),
  email: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

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

export const notificationLogs = pgTable(
  'notification_logs',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    bookingId: integer().references(() => bookings.id),
    channel: notificationChannelEnum().notNull(),
    type: notificationTypeEnum().notNull(),
    status: notificationStatusEnum().notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    error: text(),
  },
  (t) => [
    // Idempotensi cron pengingat per booking + audit log panel admin.
    index('notification_logs_booking_idx').on(t.bookingId),
    index('notification_logs_sent_idx').on(t.sentAt),
  ],
);

// OTP untuk checkout cepat (F3): kode di-hash, TTL 5 menit, 1x pakai,
// max 5x gagal, kirim-ulang min 60 detik (ditegakkan di application layer).
export const otpCodes = pgTable(
  'otp_codes',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    phone: text().notNull(),
    codeHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    attempts: integer().notNull().default(0),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Cek kirim-ulang & verifikasi: OTP terbaru per nomor.
    index('otp_codes_phone_created_idx').on(t.phone, t.createdAt),
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

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  booking: one(bookings, {
    fields: [notificationLogs.bookingId],
    references: [bookings.id],
  }),
}));

export const otpCodesRelations = relations(otpCodes, () => ({}));

export const adminsRelations = relations(admins, ({ many }) => ({
  sessions: many(adminSessions),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  admin: one(admins, {
    fields: [adminSessions.adminId],
    references: [admins.id],
  }),
}));