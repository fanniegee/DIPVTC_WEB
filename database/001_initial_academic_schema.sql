-- Initial academic tables from the included Server Edition foundation.
-- Apply after PostgreSQL is provisioned. Later migrations will add user access,
-- attendance, report-book comments/signatures and school administration data.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS academic_sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 school_name VARCHAR(180) NOT NULL DEFAULT 'Double Impact Private College',
 academic_year INTEGER NOT NULL, term VARCHAR(40) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','locked','published')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(academic_year,term)
);
CREATE TABLE IF NOT EXISTS classes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 level VARCHAR(20) NOT NULL CHECK(level IN ('primary','secondary')),
 name VARCHAR(80) NOT NULL, UNIQUE(level,name)
);
CREATE TABLE IF NOT EXISTS students (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 student_number VARCHAR(50) UNIQUE, full_name VARCHAR(180) NOT NULL,
 class_id UUID REFERENCES classes(id), active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS subjects (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 level VARCHAR(20) NOT NULL CHECK(level IN ('primary','secondary')),
 name VARCHAR(120) NOT NULL, class_id UUID REFERENCES classes(id),
 active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS subject_papers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
 paper_order INTEGER NOT NULL, paper_name VARCHAR(100) NOT NULL,
 maximum_mark NUMERIC(8,2) NOT NULL CHECK(maximum_mark > 0),
 UNIQUE(subject_id,paper_order)
);
CREATE TABLE IF NOT EXISTS examination_marks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
 student_id UUID NOT NULL REFERENCES students(id),
 subject_id UUID NOT NULL REFERENCES subjects(id),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(session_id,student_id,subject_id)
);
CREATE TABLE IF NOT EXISTS examination_paper_marks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 examination_mark_id UUID NOT NULL REFERENCES examination_marks(id) ON DELETE CASCADE,
 subject_paper_id UUID NOT NULL REFERENCES subject_papers(id),
 obtained_mark NUMERIC(8,2) NOT NULL CHECK(obtained_mark >= 0),
 UNIQUE(examination_mark_id,subject_paper_id)
);
CREATE INDEX IF NOT EXISTS marks_session_student_idx ON examination_marks(session_id,student_id);
CREATE INDEX IF NOT EXISTS students_class_idx ON students(class_id);
