BEGIN;
ALTER TABLE learner_attendance ADD COLUMN IF NOT EXISTS academic_term VARCHAR(40);
ALTER TABLE exam_mark_attendance_audit ADD COLUMN IF NOT EXISTS academic_term VARCHAR(40);
CREATE INDEX IF NOT EXISTS learner_attendance_term_idx ON learner_attendance(academic_year,academic_term,attendance_date);
CREATE INDEX IF NOT EXISTS exam_mark_attendance_term_idx ON exam_mark_attendance_audit(academic_year,academic_term,attendance_date);
COMMIT;
