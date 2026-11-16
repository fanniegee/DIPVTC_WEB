BEGIN;

ALTER TABLE student_registration_requests
  ADD COLUMN IF NOT EXISTS family_rules_snapshot TEXT NOT NULL DEFAULT '';

COMMIT;
