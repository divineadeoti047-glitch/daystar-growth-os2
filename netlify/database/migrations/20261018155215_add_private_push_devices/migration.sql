CREATE TABLE "daystar_v2_push_devices" (
	"id" text PRIMARY KEY,
	"owner" text NOT NULL,
	"subscription" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
