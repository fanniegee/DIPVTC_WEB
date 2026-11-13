BEGIN;
ALTER TABLE student_registration_requests
  ADD COLUMN IF NOT EXISTS family_rules_signer_id VARCHAR(80) NOT NULL DEFAULT '';
INSERT INTO site_state(state_key,value)
VALUES('dipvtc_school_price_rules','{"schoolFeeMonthly":1500,"termMonths":4,"primaryBoardingMonthly":3500,"highSchoolBoardingMonthly":3500,"dueDay":1,"finalDueDay":3,"lateInterestPercent":15,"uniformPenalty":100,"dayRegistrationAnnual":500,"boardingRegistrationAnnual":800}'::jsonb)
ON CONFLICT(state_key) DO NOTHING;
COMMIT;
