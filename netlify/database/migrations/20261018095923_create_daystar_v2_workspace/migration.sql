CREATE TABLE "daystar_v2_workspaces" (
	"owner" text PRIMARY KEY,
	"data" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
