BEGIN;

-- Canonical ZIMSEC academic classes. Names follow the existing school-code
-- convention used when learner registrations create classes.
INSERT INTO classes(level, name) VALUES
 ('primary', 'zimsec · ECD-A'), ('primary', 'zimsec · ECD-B'),
 ('primary', 'zimsec · Grade 1'), ('primary', 'zimsec · Grade 2'),
 ('primary', 'zimsec · Grade 3'), ('primary', 'zimsec · Grade 4'),
 ('primary', 'zimsec · Grade 5'), ('primary', 'zimsec · Grade 6'),
 ('primary', 'zimsec · Grade 7'),
 ('secondary', 'zimsec · Form 1'), ('secondary', 'zimsec · Form 2'),
 ('secondary', 'zimsec · Form 3'), ('secondary', 'zimsec · Form 4'),
 ('secondary', 'zimsec · Lower 6'), ('secondary', 'zimsec · Upper 6')
ON CONFLICT(level, name) DO NOTHING;

-- Re-link existing ZIMSEC learners and class-bound content from the older
-- labels (for example “ECD A” and “Form 3 / O Level”) to the canonical classes.
CREATE TEMP TABLE zimsec_class_rekey ON COMMIT DROP AS
SELECT old.id AS old_id, canonical.id AS canonical_id
FROM classes old
JOIN classes canonical ON canonical.level = old.level
 AND lower(canonical.name) = lower('zimsec · ' || CASE
   WHEN lower(regexp_replace(old.name, '^zimsec · ', '', 'i')) = 'ecd a' THEN 'ECD-A'
   WHEN lower(regexp_replace(old.name, '^zimsec · ', '', 'i')) = 'ecd b' THEN 'ECD-B'
   WHEN lower(regexp_replace(old.name, '^zimsec · ', '', 'i')) = 'form 3 / o level' THEN 'Form 3'
   WHEN lower(regexp_replace(old.name, '^zimsec · ', '', 'i')) = 'form 4 / o level' THEN 'Form 4'
   WHEN lower(regexp_replace(old.name, '^zimsec · ', '', 'i')) = 'form 5 / a level' THEN 'Lower 6'
   WHEN lower(regexp_replace(old.name, '^zimsec · ', '', 'i')) = 'form 6 / a level' THEN 'Upper 6'
   ELSE regexp_replace(old.name, '^zimsec · ', '', 'i') END)
WHERE lower(old.name) LIKE 'zimsec · %' AND old.id <> canonical.id;

UPDATE students s SET class_id = m.canonical_id FROM zimsec_class_rekey m WHERE s.class_id = m.old_id;
UPDATE subjects s SET class_id = m.canonical_id FROM zimsec_class_rekey m WHERE s.class_id = m.old_id;
UPDATE learner_learning_items i SET class_id = m.canonical_id FROM zimsec_class_rekey m WHERE i.class_id = m.old_id;
UPDATE teacher_tasks t SET class_id = m.canonical_id FROM zimsec_class_rekey m WHERE t.class_id = m.old_id;
UPDATE learning_media m SET class_id = r.canonical_id FROM zimsec_class_rekey r WHERE m.class_id = r.old_id;
UPDATE teacher_html_requests h SET class_id = r.canonical_id FROM zimsec_class_rekey r WHERE h.class_id = r.old_id;
UPDATE learner_profiles p SET intended_class = CASE lower(btrim(p.intended_class))
 WHEN 'ecd a' THEN 'ECD-A' WHEN 'ecd b' THEN 'ECD-B'
 WHEN 'form 3 / o level' THEN 'Form 3' WHEN 'form 4 / o level' THEN 'Form 4'
 WHEN 'form 5 / a level' THEN 'Lower 6' WHEN 'form 6 / a level' THEN 'Upper 6'
 ELSE p.intended_class END
WHERE lower(p.school_code) = 'zimsec' AND lower(btrim(p.intended_class)) IN
 ('ecd a','ecd b','form 3 / o level','form 4 / o level','form 5 / a level','form 6 / a level');
UPDATE student_registration_requests r SET intended_class = CASE lower(btrim(r.intended_class))
 WHEN 'ecd a' THEN 'ECD-A' WHEN 'ecd b' THEN 'ECD-B'
 WHEN 'form 3 / o level' THEN 'Form 3' WHEN 'form 4 / o level' THEN 'Form 4'
 WHEN 'form 5 / a level' THEN 'Lower 6' WHEN 'form 6 / a level' THEN 'Upper 6'
 ELSE r.intended_class END
WHERE lower(r.school_code) = 'zimsec' AND lower(btrim(r.intended_class)) IN
 ('ecd a','ecd b','form 3 / o level','form 4 / o level','form 5 / a level','form 6 / a level');

CREATE TABLE IF NOT EXISTS teacher_class_assignments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 teacher_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
 assignment_type VARCHAR(20) NOT NULL CHECK (assignment_type IN ('lead_class','subject')),
 subject_name VARCHAR(120) NOT NULL DEFAULT '',
 created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK ((assignment_type = 'lead_class' AND subject_name = '') OR
        (assignment_type = 'subject' AND length(btrim(subject_name)) > 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS teacher_class_subject_unique
 ON teacher_class_assignments(teacher_id, class_id, assignment_type, lower(subject_name));
CREATE UNIQUE INDEX IF NOT EXISTS zimsec_one_lead_teacher_per_class
 ON teacher_class_assignments(class_id) WHERE assignment_type = 'lead_class';
CREATE INDEX IF NOT EXISTS teacher_class_assignments_teacher_idx
 ON teacher_class_assignments(teacher_id, class_id);

COMMIT;
