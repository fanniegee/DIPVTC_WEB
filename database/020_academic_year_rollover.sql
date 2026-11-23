BEGIN;

CREATE TABLE IF NOT EXISTS academic_year_control (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  active_year INTEGER NOT NULL CHECK (active_year BETWEEN 2000 AND 2200),
  timezone VARCHAR(80) NOT NULL DEFAULT 'Africa/Johannesburg',
  updated_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO academic_year_control(singleton, active_year, timezone)
VALUES (TRUE, EXTRACT(YEAR FROM NOW() AT TIME ZONE 'Africa/Johannesburg')::INTEGER, 'Africa/Johannesburg')
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  academic_year INTEGER NOT NULL CHECK (academic_year BETWEEN 2000 AND 2200),
  class_id UUID REFERENCES classes(id) ON DELETE RESTRICT,
  status VARCHAR(24) NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled','completed','withdrawn','rolled_back')),
  source VARCHAR(24) NOT NULL DEFAULT 'current-record'
    CHECK (source IN ('current-record','admission','year-rollover','admin-correction')),
  created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, academic_year)
);
CREATE INDEX IF NOT EXISTS student_enrollments_year_class_idx
  ON student_enrollments(academic_year, class_id, status);
CREATE INDEX IF NOT EXISTS student_enrollments_student_year_idx
  ON student_enrollments(student_id, academic_year DESC);

CREATE TABLE IF NOT EXISTS academic_year_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(24) NOT NULL CHECK (action IN ('rollover','rollback','learner_rollback')),
  from_year INTEGER NOT NULL,
  to_year INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  changed_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
  related_event_id UUID REFERENCES academic_year_events(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS academic_year_events_created_idx
  ON academic_year_events(created_at DESC);

CREATE TABLE IF NOT EXISTS academic_year_event_learners (
  event_id UUID NOT NULL REFERENCES academic_year_events(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  old_class_id UUID REFERENCES classes(id) ON DELETE RESTRICT,
  new_class_id UUID REFERENCES classes(id) ON DELETE RESTRICT,
  old_intended_class VARCHAR(120) NOT NULL DEFAULT '',
  new_intended_class VARCHAR(120) NOT NULL DEFAULT '',
  action VARCHAR(24) NOT NULL CHECK (action IN ('promoted','retained','non-academic','restored')),
  PRIMARY KEY(event_id, student_id)
);
CREATE INDEX IF NOT EXISTS academic_year_event_learners_student_idx
  ON academic_year_event_learners(student_id, event_id);

-- Preserve the current roster as the starting point for the active year.
INSERT INTO student_enrollments(student_id, academic_year, class_id, status, source)
SELECT s.id, control.active_year, s.class_id,
       CASE WHEN s.active THEN 'enrolled' ELSE 'withdrawn' END,
       'current-record'
FROM students s
CROSS JOIN academic_year_control control
WHERE control.singleton = TRUE
ON CONFLICT(student_id, academic_year) DO NOTHING;

-- Keep the live roster and the current-year enrollment in step. Old-year rows
-- remain untouched, so class edits and annual promotions remain auditable.
CREATE OR REPLACE FUNCTION sync_current_student_enrollment() RETURNS TRIGGER AS $$
DECLARE current_year INTEGER;
BEGIN
  SELECT active_year INTO current_year FROM academic_year_control WHERE singleton = TRUE;
  IF current_year IS NOT NULL THEN
    INSERT INTO student_enrollments(student_id, academic_year, class_id, status, source, updated_at)
    VALUES(NEW.id, current_year, NEW.class_id,
           CASE WHEN NEW.active THEN 'enrolled' ELSE 'withdrawn' END,
           CASE WHEN TG_OP = 'INSERT' THEN 'admission' ELSE 'admin-correction' END, NOW())
    ON CONFLICT(student_id, academic_year) DO UPDATE
      SET class_id = EXCLUDED.class_id,
          status = EXCLUDED.status,
          source = CASE WHEN TG_OP = 'INSERT' THEN 'admission' ELSE 'admin-correction' END,
          updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS students_sync_current_enrollment ON students;
CREATE TRIGGER students_sync_current_enrollment
AFTER INSERT OR UPDATE OF class_id, active ON students
FOR EACH ROW EXECUTE FUNCTION sync_current_student_enrollment();

COMMIT;
