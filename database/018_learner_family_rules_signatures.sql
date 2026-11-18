BEGIN;
CREATE TABLE IF NOT EXISTS learner_family_rules_signatures (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  signer_user_id UUID REFERENCES app_users(id),
  signer_name VARCHAR(180) NOT NULL,
  signer_role VARCHAR(30) NOT NULL CHECK (signer_role IN ('parent_guardian','adult_student')),
  signature_text VARCHAR(180) NOT NULL,
  rules_version VARCHAR(40) NOT NULL,
  rules_snapshot TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS learner_family_rules_signed_at_idx ON learner_family_rules_signatures(signed_at DESC);
INSERT INTO learner_family_rules_signatures(student_id,signer_name,signer_role,signature_text,rules_version,rules_snapshot,signed_at)
SELECT linked_student_id,family_rules_signer_name,family_rules_signer_role,family_rules_signer_name,family_rules_version,family_rules_snapshot,family_rules_signed_at
FROM student_registration_requests
WHERE linked_student_id IS NOT NULL AND COALESCE(family_rules_signed_at IS NOT NULL AND family_rules_signature<>'',FALSE)
ON CONFLICT(student_id) DO NOTHING;
COMMIT;
