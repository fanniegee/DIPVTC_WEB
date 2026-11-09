BEGIN;

ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('owner','admin','principal','teacher','admissions','finance','content','front_desk','staff','parent','student'));

CREATE TABLE IF NOT EXISTS learner_profiles (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  date_of_birth DATE,
  gender VARCHAR(40) NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  guardian_name VARCHAR(180) NOT NULL DEFAULT '',
  guardian_email VARCHAR(254) NOT NULL DEFAULT '',
  guardian_phone VARCHAR(40) NOT NULL DEFAULT '',
  student_email VARCHAR(254) NOT NULL DEFAULT '',
  updated_by UUID REFERENCES app_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS learner_profiles_guardian_email_idx ON learner_profiles(LOWER(guardian_email));

CREATE TABLE IF NOT EXISTS portal_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL,
  display_name VARCHAR(180) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('parent','student')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS portal_invites_email_role_idx ON portal_invites(LOWER(email),role);
CREATE INDEX IF NOT EXISTS portal_invites_expiry_idx ON portal_invites(expires_at);

CREATE TABLE IF NOT EXISTS portal_invite_students (
  invite_id UUID NOT NULL REFERENCES portal_invites(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship VARCHAR(60) NOT NULL DEFAULT 'Parent / Guardian',
  PRIMARY KEY(invite_id,student_id)
);

CREATE TABLE IF NOT EXISTS portal_student_access (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship VARCHAR(60) NOT NULL DEFAULT 'Parent / Guardian',
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id,student_id)
);
CREATE INDEX IF NOT EXISTS portal_student_access_student_idx ON portal_student_access(student_id);

CREATE TABLE IF NOT EXISTS learner_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK(status IN ('present','absent','late','excused')),
  note VARCHAR(500) NOT NULL DEFAULT '',
  recorded_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id,attendance_date)
);
CREATE INDEX IF NOT EXISTS learner_attendance_student_date_idx ON learner_attendance(student_id,attendance_date DESC);

CREATE TABLE IF NOT EXISTS learner_learning_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  kind VARCHAR(24) NOT NULL CHECK(kind IN ('lesson','assignment','resource','announcement')),
  title VARCHAR(180) NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  due_date DATE,
  resource_url TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(class_id IS NOT NULL OR student_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS learner_learning_class_idx ON learner_learning_items(class_id,published,created_at DESC);
CREATE INDEX IF NOT EXISTS learner_learning_student_idx ON learner_learning_items(student_id,published,created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','issued','closed')),
  resolved_by UUID REFERENCES app_users(id),
  resolved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_one_pending_email_idx
  ON password_reset_requests(LOWER(email)) WHERE status='pending';
CREATE INDEX IF NOT EXISTS password_reset_requests_status_idx ON password_reset_requests(status,created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  issued_by UUID NOT NULL REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expiry_idx ON password_reset_tokens(expires_at);

COMMIT;
