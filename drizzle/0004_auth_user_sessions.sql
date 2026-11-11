DROP TABLE "notification_logs" CASCADE;--> statement-breakpoint
DROP TABLE "otp_codes" CASCADE;--> statement-breakpoint
DROP TYPE "public"."notification_channel";--> statement-breakpoint
DROP TYPE "public"."notification_status";--> statement-breakpoint
DROP TYPE "public"."notification_type";--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"tokenHash" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_phone_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "passwordHash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "isGuest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "anonymizedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_sessions_expires_idx" ON "user_sessions" USING btree ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_guest_created_idx" ON "users" USING btree ("isGuest","createdAt");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");
