-- The SuperAdmin activity log: an append-only record of what people did. Additive, so it is safe to apply while the
-- app is running (the app writes to it once this migration is in).
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_name" TEXT NOT NULL,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'ok',
    "payment_id" UUID,
    "target_user_id" UUID,
    "summary" TEXT NOT NULL,
    "details" JSONB,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_at_idx" ON "audit_events"("at");
CREATE INDEX "audit_events_action_at_idx" ON "audit_events"("action", "at");
CREATE INDEX "audit_events_actor_id_at_idx" ON "audit_events"("actor_id", "at");
CREATE INDEX "audit_events_payment_id_idx" ON "audit_events"("payment_id");
