BEGIN;

-- Store only Meta message IDs for webhook deduplication and retry handling.
-- Message content and sender phone numbers are never persisted here.
CREATE TABLE IF NOT EXISTS whatsapp_assistant_webhook_events (
  message_id VARCHAR(250) PRIMARY KEY,
  status VARCHAR(20) NOT NULL CHECK (status IN ('processing','sent','failed','ignored')),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 5),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_assistant_webhook_events_retention_idx
  ON whatsapp_assistant_webhook_events(received_at);

COMMIT;
