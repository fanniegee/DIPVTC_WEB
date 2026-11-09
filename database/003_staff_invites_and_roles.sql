BEGIN;

ALTER TABLE app_users
  DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users
  ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('owner','admin','principal','teacher','admissions','finance','content','front_desk','staff'));
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS role_title VARCHAR(100) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS app_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL,
  display_name VARCHAR(180) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('principal','teacher','admissions','finance','content','front_desk','staff')),
  role_title VARCHAR(100) NOT NULL,
  section VARCHAR(120) NOT NULL DEFAULT 'All Sections',
  token_hash CHAR(64) NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS app_invites_pending_email_uq
  ON app_invites(LOWER(email)) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS app_invites_expiry_idx ON app_invites(expires_at);

COMMIT;
