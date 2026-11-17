BEGIN;

CREATE TABLE IF NOT EXISTS exam_mark_attendance_audit (
  id BIGSERIAL PRIMARY KEY,
  register_id UUID NOT NULL,
  student_ref VARCHAR(120) NOT NULL,
  student_number VARCHAR(80) NOT NULL DEFAULT '',
  student_name VARCHAR(180) NOT NULL,
  attendance_date DATE NOT NULL,
  level VARCHAR(20) NOT NULL CHECK (level IN ('primary','secondary')),
  class_name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present','absent','late','excused')),
  note VARCHAR(500) NOT NULL DEFAULT '',
  recorded_by UUID REFERENCES app_users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exam_mark_attendance_audit_date_idx
  ON exam_mark_attendance_audit(attendance_date DESC, level, class_name);
CREATE INDEX IF NOT EXISTS exam_mark_attendance_audit_student_idx
  ON exam_mark_attendance_audit(student_ref, attendance_date DESC, recorded_at DESC);
CREATE INDEX IF NOT EXISTS exam_mark_attendance_audit_register_idx
  ON exam_mark_attendance_audit(register_id, recorded_at DESC);

COMMIT;