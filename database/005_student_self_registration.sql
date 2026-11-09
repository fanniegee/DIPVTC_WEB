BEGIN;

ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS school_code VARCHAR(40) NOT NULL DEFAULT 'zimsec',
  ADD COLUMN IF NOT EXISTS intended_class VARCHAR(120) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS student_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
  student_name VARCHAR(180) NOT NULL,
  student_email VARCHAR(254) NOT NULL,
  school_code VARCHAR(40) NOT NULL,
  intended_class VARCHAR(120) NOT NULL,
  academic_level VARCHAR(20) CHECK (academic_level IN ('primary','secondary') OR academic_level IS NULL),
  date_of_birth DATE,
  guardian_name VARCHAR(180) NOT NULL DEFAULT '',
  guardian_email VARCHAR(254) NOT NULL DEFAULT '',
  guardian_phone VARCHAR(40) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','approved','rejected')),
  linked_student_id UUID REFERENCES students(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES app_users(id),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS student_registration_requests_status_date_idx
  ON student_registration_requests(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS student_registration_requests_email_idx
  ON student_registration_requests(LOWER(student_email));

COMMIT;
