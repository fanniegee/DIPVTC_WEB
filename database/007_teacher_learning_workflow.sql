BEGIN;

CREATE TABLE IF NOT EXISTS teacher_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES app_users(id),
  title VARCHAR(180) NOT NULL,
  category VARCHAR(32) NOT NULL CHECK (category IN ('daily_exercise','weekend_assignment','fortnight_revision','monthly_revision','other')),
  format VARCHAR(32) NOT NULL CHECK (format IN ('multiple_choice','structured','tutorial','voice_note')),
  instructions TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL DEFAULT '',
  opens_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  time_limit_minutes INTEGER CHECK (time_limit_minutes BETWEEN 1 AND 600),
  requires_correction BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS teacher_tasks_class_status_idx ON teacher_tasks(class_id,status,due_at);
CREATE INDEX IF NOT EXISTS teacher_tasks_teacher_idx ON teacher_tasks(teacher_id,created_at DESC);

CREATE TABLE IF NOT EXISTS teacher_task_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES teacher_tasks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('multiple_choice','short_answer','long_answer','voice_response')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer_key TEXT NOT NULL DEFAULT '',
  points NUMERIC(7,2) NOT NULL DEFAULT 1 CHECK(points > 0 AND points <= 10000),
  media_url TEXT NOT NULL DEFAULT '',
  UNIQUE(task_id,position)
);

CREATE TABLE IF NOT EXISTS teacher_task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES teacher_tasks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','submitted','timed_out','marked','correction_pending','correction_submitted','review_pending')),
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  corrections_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  total_obtained NUMERIC(9,2),
  overall_comment TEXT NOT NULL DEFAULT '',
  incident_reason TEXT NOT NULL DEFAULT '',
  review_status VARCHAR(20) NOT NULL DEFAULT 'clear' CHECK(review_status IN ('clear','pending','approved','declined')),
  reviewed_by UUID REFERENCES app_users(id),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id,student_id)
);
CREATE INDEX IF NOT EXISTS teacher_task_submissions_task_status_idx ON teacher_task_submissions(task_id,status);
CREATE INDEX IF NOT EXISTS teacher_task_submissions_student_idx ON teacher_task_submissions(student_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS teacher_task_marks (
  submission_id UUID NOT NULL REFERENCES teacher_task_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES teacher_task_questions(id) ON DELETE CASCADE,
  obtained NUMERIC(7,2) NOT NULL DEFAULT 0 CHECK(obtained >= 0),
  correction TEXT NOT NULL DEFAULT '',
  marked_by UUID NOT NULL REFERENCES app_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(submission_id,question_id)
);

CREATE TABLE IF NOT EXISTS teacher_task_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES teacher_task_submissions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL CHECK(event_type IN ('visibility_hidden','page_exit','copy_attempt','context_menu','timer_expired','resume_requested')),
  details VARCHAR(500) NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  review_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','declined','logged')),
  reviewed_by UUID REFERENCES app_users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS teacher_task_incidents_student_idx ON teacher_task_incidents(student_id,created_at DESC);

CREATE TABLE IF NOT EXISTS school_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES app_users(id),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 5000),
  related_task_id UUID REFERENCES teacher_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS school_messages_student_idx ON school_messages(student_id,created_at);

CREATE TABLE IF NOT EXISTS teacher_class_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES app_users(id),
  period VARCHAR(16) NOT NULL CHECK(period IN ('weekly','monthly','term')),
  period_label VARCHAR(80) NOT NULL,
  completed_work TEXT NOT NULL DEFAULT '',
  performance_summary TEXT NOT NULL,
  next_steps TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(class_id,teacher_id,period,period_label)
);
CREATE INDEX IF NOT EXISTS teacher_class_reports_date_idx ON teacher_class_reports(submitted_at DESC);

COMMIT;
