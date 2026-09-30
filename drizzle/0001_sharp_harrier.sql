CREATE TABLE "admin_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"adminId" integer NOT NULL,
	"tokenHash" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admins_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"passwordHash" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "otp_codes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"phone" text NOT NULL,
	"codeHash" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guestName" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guestPhone" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "expiresAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "checkedInAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "checkedInBy" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "orderId" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "expiresAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_adminId_admins_id_fk" FOREIGN KEY ("adminId") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_gatewayRef_unique" UNIQUE("gatewayRef");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_unique" UNIQUE("orderId");