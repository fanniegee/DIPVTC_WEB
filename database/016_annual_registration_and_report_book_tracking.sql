BEGIN;

ALTER TABLE learner_payment_accounts
  ADD COLUMN IF NOT EXISTS report_book_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS annual_registration_paid_year INTEGER;

-- Existing families retain access through the current calendar year. Existing
-- accounts are treated as having already paid the one-time report book fee.
UPDATE learner_payment_accounts
SET report_book_paid_at = COALESCE(report_book_paid_at, onboarding_completed_at, NOW()),
    annual_registration_paid_year = COALESCE(annual_registration_paid_year, EXTRACT(YEAR FROM NOW())::INTEGER)
WHERE onboarding_required = FALSE OR onboarding_completed_at IS NOT NULL;

ALTER TABLE learner_payment_submissions
  DROP CONSTRAINT IF EXISTS learner_payment_submissions_payment_kind_check;
ALTER TABLE learner_payment_submissions
  ADD CONSTRAINT learner_payment_submissions_payment_kind_check
  CHECK (payment_kind IN ('onboarding','annual_registration','monthly'));

COMMIT;
