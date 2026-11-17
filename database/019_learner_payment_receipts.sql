BEGIN;

CREATE TABLE IF NOT EXISTS learner_payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES learner_payment_submissions(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(80) NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  uploaded_by UUID NOT NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS learner_payment_receipts_uploader_idx
  ON learner_payment_receipts(uploaded_by, created_at DESC);

COMMIT;
