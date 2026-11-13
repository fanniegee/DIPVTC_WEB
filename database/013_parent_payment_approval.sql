BEGIN;
ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS boarding_status VARCHAR(20) NOT NULL DEFAULT 'day'
    CHECK (boarding_status IN ('day','boarding'));
ALTER TABLE student_registration_requests
  ADD COLUMN IF NOT EXISTS boarding_status VARCHAR(20) NOT NULL DEFAULT 'day'
    CHECK (boarding_status IN ('day','boarding'));

CREATE TABLE IF NOT EXISTS learner_payment_accounts (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  onboarding_required BOOLEAN NOT NULL DEFAULT TRUE,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Existing learners keep their current access. New admissions get a required payment account.
INSERT INTO learner_payment_accounts(student_id,onboarding_required,onboarding_completed_at)
SELECT id,FALSE,NOW() FROM students ON CONFLICT(student_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS learner_payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL REFERENCES app_users(id),
  payment_kind VARCHAR(20) NOT NULL CHECK(payment_kind IN ('onboarding','monthly')),
  period_key CHAR(7) NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
  payment_method VARCHAR(50) NOT NULL DEFAULT '',
  payment_reference VARCHAR(180) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  office_note VARCHAR(1000) NOT NULL DEFAULT '',
  reviewed_by UUID REFERENCES app_users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS learner_payment_submissions_student_period_idx
  ON learner_payment_submissions(student_id,period_key,status);
CREATE INDEX IF NOT EXISTS learner_payment_submissions_review_idx
  ON learner_payment_submissions(status,created_at DESC) WHERE status='pending';
CREATE INDEX IF NOT EXISTS learner_payment_submissions_parent_idx
  ON learner_payment_submissions(parent_user_id,created_at DESC);

UPDATE site_state SET value = value || '{"primaryFullTermAmount":4000,"primaryMonthlyMinimum":1000,"highSchoolFullTermAmount":6000,"highSchoolMonthlyMinimum":1500,"newRegistrationFee":500,"reportBookFee":250}'::jsonb
WHERE state_key='dipvtc_school_price_rules';
COMMIT;
