CREATE TABLE "sales_daily_summary" (
	"date" text PRIMARY KEY NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
