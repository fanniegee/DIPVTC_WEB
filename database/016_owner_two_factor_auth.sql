BEGIN;

CREATE TABLE IF NOT EXISTS owner_two_factor (
  user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  secret_ciphertext TEXT,
  pending_secret_ciphertext TEXT,
  recovery_code_hashes JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT enabled OR secret_ciphertext IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS owner_two_factor_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS owner_two_factor_challenges_expiry_idx
  ON owner_two_factor_challenges(expires_at);

COMMIT;
