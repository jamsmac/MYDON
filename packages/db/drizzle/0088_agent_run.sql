-- Журнал прогонов + снимок расписаний + хуки паспорта (волна R, спека 2026-09-06-wave-r-crons-flows).
CREATE TABLE "agent_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" text NOT NULL,
	"skill" text NOT NULL,
	"trigger" text NOT NULL,
	"cron" text,
	"scheduled_at" timestamp with time zone,
	"request_key" text NOT NULL,
	"trace_key" text,
	"task_id" uuid,
	"approval_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"outcome" text NOT NULL,
	"skip_reason" text,
	"hook" text,
	"reason" text NOT NULL,
	"action" text,
	"review" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_run_request_key_unique" UNIQUE("request_key")
);
--> statement-breakpoint
CREATE TABLE "agent_runtime_snapshot" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "hooks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_approval_id_approval_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approval"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_run_agent_skill_idx" ON "agent_run" USING btree ("agent_name","skill","started_at" desc);--> statement-breakpoint
CREATE INDEX "agent_run_started_idx" ON "agent_run" USING btree ("started_at" desc);--> statement-breakpoint
CREATE INDEX "agent_run_task_idx" ON "agent_run" USING btree ("task_id") WHERE "agent_run"."task_id" is not null;