BEGIN;

CREATE TABLE IF NOT EXISTS learner_task_annual_outcomes(
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_id UUID NOT NULL,
  school_year INTEGER NOT NULL,
  task_title VARCHAR(180) NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  outcome VARCHAR(16) NOT NULL CHECK(outcome IN ('completed','uncompleted')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(student_id,task_id,school_year)
);
CREATE INDEX IF NOT EXISTS learner_task_annual_outcomes_year_idx
  ON learner_task_annual_outcomes(student_id,school_year,outcome);

CREATE TABLE IF NOT EXISTS academic_years (
  academic_year INTEGER PRIMARY KEY CHECK (academic_year BETWEEN 2000 AND 2200),
  status VARCHAR(16) NOT NULL DEFAULT 'closed' CHECK (status IN ('current','closed','planning')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO academic_years(academic_year,status)
SELECT active_year,'current' FROM academic_year_control WHERE singleton=TRUE
ON CONFLICT(academic_year) DO UPDATE SET status='current',closed_at=NULL;

-- Keep a catalogue row for every year already represented in school records.
INSERT INTO academic_years(academic_year,status)
SELECT DISTINCT y,'closed' FROM (
  SELECT academic_year AS y FROM academic_sessions
  UNION SELECT academic_year FROM student_enrollments
  UNION SELECT school_year FROM learner_task_annual_outcomes
  UNION SELECT EXTRACT(YEAR FROM attendance_date)::int FROM learner_attendance
  UNION SELECT EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Johannesburg')::int FROM learner_learning_items
  UNION SELECT EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Johannesburg')::int FROM teacher_tasks
  UNION SELECT EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Johannesburg')::int FROM school_messages
  UNION SELECT EXTRACT(YEAR FROM submitted_at AT TIME ZONE 'Africa/Johannesburg')::int FROM teacher_class_reports
  UNION SELECT EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Johannesburg')::int FROM learning_media
  UNION SELECT EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Johannesburg')::int FROM teacher_html_requests
  UNION SELECT EXTRACT(YEAR FROM attendance_date)::int FROM exam_mark_attendance_audit
) years WHERE y BETWEEN 2000 AND 2200
ON CONFLICT(academic_year) DO NOTHING;

ALTER TABLE learner_attendance ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE learner_learning_items ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE teacher_tasks ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE teacher_task_submissions ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE teacher_task_marks ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE teacher_task_incidents ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE school_messages ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE teacher_class_reports ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE learning_media ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE teacher_html_requests ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE exam_mark_attendance_audit ADD COLUMN IF NOT EXISTS academic_year INTEGER;

UPDATE learner_attendance SET academic_year=EXTRACT(YEAR FROM attendance_date)::int WHERE academic_year IS NULL;
UPDATE learner_learning_items SET academic_year=EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Johannesburg')::int WHERE academic_year IS NULL;
UPDATE teacher_tasks SET academic_year=EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Johannesburg')::int WHERE academic_year IS NULL;
UPDATE teacher_task_submissions sub SET academic_year=t.academic_year FROM teacher_tasks t WHERE sub.task_id=t.id AND sub.academic_year IS NULL;
UPDATE teacher_task_marks m SET academic_year=sub.academic_year FROM teacher_task_submissions sub WHERE m.submission_id=sub.id AND m.academic_year IS NULL;
UPDATE teacher_task_incidents i SET academic_year=t.academic_year FROM teacher_task_submissions sub JOIN teacher_tasks t ON t.id=sub.task_id WHERE i.submission_id=sub.id AND i.academic_year IS NULL;
UPDATE school_messages m SET academic_year=t.academic_year FROM teacher_tasks t
  WHERE m.related_task_id=t.id AND m.academic_year IS NULL;
UPDATE school_messages SET academic_year=EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Johannesburg')::int WHERE academic_year IS NULL;
UPDATE teacher_class_reports SET academic_year=EXTRACT(YEAR FROM submitted_at AT TIME ZONE 'Africa/Johannesburg')::int WHERE academic_year IS NULL;
UPDATE learning_media SET academic_year=EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Johannesburg')::int WHERE academic_year IS NULL;
UPDATE teacher_html_requests SET academic_year=EXTRACT(YEAR FROM created_at AT TIME ZONE 'Africa/Johannesburg')::int WHERE academic_year IS NULL;
UPDATE exam_mark_attendance_audit SET academic_year=EXTRACT(YEAR FROM attendance_date)::int WHERE academic_year IS NULL;

-- Older roster positions can be reconstructed where a dated task or
-- attendance register records the learner's actual class for that year.
ALTER TABLE student_enrollments DROP CONSTRAINT IF EXISTS student_enrollments_source_check;
ALTER TABLE student_enrollments ADD CONSTRAINT student_enrollments_source_check
  CHECK (source IN ('current-record','admission','year-rollover','admin-correction','historical-import'));
WITH evidence AS (
  SELECT sub.student_id,t.academic_year,t.class_id,COUNT(*)::int AS weight,MAX(t.created_at) AS newest
  FROM teacher_task_submissions sub JOIN teacher_tasks t ON t.id=sub.task_id
  WHERE t.academic_year < (SELECT active_year FROM academic_year_control WHERE singleton=TRUE)
  GROUP BY sub.student_id,t.academic_year,t.class_id
  UNION ALL
  SELECT s.id,a.academic_year,c.id,COUNT(*)::int,MAX(a.recorded_at)
  FROM exam_mark_attendance_audit a JOIN students s ON s.id::text=a.student_ref JOIN classes c ON c.name=a.class_name
    AND a.academic_year < (SELECT active_year FROM academic_year_control WHERE singleton=TRUE)
  GROUP BY s.id,a.academic_year,c.id
), ranked AS (
  SELECT student_id,academic_year,class_id,ROW_NUMBER() OVER
    (PARTITION BY student_id,academic_year ORDER BY SUM(weight) DESC,MAX(newest) DESC,class_id) AS rank
  FROM evidence GROUP BY student_id,academic_year,class_id
)
INSERT INTO student_enrollments(student_id,academic_year,class_id,status,source)
SELECT student_id,academic_year,class_id,'enrolled','historical-import' FROM ranked WHERE rank=1
ON CONFLICT(student_id,academic_year) DO NOTHING;

ALTER TABLE learner_attendance ALTER COLUMN academic_year SET NOT NULL;
ALTER TABLE learner_learning_items ALTER COLUMN academic_year SET NOT NULL;
ALTER TABLE teacher_tasks ALTER COLUMN academic_year SET NOT NULL;
ALTER TABLE teacher_task_submissions ALTER COLUMN academic_year SET NOT NULL;
ALTER TABLE teacher_task_marks ALTER COLUMN academic_year SET NOT NULL;
ALTER TABLE teacher_task_incidents ALTER COLUMN academic_year SET NOT NULL;
ALTER TABLE school_messages ALTER COLUMN academic_year SET NOT NULL;
ALTER TABLE teacher_class_reports ALTER COLUMN academic_year SET NOT NULL;
ALTER TABLE learning_media ALTER COLUMN academic_year SET NOT NULL;
ALTER TABLE teacher_html_requests ALTER COLUMN academic_year SET NOT NULL;
ALTER TABLE exam_mark_attendance_audit ALTER COLUMN academic_year SET NOT NULL;

DO $$
DECLARE old_constraint RECORD;
BEGIN
  FOR old_constraint IN SELECT conname FROM pg_constraint
    WHERE conrelid='teacher_class_reports'::regclass AND contype='u'
      AND pg_get_constraintdef(oid)='UNIQUE (class_id, teacher_id, period, period_label)'
  LOOP
    EXECUTE format('ALTER TABLE teacher_class_reports DROP CONSTRAINT %I',old_constraint.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='teacher_class_reports_class_teacher_period_year_key') THEN
    ALTER TABLE teacher_class_reports ADD CONSTRAINT teacher_class_reports_class_teacher_period_year_key
      UNIQUE(class_id,teacher_id,period,period_label,academic_year);
  END IF;
END $$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['learner_attendance','learner_learning_items','teacher_tasks','teacher_task_submissions','teacher_task_marks','teacher_task_incidents','school_messages','teacher_class_reports','learning_media','teacher_html_requests','exam_mark_attendance_audit'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=table_name || '_academic_year_fk') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (academic_year) REFERENCES academic_years(academic_year) ON DELETE RESTRICT', table_name, table_name || '_academic_year_fk');
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(academic_year)', table_name || '_academic_year_idx', table_name);
  END LOOP;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='learner_task_annual_outcomes_school_year_fk') THEN
    ALTER TABLE learner_task_annual_outcomes ADD CONSTRAINT learner_task_annual_outcomes_school_year_fk
      FOREIGN KEY (school_year) REFERENCES academic_years(academic_year) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_record_academic_year() RETURNS TRIGGER AS $$
DECLARE chosen_year INTEGER;
BEGIN
  IF NEW.academic_year IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='teacher_task_submissions' THEN
    SELECT academic_year INTO chosen_year FROM teacher_tasks WHERE id=NEW.task_id;
  ELSIF TG_TABLE_NAME='teacher_task_marks' THEN
    SELECT academic_year INTO chosen_year FROM teacher_task_submissions WHERE id=NEW.submission_id;
  ELSIF TG_TABLE_NAME='teacher_task_incidents' THEN
    SELECT academic_year INTO chosen_year FROM teacher_task_submissions WHERE id=NEW.submission_id;
  ELSIF TG_TABLE_NAME='school_messages' AND NEW.related_task_id IS NOT NULL THEN
    SELECT academic_year INTO chosen_year FROM teacher_tasks WHERE id=NEW.related_task_id;
  ELSIF TG_TABLE_NAME='learner_attendance' OR TG_TABLE_NAME='exam_mark_attendance_audit' THEN
    chosen_year := EXTRACT(YEAR FROM NEW.attendance_date)::int;
  END IF;
  IF chosen_year IS NULL THEN SELECT active_year INTO chosen_year FROM academic_year_control WHERE singleton=TRUE; END IF;
  NEW.academic_year := chosen_year;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['learner_attendance','learner_learning_items','teacher_tasks','teacher_task_submissions','teacher_task_marks','teacher_task_incidents','school_messages','teacher_class_reports','learning_media','teacher_html_requests','exam_mark_attendance_audit'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', table_name || '_set_academic_year', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_record_academic_year()', table_name || '_set_academic_year', table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION sync_academic_year_catalogue() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO academic_years(academic_year,status) VALUES(NEW.active_year,'current')
  ON CONFLICT(academic_year) DO UPDATE SET status='current',closed_at=NULL;
  UPDATE academic_years SET status='closed',closed_at=COALESCE(closed_at,NOW())
    WHERE academic_year<>NEW.active_year AND status='current';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS academic_year_control_catalogue_sync ON academic_year_control;
CREATE TRIGGER academic_year_control_catalogue_sync
AFTER UPDATE OF active_year ON academic_year_control
FOR EACH ROW WHEN (OLD.active_year IS DISTINCT FROM NEW.active_year)
EXECUTE FUNCTION sync_academic_year_catalogue();

COMMIT;
