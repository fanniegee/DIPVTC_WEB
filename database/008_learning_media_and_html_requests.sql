BEGIN;

CREATE TABLE IF NOT EXISTS learning_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(120) NOT NULL,
  byte_size BIGINT NOT NULL CHECK(byte_size > 0 AND byte_size <= 26214400),
  uploaded_by UUID NOT NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS learning_media_class_idx ON learning_media(class_id,created_at DESC);
CREATE INDEX IF NOT EXISTS learning_media_uploader_idx ON learning_media(uploaded_by,created_at DESC);

CREATE TABLE IF NOT EXISTS teacher_html_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES app_users(id),
  task_title VARCHAR(180) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','connected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS teacher_html_requests_status_idx ON teacher_html_requests(status,created_at DESC);

COMMIT;
