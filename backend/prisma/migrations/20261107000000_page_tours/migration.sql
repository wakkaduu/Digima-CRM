-- Page tours: the pages whose tour a person finished, and whether they turned page tours off. Additive with defaults,
-- so it is safe to apply while the app is running.
ALTER TABLE "users" ADD COLUMN "tour_pages_done" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "page_tours_off" BOOLEAN NOT NULL DEFAULT false;
