BEGIN;
CREATE TABLE IF NOT EXISTS student_number_counters (
  school_year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);
INSERT INTO student_number_counters(school_year, last_number)
SELECT split_part(student_number, '-', 2)::INTEGER, MAX(split_part(student_number, '-', 3)::INTEGER)
FROM students WHERE student_number ~ '^DIP-[0-9]{4}-[0-9]+$'
GROUP BY split_part(student_number, '-', 2)::INTEGER
ON CONFLICT (school_year) DO UPDATE SET last_number = GREATEST(student_number_counters.last_number, EXCLUDED.last_number);
ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS health_condition_status VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (health_condition_status IN ('none','has_conditions','unknown')),
  ADD COLUMN IF NOT EXISTS health_conditions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS health_condition_other TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS has_allergies BOOLEAN,
  ADD COLUMN IF NOT EXISTS allergies TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allergy_other TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(180) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS doctor_clinic VARCHAR(180) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS doctor_phone VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS doctor_email VARCHAR(254) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS doctor_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS health_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE student_registration_requests
  ADD COLUMN IF NOT EXISTS student_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS health_condition_status VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (health_condition_status IN ('none','has_conditions','unknown')),
  ADD COLUMN IF NOT EXISTS health_conditions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS health_condition_other TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS has_allergies BOOLEAN,
  ADD COLUMN IF NOT EXISTS allergies TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allergy_other TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(180) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS doctor_clinic VARCHAR(180) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS doctor_phone VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS doctor_email VARCHAR(254) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS doctor_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS health_notes TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS student_registration_requests_student_number_idx ON student_registration_requests(student_number) WHERE student_number IS NOT NULL;
COMMIT;