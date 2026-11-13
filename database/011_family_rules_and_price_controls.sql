BEGIN;
ALTER TABLE student_registration_requests
  ADD COLUMN IF NOT EXISTS family_rules_signer_name VARCHAR(180) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS family_rules_signer_role VARCHAR(30) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS family_rules_signature TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS family_rules_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS family_rules_version VARCHAR(40) NOT NULL DEFAULT '';
COMMIT;
