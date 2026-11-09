CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL UNIQUE,
  display_name VARCHAR(180) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner','admin')),
  section VARCHAR(120) NOT NULL DEFAULT 'All Sections',
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS site_state (
  state_key VARCHAR(120) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES app_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES app_users(id),
  action VARCHAR(80) NOT NULL,
  target_key VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS website_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL,
  course VARCHAR(120) NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS website_enquiries_created_idx ON website_enquiries(created_at DESC);
