CREATE TABLE IF NOT EXISTS public_assistant_rate_limits (
  bucket_key VARCHAR(500) PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL CHECK (hit_count >= 0)
);

CREATE INDEX IF NOT EXISTS public_assistant_rate_limits_window_idx
  ON public_assistant_rate_limits(window_started_at);

CREATE TABLE IF NOT EXISTS public_assistant_concurrency_leases (
  lease_id UUID PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS public_assistant_concurrency_leases_expiry_idx
  ON public_assistant_concurrency_leases(expires_at);
