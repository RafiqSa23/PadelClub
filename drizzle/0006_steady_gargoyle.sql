CREATE TYPE "public"."scan_outcome" AS ENUM('ok', 'already', 'rejected');--> statement-breakpoint
CREATE TABLE "scan_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scan_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bookingId" integer,
	"code" text NOT NULL,
	"adminId" integer,
	"adminUsername" text,
	"outcome" "scan_outcome" NOT NULL,
	"reason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_adminId_admins_id_fk" FOREIGN KEY ("adminId") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_logs_created_idx" ON "scan_logs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "scan_logs_code_idx" ON "scan_logs" USING btree ("code");