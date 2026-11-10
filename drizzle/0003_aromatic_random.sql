CREATE INDEX "admin_sessions_expires_idx" ON "admin_sessions" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "booking_slots_booking_idx" ON "booking_slots" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "bookings_status_expires_idx" ON "bookings" USING btree ("status","expiresAt");--> statement-breakpoint
CREATE INDEX "bookings_user_idx" ON "bookings" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "bookings_date_idx" ON "bookings" USING btree ("bookingDate");--> statement-breakpoint
CREATE INDEX "bookings_created_idx" ON "bookings" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "closures_date_court_idx" ON "closures" USING btree ("closureDate","courtId");--> statement-breakpoint
CREATE INDEX "notification_logs_booking_idx" ON "notification_logs" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "notification_logs_sent_idx" ON "notification_logs" USING btree ("sentAt");--> statement-breakpoint
CREATE INDEX "otp_codes_phone_created_idx" ON "otp_codes" USING btree ("phone","createdAt");--> statement-breakpoint
CREATE INDEX "payments_booking_status_idx" ON "payments" USING btree ("bookingId","status");