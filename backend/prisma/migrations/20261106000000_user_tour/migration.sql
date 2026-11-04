-- When a person finished the product tour or asked not to see it again. Null means it is offered at their next
-- sign-in. Additive and nullable, so it is safe to apply while the app is running.
ALTER TABLE "users" ADD COLUMN "tour_completed_at" TIMESTAMP(3);
